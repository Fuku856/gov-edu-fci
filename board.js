const db = firebase.firestore();
const DAILY_POST_LIMIT = 30;
const DAILY_VOTE_LIMIT = 3000;

let currentUser = null;
let boardInitialized = false;
let unsubscribePosts = null;
let pendingVote = null; // 投票保留用
let unsubscribeDetailVotes = null; // 詳細モーダル用の購読解除関数
const voteSubscriptions = new Map();

document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(async (user) => {
    currentUser = user;

    if (!user) {
      console.log('board.js: ユーザーがログインしていません');
      cleanupSubscriptions();
      return;
    }

    console.log('board.js: ユーザーがログインしました', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      providerData: user.providerData
    });

    // 認証トークンを取得して確認
    try {
      const idTokenResult = await user.getIdTokenResult(true); // true: 強制的にトークンを更新
      console.log('board.js: 認証トークン情報', {
        email: idTokenResult.claims.email,
        email_verified: idTokenResult.claims.email_verified,
        auth_time: idTokenResult.claims.auth_time
      });
    } catch (tokenError) {
      console.error('board.js: 認証トークンの取得に失敗しました', tokenError);
    }

    if (!boardInitialized) {
      setupBoardPage();
      boardInitialized = true;
    }

    // 少し待ってからデータを取得（認証トークンが確実に更新されるまで）
    await new Promise(resolve => setTimeout(resolve, 100));
    await refreshBoardData();
  });
  
  setupReloadTrigger();
});

function setupReloadTrigger() {
  const trigger = document.getElementById('reload-trigger');
  if (!trigger) return;

  trigger.addEventListener('click', (e) => {
    e.preventDefault(); // デフォルトの挙動をキャンセル

    // 1. まずページ上部へスムーズスクロール
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // 2. スクロール動作がある程度完了してからDOMを操作する
    // (スクロール中にDOMを変えると位置がずれたりスクロールが止まるため)
    setTimeout(() => {
      const container = document.getElementById('posts-container');
      if (container) {
        // リロードアニメーション表示
        container.innerHTML = `
          <div class="loading-spinner-container" style="padding-top: 40px; padding-bottom: 40px;">
            <div class="twitter-loader"></div>
          </div>
        `;
        
        // 3. アニメーションを見せてからデータを再取得
        setTimeout(() => {
          refreshBoardData();
        }, 600);
      }
    }, 500); // スクロール時間として0.5秒待機
  });
}

function setupBoardPage() {
  const postForm = document.getElementById('post-form');
  if (postForm) {
    postForm.addEventListener('submit', handlePostSubmit);
  }

  setupModalHandlers();
  setupSortDropdown();
}

function setupModalHandlers() {
  // モーダル要素
  const postModal = document.getElementById('post-modal');
  const infoModal = document.getElementById('info-modal');
  const confirmDialog = document.getElementById('confirm-dialog');

  // 開くボタン
  const fabPost = document.getElementById('fab-post');
  const infoBtn = document.getElementById('info-menu-btn');

  // 閉じるボタン
  const closePostBtn = document.getElementById('close-post-modal');
  const closeInfoBtn = document.getElementById('close-info-modal');
  const cancelConfirmBtn = document.getElementById('confirm-cancel-btn');
  const confirmOkBtn = document.getElementById('confirm-ok-btn');

  // 新規投稿モーダル
  if (fabPost && postModal) {
    fabPost.addEventListener('click', () => {
      // ユーザーアイコンの初期文字を更新
      updateUserInitial();
      postModal.classList.add('open');
      document.body.style.overflow = 'hidden'; // 背景スクロール防止
    });
  }

  if (closePostBtn && postModal) {
    closePostBtn.addEventListener('click', () => {
      postModal.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // 情報モーダル
  if (infoBtn && infoModal) {
    infoBtn.addEventListener('click', () => {
      infoModal.classList.add('open');
      document.body.style.overflow = 'hidden';
      updateDailyUsage(); // 開くときに情報を更新
    });
  }

  if (closeInfoBtn && infoModal) {
    closeInfoBtn.addEventListener('click', () => {
      infoModal.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // 確認ダイアログ（キャンセルボタン）
  if (cancelConfirmBtn && confirmDialog) {
    cancelConfirmBtn.addEventListener('click', () => {
      confirmDialog.classList.remove('open');
      document.body.style.overflow = '';
      pendingVote = null;
    });
  }

  // 確認ダイアログ（OKボタン）
  if (confirmOkBtn && confirmDialog) {
    confirmOkBtn.addEventListener('click', async () => {
      if (!pendingVote) return;

      const { postId, voteType, card } = pendingVote;

      confirmDialog.classList.remove('open');
      document.body.style.overflow = '';

      await executeVote(postId, voteType, card);
      pendingVote = null;
    });
  }

  // モーダル外側クリックで閉じる
  [postModal, infoModal, confirmDialog].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
          document.body.style.overflow = '';
          if (modal === confirmDialog) {
            pendingVote = null;
          }
        }
      });
    }
  });

  // 投稿完了モーダル
  const successModal = document.getElementById('success-modal');
  const successOkBtn = document.getElementById('success-ok-btn');

  if (successOkBtn && successModal) {
    successOkBtn.addEventListener('click', () => {
      successModal.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // 投稿詳細モーダル
  const detailModal = document.getElementById('post-detail-modal');
  const closeDetailBtn = document.getElementById('close-post-detail-modal');

  if (closeDetailBtn && detailModal) {
    closeDetailBtn.addEventListener('click', () => {
      detailModal.classList.remove('open');
      document.body.style.overflow = '';
      if (unsubscribeDetailVotes) {
        unsubscribeDetailVotes();
        unsubscribeDetailVotes = null;
      }
    });
  }

  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) {
        detailModal.classList.remove('open');
        document.body.style.overflow = '';
        if (unsubscribeDetailVotes) {
          unsubscribeDetailVotes();
          unsubscribeDetailVotes = null;
        }
      }
    });
  }

  // ESCキーでモーダルを閉じる（PC用）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      // 優先順位の高い順にチェック（z-indexの高い順）
      // 確認ダイアログ
      if (confirmDialog && confirmDialog.classList.contains('open')) {
        confirmDialog.classList.remove('open');
        document.body.style.overflow = '';
        pendingVote = null;
        return;
      }
      // 投稿完了モーダル
      if (successModal && successModal.classList.contains('open')) {
        successModal.classList.remove('open');
        document.body.style.overflow = '';
        return;
      }
      // 投稿詳細モーダル
      if (detailModal && detailModal.classList.contains('open')) {
        detailModal.classList.remove('open');
        document.body.style.overflow = '';
        if (unsubscribeDetailVotes) {
          unsubscribeDetailVotes();
          unsubscribeDetailVotes = null;
        }
        return;
      }
      // 新規投稿モーダル
      if (postModal && postModal.classList.contains('open')) {
        postModal.classList.remove('open');
        document.body.style.overflow = '';
        return;
      }
      // 情報モーダル
      if (infoModal && infoModal.classList.contains('open')) {
        infoModal.classList.remove('open');
        document.body.style.overflow = '';
        return;
      }
    }
  });
}

function setupSortDropdown() {
  const trigger = document.getElementById('sort-trigger');
  const menu = document.getElementById('sort-menu');

  if (!trigger || !menu) return;

  // ドロップダウンの開閉
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  // オプション選択
  const options = menu.querySelectorAll('.sort-option');
  options.forEach(option => {
    option.addEventListener('click', () => {
      // 選択状態の更新
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');

      // メニューを閉じる
      menu.classList.remove('show');

      // データの再取得
      const sortType = option.dataset.sort;
      refreshBoardData(sortType);
    });
  });

  // 外側クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('show');
    }
  });
}

async function refreshBoardData(sortBy = 'newest') {
  await updateDailyUsage();
  subscribeApprovedPosts(sortBy);
}

function cleanupSubscriptions() {
  if (unsubscribePosts) {
    unsubscribePosts();
    unsubscribePosts = null;
  }
  if (unsubscribeDetailVotes) {
    unsubscribeDetailVotes();
    unsubscribeDetailVotes = null;
  }
  voteSubscriptions.forEach((unsubscribe) => unsubscribe());
  voteSubscriptions.clear();
}

function updateDailyUsage() {
  const postCountEl = document.getElementById('daily-post-count');
  const voteCountEl = document.getElementById('daily-vote-count');

  if (!postCountEl || !voteCountEl || !currentUser) return;

  // 認証状態を確認
  const authUser = firebase.auth().currentUser;
  if (!authUser) {
    console.error('updateDailyUsage: ユーザーが認証されていません');
    postCountEl.textContent = '-';
    voteCountEl.textContent = '-';
    return;
  }

  const today = getTodayKey();
  return db
    .collection('daily_counters')
    .doc(today)
    .get()
    .then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const postCount = data.postCount || 0;
      const voteCount = data.voteCount || 0;

      postCountEl.textContent = `${postCount} / ${DAILY_POST_LIMIT}`;
      voteCountEl.textContent = `${voteCount} / ${DAILY_VOTE_LIMIT}`;
    })
    .catch((error) => {
      console.error('日次カウンターの取得に失敗しました', error);
      postCountEl.textContent = 'Error';
      voteCountEl.textContent = 'Error';
    });
}

function subscribeApprovedPosts(sortBy = 'newest') {
  const container = document.getElementById('posts-container');
  if (!container) return;

  // 認証状態を確認
  const authUser = firebase.auth().currentUser;
  if (!authUser) {
    console.error('subscribeApprovedPosts: ユーザーが認証されていません');
    container.innerHTML = '<p class="empty-message">認証されていません。ログインしてください。</p>';
    return;
  }

  console.log('subscribeApprovedPosts: ユーザー情報', {
    uid: authUser.uid,
    email: authUser.email,
    emailVerified: authUser.emailVerified
  });

  if (unsubscribePosts) {
    unsubscribePosts();
  }
  voteSubscriptions.forEach((unsubscribe) => unsubscribe());
  voteSubscriptions.clear();

  let query = db.collection('posts').where('status', '==', 'approved');

  switch (sortBy) {
    case 'newest':
      query = query.orderBy('createdAt', 'desc');
      break;
    case 'oldest':
      query = query.orderBy('createdAt', 'asc');
      break;
    case 'popular':
      query = query.orderBy('agreeCount', 'desc');
      break;
    case 'controversial':
      query = query.orderBy('disagreeCount', 'desc');
      break;
    default:
      query = query.orderBy('createdAt', 'desc');
  }

  unsubscribePosts = query.onSnapshot(
    (snapshot) => {
      container.innerHTML = '';

      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-message">まだ承認済みの投稿はありません。新しい提案を投稿してみましょう！</p>';
        return;
      }

      snapshot.forEach((doc) => {
        const postData = doc.data();
        const card = createPostCard(doc.id, postData);
        container.appendChild(card);
        subscribeToVotes(doc.id, card);
      });
    },
    (error) => {
      console.error('投稿の取得に失敗しました', error);
      console.error('エラー詳細:', {
        code: error.code,
        message: error.message,
        userEmail: authUser?.email,
        userUid: authUser?.uid
      });
      container.innerHTML = '<p class="empty-message">投稿を読み込めませんでした。権限エラーの可能性があります。ページをリロードしてください。</p>';
    }
  );
}

function createPostCard(postId, data) {
  const card = document.createElement('article');
  card.className = 'post-card';

  const createdAt = data.createdAt ? data.createdAt.toDate() : null;
  const createdText = createdAt
    ? createdAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '投稿日時を取得中';

  const authorName = data.authorName || '匿名';
  const authorInitial = authorName.charAt(0).toUpperCase();

  // 本文の処理
  const content = data.content || '';
  const isLongText = content.length > 150;
  const displayContent = isLongText ? content.substring(0, 150) + '...' : content;
  const showMoreHtml = isLongText ? '<button class="show-more-btn">さらに表示</button>' : '';

  card.innerHTML = `
    <div class="post-avatar">
      ${escapeHtml(authorInitial)}
    </div>
    <div class="post-body">
      <div class="post-header">
        <span class="post-author-name">${escapeHtml(authorName)}</span>
        <span class="post-meta">・${createdText}</span>
      </div>
      <div class="post-title">${escapeHtml(data.title || '無題の投稿')}</div>
      <div class="post-content"><span class="content-text">${escapeHtml(displayContent)}</span>${showMoreHtml}</div>
      
      <div class="post-actions" data-post-id="${postId}">
        <button class="action-item agree" data-action="agree" data-post-id="${postId}" aria-label="賛成">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <span class="vote-count-text" data-vote="agree">0</span>
        </button>

        <button class="action-item neutral" data-action="neutral" data-post-id="${postId}" aria-label="中立">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span class="vote-count-text" data-vote="neutral">0</span>
        </button>

        <button class="action-item disagree" data-action="disagree" data-post-id="${postId}" aria-label="反対">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
          <span class="vote-count-text" data-vote="disagree">0</span>
        </button>
      </div>
      <p class="feedback-message" data-feedback-for="${postId}"></p>
    </div>
  `;

  // イベントリスナーの設定

  // 「さらに表示」ボタン
  const showMoreBtn = card.querySelector('.show-more-btn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // カードのクリックイベントを阻止
      openPostDetail(postId, data, card);
    });
  }

  // アクションボタン（投票）
  card.querySelectorAll('.action-item').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // カードのクリックイベントを阻止
      handleVote(postId, button.dataset.action, card);
    });
  });

  // カード全体のクリック（詳細表示）
  card.addEventListener('click', (e) => {
    // テキスト選択中は反応しないようにする（オプション）
    const selection = window.getSelection();
    if (selection.toString().length > 0) return;

    openPostDetail(postId, data, card); // cardを渡して現在の投票状態などを引き継げるようにする（今回はデータ再利用）
  });

  return card;
}

function openPostDetail(postId, data, originalCard) {
  const modal = document.getElementById('post-detail-modal');
  const container = document.getElementById('post-detail-container');

  if (!modal || !container) return;

  // 詳細表示用のカードを作成（既存のcreatePostCardを再利用しつつ、全文表示にする）
  // ただし、createPostCardはイベントリスナーもつけてしまうので、
  // ここではシンプルにHTMLを構築するか、createPostCardで作ったものを調整する。
  // 今回はシンプルにHTMLを再構築する（イベントは不要、閲覧専用とするため）

  const createdAt = data.createdAt ? data.createdAt.toDate() : null;
  const createdText = createdAt
    ? createdAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '投稿日時を取得中';
  const authorName = data.authorName || '匿名';
  const authorInitial = authorName.charAt(0).toUpperCase();

  // 元のカードから現在の投票数を取得（リアルタイム性を保つため）
  let counts = { agree: 0, neutral: 0, disagree: 0 };
  if (originalCard) {
    const agreeEl = originalCard.querySelector('[data-vote="agree"]');
    const neutralEl = originalCard.querySelector('[data-vote="neutral"]');
    const disagreeEl = originalCard.querySelector('[data-vote="disagree"]');
    if (agreeEl) counts.agree = agreeEl.textContent;
    if (neutralEl) counts.neutral = neutralEl.textContent;
    if (disagreeEl) counts.disagree = disagreeEl.textContent;
  } else {
    counts.agree = data.agreeCount || 0;
    counts.neutral = data.neutralCount || 0;
    counts.disagree = data.disagreeCount || 0;
  }

  container.innerHTML = `
    <article class="post-card">
      <div class="post-avatar">
        ${escapeHtml(authorInitial)}
      </div>
      <div class="post-body">
        <div class="post-header">
          <span class="post-author-name">${escapeHtml(authorName)}</span>
          <span class="post-meta">・${createdText}</span>
        </div>
        <div class="post-title">${escapeHtml(data.title || '無題の投稿')}</div>
        <div class="post-content" style="white-space: pre-wrap;">${escapeHtml(data.content || '')}</div>
        
        <div class="post-actions" data-post-id="${postId}">
          <button class="action-item agree" data-action="agree" data-post-id="${postId}" aria-label="賛成">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            <span class="vote-count-text" data-vote="agree">${counts.agree}</span>
          </button>

          <button class="action-item neutral" data-action="neutral" data-post-id="${postId}" aria-label="中立">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <span class="vote-count-text" data-vote="neutral">${counts.neutral}</span>
          </button>

          <button class="action-item disagree" data-action="disagree" data-post-id="${postId}" aria-label="反対">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            <span class="vote-count-text" data-vote="disagree">${counts.disagree}</span>
          </button>
        </div>
        <p class="feedback-message" data-feedback-for="${postId}"></p>
      </div>
    </article>
  `;

  // イベントリスナーの設定
  const detailCard = container.querySelector('.post-card');
  
  // アクションボタン（投票）
  detailCard.querySelectorAll('.action-item').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      handleVote(postId, button.dataset.action, detailCard);
    });
  });

  // リアルタイム更新の購読
  if (unsubscribeDetailVotes) {
    unsubscribeDetailVotes();
  }
  unsubscribeDetailVotes = subscribeToVotes(postId, detailCard);

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateVoteDisplay(card, counts, userVoteType) {
  const container = card.querySelector('.post-actions');
  if (container) {
    const agreeBtn = container.querySelector('[data-action="agree"]');
    if (agreeBtn) agreeBtn.querySelector('.vote-count-text').textContent = counts.agree;

    const neutralBtn = container.querySelector('[data-action="neutral"]');
    if (neutralBtn) neutralBtn.querySelector('.vote-count-text').textContent = counts.neutral;

    const disagreeBtn = container.querySelector('[data-action="disagree"]');
    if (disagreeBtn) disagreeBtn.querySelector('.vote-count-text').textContent = counts.disagree;
  }

  const buttons = card.querySelectorAll('.action-item');
  buttons.forEach((btn) => {
    const isSelected = userVoteType === btn.dataset.action;
    btn.classList.toggle('active', isSelected);
  });
}

function subscribeToVotes(postId, card) {
  const votesRef = db.collection('posts').doc(postId).collection('votes');

  const unsubscribe = votesRef.onSnapshot((snapshot) => {
    const counts = { agree: 0, neutral: 0, disagree: 0 };
    let userVoteType = null;

    snapshot.forEach((doc) => {
      const vote = doc.data();
      if (vote.voteType && counts[vote.voteType] !== undefined) {
        counts[vote.voteType] += 1;
      }

      if (currentUser && (doc.id === currentUser.uid || vote.userId === currentUser.uid)) {
        userVoteType = vote.voteType;
      }
    });

    updateVoteDisplay(card, counts, userVoteType);
  });

  return unsubscribe;
}

async function handlePostSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;

  const form = event.target;
  const titleInput = form.querySelector('#post-title');
  const contentInput = form.querySelector('#post-content');
  const feedback = document.getElementById('post-feedback');

  const title = (titleInput.value || '').trim();
  const content = (contentInput.value || '').trim();

  if (!title || !content) {
    feedback.textContent = 'タイトルと内容は必須です。';
    feedback.classList.add('error');
    return;
  }

  try {
    await createPost(title, content);

    // 投稿フォームをリセット
    form.reset();
    feedback.textContent = '';
    feedback.classList.remove('error');

    // 投稿モーダルを閉じる
    const postModal = document.getElementById('post-modal');
    if (postModal) {
      postModal.classList.remove('open');
    }

    // 完了モーダルを表示
    const successModal = document.getElementById('success-modal');
    if (successModal) {
      successModal.classList.add('open');
    }

    await updateDailyUsage();
  } catch (error) {
    console.error('投稿に失敗しました', error);
    feedback.textContent = error.message || '投稿に失敗しました。時間をおいて再度お試しください。';
    feedback.classList.add('error');
  }
}

function updateUserInitial() {
  const userInitialEl = document.getElementById('current-user-initial');
  if (!userInitialEl) return;

  if (!currentUser) {
    userInitialEl.textContent = '?';
    return;
  }

  const authorName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '匿名');
  const authorInitial = authorName.charAt(0).toUpperCase();
  userInitialEl.textContent = authorInitial;
}

function createPost(title, content) {
  const user = currentUser;
  const today = getTodayKey();
  const counterRef = db.collection('daily_counters').doc(today);
  const postsRef = db.collection('posts').doc();

  const authorName = user.displayName || (user.email ? user.email.split('@')[0] : '匿名');

  return db.runTransaction(async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const currentCount = counterSnap.exists ? (counterSnap.data().postCount || 0) : 0;
    if (currentCount >= DAILY_POST_LIMIT) {
      throw new Error('本日の投稿上限に達しています。明日改めて投稿してください。');
    }

    transaction.set(counterRef, {
      postCount: firebase.firestore.FieldValue.increment(1),
      voteCount: firebase.firestore.FieldValue.increment(0),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(postsRef, {
      title,
      content,
      authorId: user.uid,
      authorName,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      agreeCount: 0,
      neutralCount: 0,
      disagreeCount: 0
    });
  });
}

function handleVote(postId, voteType, card) {
  if (!currentUser) return;

  // 既に投票済みかチェック
  const hasVoted = card.querySelector('.action-item.active');
  if (hasVoted) {
    // 既に投票済みの場合は確認ダイアログを出さずに処理を実行（エラーメッセージが表示される）
    executeVote(postId, voteType, card);
    return;
  }

  // 投票情報を一時保存
  pendingVote = { postId, voteType, card };

  // 確認ダイアログを表示
  const confirmDialog = document.getElementById('confirm-dialog');
  if (confirmDialog) {
    confirmDialog.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

async function executeVote(postId, voteType, card) {
  const feedback = card.querySelector(`[data-feedback-for="${postId}"]`);
  feedback.textContent = '';
  feedback.classList.remove('error');

  // 既存のタイマーがあればクリア
  if (feedback.dataset.timerId) {
    clearTimeout(parseInt(feedback.dataset.timerId));
    delete feedback.dataset.timerId;
  }

  try {
    await submitVote(postId, voteType);
    await updateDailyUsage();
    feedback.textContent = '投票しました。ご協力ありがとうございます。';
  } catch (error) {
    console.error('投票に失敗しました', error);
    feedback.textContent = error.message || '投票に失敗しました。すでに投票済みの可能性があります。';
    feedback.classList.add('error');
  }

  // 5秒後にメッセージを消去
  const timerId = setTimeout(() => {
    feedback.textContent = '';
    feedback.classList.remove('error');
    delete feedback.dataset.timerId;
  }, 5000);

  feedback.dataset.timerId = timerId;
}

function submitVote(postId, voteType) {
  const user = currentUser;
  const today = getTodayKey();

  const counterRef = db.collection('daily_counters').doc(today);
  const voteRef = db.collection('posts').doc(postId).collection('votes').doc(user.uid);

  return db.runTransaction(async (transaction) => {
    const [counterSnap, voteSnap] = await Promise.all([
      transaction.get(counterRef),
      transaction.get(voteRef)
    ]);

    if (voteSnap.exists) {
      throw new Error('この投稿には既に投票しています。');
    }

    const voteCount = counterSnap.exists ? (counterSnap.data().voteCount || 0) : 0;
    if (voteCount >= DAILY_VOTE_LIMIT) {
      throw new Error('本日の投票上限に達しています。');
    }

    transaction.set(counterRef, {
      voteCount: firebase.firestore.FieldValue.increment(1),
      postCount: firebase.firestore.FieldValue.increment(0),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(voteRef, {
      postId,
      userId: user.uid,
      voteType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 投稿ドキュメントのカウンターも更新
    const postUpdate = {};
    postUpdate[`${voteType}Count`] = firebase.firestore.FieldValue.increment(1);
    transaction.set(db.collection('posts').doc(postId), postUpdate, { merge: true });
  });
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

// スクロールトップボタンの制御
document.addEventListener('DOMContentLoaded', () => {
  const scrollTopBtn = document.getElementById('scrollTopBtn');

  if (scrollTopBtn) {
    // スクロール位置を監視してボタンの表示/非表示を制御
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 300) {
        scrollTopBtn.classList.add('visible');
      } else {
        scrollTopBtn.classList.remove('visible');
      }
    });

    // ボタンをクリックしたらページの最上部にスムーズにスクロール
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // ハンバーガーメニューの制御
  const hamburger = document.querySelector('.hamburger');
  const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
  const body = document.body;

  if (hamburger && mobileMenuOverlay) {
    // ハンバーガーボタンのクリックイベント
    hamburger.addEventListener('click', () => {
      const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !isExpanded);
      mobileMenuOverlay.classList.toggle('active');
      body.classList.toggle('menu-open');
    });

    // モバイルメニューのリンクをクリックしたらメニューを閉じる
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenuOverlay.classList.remove('active');
        body.classList.remove('menu-open');
      });
    });

    // オーバーレイの背景をクリックしたらメニューを閉じる
    mobileMenuOverlay.addEventListener('click', (e) => {
      if (e.target === mobileMenuOverlay) {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenuOverlay.classList.remove('active');
        body.classList.remove('menu-open');
      }
    });
  }
});
