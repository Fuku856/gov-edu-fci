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
}

async function refreshBoardData() {
  await updateDailyUsage();
  subscribeApprovedPosts();
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

function subscribeApprovedPosts() {
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

  unsubscribePosts = db
    .collection('posts')
    .where('status', '==', 'approved')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
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

  card.innerHTML = `
    <div class="post-card-header">
      <h3>${escapeHtml(data.title || '無題の投稿')}</h3>
      <p class="post-meta">投稿者: ${escapeHtml(data.authorName || '匿名')}・${createdText}</p>
    </div>
    <p class="post-content">${escapeHtml(data.content || '')}</p>
    <div class="vote-summary" data-post-id="${postId}">
      <div><span class="vote-count" data-vote="agree">0</span><span>賛成</span></div>
      <div><span class="vote-count" data-vote="neutral">0</span><span>中立</span></div>
      <div><span class="vote-count" data-vote="disagree">0</span><span>反対</span></div>
    </div>
    <div class="vote-actions">
      <button class="vote-btn agree" data-action="agree" data-post-id="${postId}">賛成</button>
      <button class="vote-btn neutral" data-action="neutral" data-post-id="${postId}">中立</button>
      <button class="vote-btn disagree" data-action="disagree" data-post-id="${postId}">反対</button>
    </div>
    <p class="feedback-message" data-feedback-for="${postId}"></p>
  `;

  card.querySelectorAll('.vote-btn').forEach((button) => {
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
  const summary = card.querySelector('.vote-summary');
  if (summary) {
    summary.querySelector('[data-vote="agree"]').textContent = counts.agree;
    summary.querySelector('[data-vote="neutral"]').textContent = counts.neutral;
    summary.querySelector('[data-vote="disagree"]').textContent = counts.disagree;
  }

  const buttons = card.querySelectorAll('.vote-btn');
  buttons.forEach((btn) => {
    if (!currentUser) {
      btn.disabled = true;
      btn.classList.remove('selected');
      return;
    }

    const isSelected = userVoteType === btn.dataset.action;
    btn.disabled = Boolean(userVoteType);
    btn.classList.toggle('selected', isSelected);
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
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

