const db = firebase.firestore();
const ADMIN_DAILY_POST_LIMIT = 30;
const ADMIN_DAILY_VOTE_LIMIT = 3000;
const ITEMS_PER_PAGE = 10; // 1ページあたりの表示件数

let adminInitialized = false;
let unsubscribePending = null;

const state = {
  currentUser: null,
  pendingPosts: {
    allPosts: [],
    currentPage: 1,
    totalPages: 1
  },
  loginHistory: {
    allHistory: [],
    currentPage: 1,
    totalPages: 1
  }
};

document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      cleanupAdminSubscriptions();
      return;
    }

    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      alert('このページは管理者のみがアクセスできます。');
      window.location.href = 'index.html';
      return;
    }

    if (!adminInitialized) {
      initAdminDashboard();
      adminInitialized = true;
    }

    await refreshAdminDashboard();
  });
});

function cleanupAdminSubscriptions() {
  if (unsubscribePending) {
    unsubscribePending();
    unsubscribePending = null;
  }
}

function initAdminDashboard() {
  const container = document.getElementById('pending-posts');
  if (container) {
    container.addEventListener('click', onPendingListClick);
  }
  
  // ページネーションボタンのイベントリスナー
  const pendingPrevBtn = document.getElementById('pending-prev-btn');
  const pendingNextBtn = document.getElementById('pending-next-btn');
  if (pendingPrevBtn) {
    pendingPrevBtn.addEventListener('click', () => {
      if (state.pendingPosts.currentPage > 1) {
        state.pendingPosts.currentPage--;
        renderPendingPosts();
      }
    });
  }
  if (pendingNextBtn) {
    pendingNextBtn.addEventListener('click', () => {
      if (state.pendingPosts.currentPage < state.pendingPosts.totalPages) {
        state.pendingPosts.currentPage++;
        renderPendingPosts();
      }
    });
  }
  
  const historyPrevBtn = document.getElementById('history-prev-btn');
  const historyNextBtn = document.getElementById('history-next-btn');
  if (historyPrevBtn) {
    historyPrevBtn.addEventListener('click', () => {
      if (state.loginHistory.currentPage > 1) {
        state.loginHistory.currentPage--;
        renderLoginHistory();
      }
    });
  }
  if (historyNextBtn) {
    historyNextBtn.addEventListener('click', () => {
      if (state.loginHistory.currentPage < state.loginHistory.totalPages) {
        state.loginHistory.currentPage++;
        renderLoginHistory();
      }
    });
  }
}

async function refreshAdminDashboard() {
  await updateAdminStats();
  await loadPendingPosts();
  await loadLoginHistory();
}

function updateAdminStats() {
  const postCountEl = document.getElementById('admin-post-count');
  const voteCountEl = document.getElementById('admin-vote-count');
  const lastUpdatedEl = document.getElementById('admin-last-updated');

  const today = getTodayKey();
  return db
    .collection('daily_counters')
    .doc(today)
    .get()
    .then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const postCount = data.postCount || 0;
      const voteCount = data.voteCount || 0;
      const lastUpdated = data.lastUpdated ? data.lastUpdated.toDate() : null;

      if (postCountEl) postCountEl.textContent = `${postCount} / ${ADMIN_DAILY_POST_LIMIT}`;
      if (voteCountEl) voteCountEl.textContent = `${voteCount} / ${ADMIN_DAILY_VOTE_LIMIT}`;
      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = lastUpdated
          ? lastUpdated.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
          : '---';
      }
    })
    .catch((error) => {
      console.error('日次カウンターの取得に失敗しました', error);
      if (postCountEl) postCountEl.textContent = '取得エラー';
      if (voteCountEl) voteCountEl.textContent = '取得エラー';
      if (lastUpdatedEl) lastUpdatedEl.textContent = '---';
    });
}

async function loadPendingPosts() {
  const container = document.getElementById('pending-posts');
  const pendingCountEl = document.getElementById('admin-pending-count');
  if (!container) return;

  try {
    const snapshot = await db
      .collection('posts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .get();

    const allPosts = [];
    snapshot.forEach((doc) => {
      allPosts.push({
        id: doc.id,
        ...doc.data()
      });
    });

    state.pendingPosts.allPosts = allPosts;
    state.pendingPosts.totalPages = Math.max(1, Math.ceil(allPosts.length / ITEMS_PER_PAGE));
    state.pendingPosts.currentPage = 1;

    if (pendingCountEl) {
      pendingCountEl.textContent = `${allPosts.length} 件`;
    }

    renderPendingPosts();
    
    // リアルタイム更新を設定
    if (unsubscribePending) {
      unsubscribePending();
    }
    
    unsubscribePending = db
      .collection('posts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        async (snapshot) => {
          const allPosts = [];
          snapshot.forEach((doc) => {
            allPosts.push({
              id: doc.id,
              ...doc.data()
            });
          });

          state.pendingPosts.allPosts = allPosts;
          state.pendingPosts.totalPages = Math.max(1, Math.ceil(allPosts.length / ITEMS_PER_PAGE));
          
          // 現在のページが存在しない場合は最後のページに移動
          if (state.pendingPosts.currentPage > state.pendingPosts.totalPages) {
            state.pendingPosts.currentPage = state.pendingPosts.totalPages;
          }

          if (pendingCountEl) {
            pendingCountEl.textContent = `${allPosts.length} 件`;
          }

          renderPendingPosts();
        },
        (error) => {
          console.error('承認待ち投稿の取得に失敗しました', error);
          container.innerHTML = '<p class="empty-message">投稿を読み込めませんでした。</p>';
          if (pendingCountEl) pendingCountEl.textContent = '---';
        }
      );
  } catch (error) {
    console.error('承認待ち投稿の取得に失敗しました', error);
    container.innerHTML = '<p class="empty-message">投稿を読み込めませんでした。</p>';
    if (pendingCountEl) pendingCountEl.textContent = '---';
  }
}

function renderPendingPosts() {
  const container = document.getElementById('pending-posts');
  const paginationEl = document.getElementById('pending-posts-pagination');
  const prevBtn = document.getElementById('pending-prev-btn');
  const nextBtn = document.getElementById('pending-next-btn');
  const pageInfo = document.getElementById('pending-page-info');
  
  if (!container) return;

  const { allPosts, currentPage, totalPages } = state.pendingPosts;
  
  if (allPosts.length === 0) {
    container.innerHTML = '<p class="empty-message">承認待ちの投稿はありません。</p>';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  // 現在のページの投稿を取得
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPosts = allPosts.slice(startIndex, endIndex);

  container.innerHTML = '';
  currentPosts.forEach((post) => {
    const card = createPendingCard(post.id, post);
    container.appendChild(card);
  });

  // ページネーションUIを更新
  if (paginationEl) {
    if (totalPages > 1) {
      paginationEl.style.display = 'flex';
      if (prevBtn) prevBtn.disabled = currentPage === 1;
      if (nextBtn) nextBtn.disabled = currentPage === totalPages;
      if (pageInfo) {
        pageInfo.textContent = `${currentPage} / ${totalPages} ページ (全 ${allPosts.length} 件)`;
      }
    } else {
      paginationEl.style.display = 'none';
    }
  }
}

function createPendingCard(postId, data) {
  const card = document.createElement('article');
  card.className = 'admin-post-card';
  card.dataset.postId = postId;

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
    <div class="admin-actions">
      <button class="btn-primary" data-action="approve">承認</button>
      <button class="btn-outline" data-action="reject">却下</button>
    </div>
    <p class="feedback-message" data-feedback></p>
  `;

  return card;
}

function onPendingListClick(event) {
  const actionBtn = event.target.closest('[data-action]');
  if (!actionBtn) return;

  const card = actionBtn.closest('.admin-post-card');
  if (!card) return;

  const postId = card.dataset.postId;
  const feedback = card.querySelector('[data-feedback]');

  const action = actionBtn.dataset.action;
  if (action === 'approve') {
    approvePost(postId, feedback);
  } else if (action === 'reject') {
    rejectPost(postId, feedback);
  }
}

async function approvePost(postId, feedbackEl) {
  try {
    await db.collection('posts').doc(postId).update({
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: state.currentUser.uid
    });
    if (feedbackEl) {
      feedbackEl.textContent = '承認しました。';
      feedbackEl.classList.remove('error');
    }
  } catch (error) {
    console.error('承認に失敗しました', error);
    if (feedbackEl) {
      feedbackEl.textContent = '承認に失敗しました。再度お試しください。';
      feedbackEl.classList.add('error');
    }
  }
}

async function rejectPost(postId, feedbackEl) {
  const reason = window.prompt('却下理由（任意）を入力してください:', '');
  try {
    await db.collection('posts').doc(postId).update({
      status: 'rejected',
      rejectionReason: reason || '',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectedBy: state.currentUser.uid
    });
    if (feedbackEl) {
      feedbackEl.textContent = '却下しました。';
      feedbackEl.classList.remove('error');
    }
  } catch (error) {
    console.error('却下に失敗しました', error);
    if (feedbackEl) {
      feedbackEl.textContent = '却下に失敗しました。再度お試しください。';
      feedbackEl.classList.add('error');
    }
  }
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadLoginHistory() {
  const container = document.getElementById('login-history');
  const paginationEl = document.getElementById('login-history-pagination');
  if (!container) return;

  try {
    const snapshot = await db
      .collection('login_history')
      .orderBy('loginAt', 'desc')
      .limit(1000) // 最新1000件まで取得
      .get();

    const allHistory = [];
    snapshot.forEach((doc) => {
      allHistory.push({
        id: doc.id,
        ...doc.data()
      });
    });

    state.loginHistory.allHistory = allHistory;
    state.loginHistory.totalPages = Math.max(1, Math.ceil(allHistory.length / ITEMS_PER_PAGE));
    state.loginHistory.currentPage = 1;

    renderLoginHistory();
  } catch (error) {
    console.error('ログイン履歴の取得に失敗しました', error);
    container.innerHTML = '<p class="empty-message">ログイン履歴を読み込めませんでした。</p>';
    if (paginationEl) paginationEl.style.display = 'none';
  }
}

function renderLoginHistory() {
  const container = document.getElementById('login-history');
  const paginationEl = document.getElementById('login-history-pagination');
  const prevBtn = document.getElementById('history-prev-btn');
  const nextBtn = document.getElementById('history-next-btn');
  const pageInfo = document.getElementById('history-page-info');
  
  if (!container) return;

  const { allHistory, currentPage, totalPages } = state.loginHistory;
  
  if (allHistory.length === 0) {
    container.innerHTML = '<p class="empty-message">ログイン履歴がありません。</p>';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  // 現在のページの履歴を取得
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentHistory = allHistory.slice(startIndex, endIndex);

  container.innerHTML = '';
  currentHistory.forEach((history) => {
    const card = createLoginHistoryCard(history);
    container.appendChild(card);
  });

  // ページネーションUIを更新
  if (paginationEl) {
    if (totalPages > 1) {
      paginationEl.style.display = 'flex';
      if (prevBtn) prevBtn.disabled = currentPage === 1;
      if (nextBtn) nextBtn.disabled = currentPage === totalPages;
      if (pageInfo) {
        pageInfo.textContent = `${currentPage} / ${totalPages} ページ (全 ${allHistory.length} 件)`;
      }
    } else {
      paginationEl.style.display = 'none';
    }
  }
}

function createLoginHistoryCard(history) {
  const card = document.createElement('article');
  card.className = 'admin-login-history-card';

  const loginAt = history.loginAt ? history.loginAt.toDate() : null;
  const loginText = loginAt
    ? loginAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '日時不明';

  const providerName = history.providerId === 'google.com' 
    ? 'Google' 
    : history.providerId === 'github.com' 
    ? 'GitHub' 
    : history.providerId || '不明';

  card.innerHTML = `
    <div class="login-history-header">
      <h3>${escapeHtml(history.displayName || history.email || '匿名')}</h3>
      <p class="login-meta">${loginText}</p>
    </div>
    <div class="login-history-details">
      <p><strong>メールアドレス:</strong> ${escapeHtml(history.email || '---')}</p>
      <p><strong>認証方法:</strong> ${escapeHtml(providerName)}</p>
      <p><strong>ユーザーID:</strong> <code>${escapeHtml(history.userId || '---')}</code></p>
    </div>
  `;

  return card;
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
});