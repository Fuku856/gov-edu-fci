const db = firebase.firestore();
const DAILY_POST_LIMIT = 30;
const DAILY_VOTE_LIMIT = 3000;

let currentUser = null;
let boardInitialized = false;
let unsubscribePosts = null;
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
});

function setupBoardPage() {
  const postForm = document.getElementById('post-form');
  if (postForm) {
    postForm.addEventListener('submit', handlePostSubmit);
  }

  // カスタムドロップダウンの制御
  const sortDropdown = document.getElementById('sort-dropdown');
  if (sortDropdown) {
    const trigger = sortDropdown.querySelector('.custom-select-trigger');
    const options = sortDropdown.querySelectorAll('.custom-options li');
    const valueSpan = sortDropdown.querySelector('.current-value');

    // ドロップダウンの開閉
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', !isExpanded);
      sortDropdown.classList.toggle('open');
    });

    // オプション選択
    options.forEach(option => {
      option.addEventListener('click', () => {
        // 選択状態の更新
        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        // 表示の更新 (テキストとアイコン)
        const text = option.querySelector('span:last-child').textContent;
        const iconHtml = option.querySelector('.option-icon').innerHTML;

        valueSpan.textContent = text;
        const triggerIcon = trigger.querySelector('.selected-icon');
        if (triggerIcon) {
          triggerIcon.innerHTML = iconHtml;
        }

        // ドロップダウンを閉じる
        trigger.setAttribute('aria-expanded', 'false');
        sortDropdown.classList.remove('open');

        // データの再取得
        refreshBoardData(option.dataset.value);
      });
    });

    // 外側クリックで閉じる
    document.addEventListener('click', (e) => {
      if (!sortDropdown.contains(e.target)) {
        trigger.setAttribute('aria-expanded', 'false');
        sortDropdown.classList.remove('open');
      }
    });
  }
}

async function refreshBoardData(sortBy = 'newest') {
  await updateDailyUsage();
  // データの整合性をチェック・修復
  repairVoteCounts();
  subscribeApprovedPosts(sortBy);
}

function cleanupSubscriptions() {
  if (unsubscribePosts) {
    unsubscribePosts();
    unsubscribePosts = null;
  }
  voteSubscriptions.forEach((unsubscribe) => unsubscribe());
  voteSubscriptions.clear();
}

function updateDailyUsage() {
  const usageEl = document.getElementById('daily-usage');
  if (!usageEl || !currentUser) return;

  // 認証状態を確認
  const authUser = firebase.auth().currentUser;
  if (!authUser) {
    console.error('updateDailyUsage: ユーザーが認証されていません');
    usageEl.textContent = '認証されていません';
    return;
  }

  console.log('updateDailyUsage: ユーザー情報', {
    uid: authUser.uid,
    email: authUser.email,
    emailVerified: authUser.emailVerified
  });

  const today = getTodayKey();
  return db
    .collection('daily_counters')
    .doc(today)
    .get()
    .then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const postCount = data.postCount || 0;
      const voteCount = data.voteCount || 0;
      usageEl.innerHTML = `
        投稿: ${postCount} / ${DAILY_POST_LIMIT} 件<br>
        投票: ${voteCount} / ${DAILY_VOTE_LIMIT} 票
      `;
    })
    .catch((error) => {
      console.error('日次カウンターの取得に失敗しました', error);
      console.error('エラー詳細:', {
        code: error.code,
        message: error.message,
        userEmail: authUser?.email,
        userUid: authUser?.uid
      });
      usageEl.textContent = '利用状況を取得できませんでした';
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

  // 確実に並び替えるため、クライアントサイドソートを採用
  // FirestoreのorderByは使用せず、フィルタリングのみ行う
  let query = db.collection('posts').where('status', '==', 'approved');

  unsubscribePosts = query.onSnapshot(
    (snapshot) => {
      container.innerHTML = '';

      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-message">まだ承認済みの投稿はありません。新しい提案を投稿してみましょう！</p>';
        return;
      }

      // 1. まずデータを全て配列に変換
      let posts = [];
      snapshot.forEach((doc) => {
        posts.push({
          id: doc.id,
          data: doc.data()
        });
      });

      // 2. ブラウザ側で厳密にソート
      posts.sort((a, b) => {
        const dataA = a.data;
        const dataB = b.data;

        // 値を安全に取得するヘルパー関数（文字列も数値に変換）
        const getCount = (data, key) => {
          const val = data[key];
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };

        const getTime = (data) => {
          if (!data.createdAt) return 0;
          // Firestore Timestamp
          if (typeof data.createdAt.toMillis === 'function') return data.createdAt.toMillis();
          // Date Object
          if (typeof data.createdAt.getTime === 'function') return data.createdAt.getTime();
          return 0;
        };

        const timeA = getTime(dataA);
        const timeB = getTime(dataB);

        const agreeA = getCount(dataA, 'agreeCount');
        const agreeB = getCount(dataB, 'agreeCount');
        const neutralA = getCount(dataA, 'neutralCount');
        const neutralB = getCount(dataB, 'neutralCount');
        const disagreeA = getCount(dataA, 'disagreeCount');
        const disagreeB = getCount(dataB, 'disagreeCount');

        // デバッグログ: データの状態を確認
        // デバッグログ: データの状態を確認
        console.log(`[${sortBy}] ID:${a.id.substr(0, 4)} A:${agreeA} N:${neutralA} D:${disagreeA} | vs | ID:${b.id.substr(0, 4)} A:${agreeB} N:${neutralB} D:${disagreeB}`);

        switch (sortBy) {
          case 'newest':
            return timeB - timeA;
          case 'oldest':
            return timeA - timeB;
          case 'popular':
            // 人気順 (賛成 > 中立 > 反対 > 日時)
            if (agreeB !== agreeA) return agreeB - agreeA;
            if (neutralB !== neutralA) return neutralB - neutralA;
            if (disagreeB !== disagreeA) return disagreeB - disagreeA;
            return timeB - timeA;
          case 'controversial':
            // 反対順 (反対 > 中立 > 賛成 > 日時)
            if (disagreeB !== disagreeA) return disagreeB - disagreeA;
            if (neutralB !== neutralA) return neutralB - neutralA;
            if (agreeB !== agreeA) return agreeB - agreeA;
            return timeB - timeA;
          default:
            return timeB - timeA;
        }
      });

      // 3. ソートされた順序で表示
      posts.forEach((post) => {
        const card = createPostCard(post.id, post.data);
        container.appendChild(card);
        subscribeToVotes(post.id, card);
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

// データの整合性を修復する関数（投票数がズレている場合に修正）
async function repairVoteCounts() {
  console.log('Starting vote count repair...');
  try {
    const snapshot = await db.collection('posts').where('status', '==', 'approved').get();

    const updates = [];
    for (const doc of snapshot.docs) {
      const votesSnap = await doc.ref.collection('votes').get();
      let agree = 0, neutral = 0, disagree = 0;

      votesSnap.forEach(v => {
        const type = v.data().voteType;
        if (type === 'agree') agree++;
        else if (type === 'neutral') neutral++;
        else if (type === 'disagree') disagree++;
      });

      // データが異なる場合のみ更新
      const data = doc.data();
      if (data.agreeCount !== agree || data.disagreeCount !== disagree || data.neutralCount !== neutral) {
        console.log(`Repairing post ${doc.id}: Agree ${data.agreeCount}->${agree}`);
        updates.push(doc.ref.update({
          agreeCount: agree,
          neutralCount: neutral,
          disagreeCount: disagree
        }));
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`Repaired ${updates.length} posts.`);
    } else {
      console.log('No repairs needed.');
    }
  } catch (e) {
    console.error('Repair failed:', e);
  }
}

function createPostCard(postId, data) {
  const card = document.createElement('article');
  card.className = 'post-card';

  const createdAt = data.createdAt ? data.createdAt.toDate() : null;
  const createdText = createdAt
    ? createdAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '投稿日時を取得中';

  card.innerHTML = `
    <div class="post-card-header">
      <h3>${escapeHtml(data.title || '無題の投稿')}</h3>
      <p class="post-meta">投稿者: ${escapeHtml(data.authorName || '匿名')}・${createdText}</p>
    </div>
    <div class="post-content">${escapeHtml(data.content || '')}</div>
    
    <div class="vote-actions-reddit" data-post-id="${postId}">
      <div class="vote-group">
        <button class="vote-btn-icon agree" data-action="agree" data-post-id="${postId}" aria-label="賛成">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
        <span class="vote-count-text" data-vote="agree">0</span>
      </div>

      <div class="vote-group">
        <button class="vote-btn-icon neutral" data-action="neutral" data-post-id="${postId}" aria-label="中立">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
        <span class="vote-count-text" data-vote="neutral">0</span>
      </div>

      <div class="vote-group">
        <button class="vote-btn-icon disagree" data-action="disagree" data-post-id="${postId}" aria-label="反対">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </button>
        <span class="vote-count-text" data-vote="disagree">0</span>
      </div>
    </div>
    <p class="feedback-message" data-feedback-for="${postId}"></p>
  `;

  card.querySelectorAll('.vote-btn-icon').forEach((button) => {
    button.addEventListener('click', () => handleVote(postId, button.dataset.action, card));
  });

  return card;
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
      if (currentUser && doc.id === currentUser.uid) {
        userVoteType = vote.voteType;
      }
    });

    updateVoteDisplay(card, counts, userVoteType);
  });

  voteSubscriptions.set(postId, unsubscribe);
}

function updateVoteDisplay(card, counts, userVoteType) {
  const container = card.querySelector('.vote-actions-reddit');
  if (container) {
    container.querySelector('[data-vote="agree"]').textContent = counts.agree;
    container.querySelector('[data-vote="neutral"]').textContent = counts.neutral;
    container.querySelector('[data-vote="disagree"]').textContent = counts.disagree;
  }

  const buttons = card.querySelectorAll('.vote-btn-icon');
  buttons.forEach((btn) => {
    if (!currentUser) {
      btn.disabled = true;
      btn.classList.remove('selected');
      return;
    }

    const isSelected = userVoteType === btn.dataset.action;
    btn.disabled = Boolean(userVoteType); // 投票済みなら無効化（変更不可の場合）
    // 変更可能にするなら btn.disabled = false; ですが、仕様によります。
    // 元のコードが btn.disabled = Boolean(userVoteType) だったので維持します。
    // ただし、自分の投票したボタンだけはアクティブに見せたいのでclassはつけます。

    btn.classList.toggle('selected', isSelected);

    // 投票済みの場合、選択されていないボタンは薄くするなどのスタイル調整が可能
    if (userVoteType) {
      btn.classList.add('voted-state');
    } else {
      btn.classList.remove('voted-state');
    }
  });
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
    feedback.textContent = '投稿を受け付けました。承認までしばらくお待ちください。';
    feedback.classList.remove('error');
    form.reset();
    await updateDailyUsage();
  } catch (error) {
    console.error('投稿に失敗しました', error);
    feedback.textContent = error.message || '投稿に失敗しました。時間をおいて再度お試しください。';
    feedback.classList.add('error');
  }
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

async function handleVote(postId, voteType, card) {
  if (!currentUser) return;

  const feedback = card.querySelector(`[data-feedback-for="${postId}"]`);
  feedback.textContent = '';
  feedback.classList.remove('error');

  try {
    await submitVote(postId, voteType);
    await updateDailyUsage();
    feedback.textContent = '投票しました。ご協力ありがとうございます。';
  } catch (error) {
    console.error('投票に失敗しました', error);
    feedback.textContent = error.message || '投票に失敗しました。すでに投票済みの可能性があります。';
    feedback.classList.add('error');
  }
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

