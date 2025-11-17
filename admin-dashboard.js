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
  rejectedPosts: {
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

  // 却下済み投稿のページネーションボタンのイベントリスナー
  const rejectedPrevBtn = document.getElementById('rejected-prev-btn');
  const rejectedNextBtn = document.getElementById('rejected-next-btn');
  if (rejectedPrevBtn) {
    rejectedPrevBtn.addEventListener('click', () => {
      if (state.rejectedPosts.currentPage > 1) {
        state.rejectedPosts.currentPage--;
        renderRejectedPosts();
      }
    });
  }
  if (rejectedNextBtn) {
    rejectedNextBtn.addEventListener('click', () => {
      if (state.rejectedPosts.currentPage < state.rejectedPosts.totalPages) {
        state.rejectedPosts.currentPage++;
        renderRejectedPosts();
      }
    });
  }
}

async function refreshAdminDashboard() {
  await updateAdminStats();
  await loadPendingPosts();
  await loadRejectedPosts();
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

async function loadRejectedPosts() {
  const container = document.getElementById('rejected-posts');
  if (!container) return;

  try {
    // 30日以上前の却下済み投稿を削除
    await deleteOldRejectedPosts();

    const snapshot = await db
      .collection('posts')
      .where('status', '==', 'rejected')
      .orderBy('rejectedAt', 'desc')
      .limit(1000) // 最新1000件まで取得
      .get();

    const allPosts = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      allPosts.push({
        id: doc.id,
        title: data.title,
        content: data.content,
        authorId: data.authorId,
        authorName: data.authorName,
        createdAt: data.createdAt,
        rejectedAt: data.rejectedAt,
        rejectedBy: data.rejectedBy,
        rejectionReason: data.rejectionReason || ''
      });
    });

    state.rejectedPosts.allPosts = allPosts;
    state.rejectedPosts.totalPages = Math.max(1, Math.ceil(allPosts.length / ITEMS_PER_PAGE));
    state.rejectedPosts.currentPage = 1;

    renderRejectedPosts();
  } catch (error) {
    console.error('却下済み投稿の取得に失敗しました', error);
    container.innerHTML = '<p class="empty-message">却下済み投稿を読み込めませんでした。</p>';
  }
}

/**
 * 30日以上前の却下済み投稿を削除
 */
async function deleteOldRejectedPosts() {
  try {
    // 30日前の日時を計算
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = firebase.firestore.Timestamp.fromDate(thirtyDaysAgo);

    // 30日以上前の却下済み投稿を取得
    const oldPostsSnapshot = await db
      .collection('posts')
      .where('status', '==', 'rejected')
      .where('rejectedAt', '<', thirtyDaysAgoTimestamp)
      .limit(500) // 一度に削除する件数を制限（Firestoreの制限を考慮）
      .get();

    if (oldPostsSnapshot.empty) {
      return; // 削除するデータがない
    }

    // バッチ削除（Firestoreの制限により、1回のバッチで最大500件まで）
    const batch = db.batch();
    let deleteCount = 0;

    oldPostsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    await batch.commit();
    console.log(`${deleteCount}件の古い却下済み投稿を削除しました（30日以上前）`);

    // 500件以上ある場合は、再帰的に削除を続ける
    if (deleteCount === 500) {
      // 少し待ってから再度実行（レート制限を避けるため）
      await new Promise(resolve => setTimeout(resolve, 1000));
      await deleteOldRejectedPosts();
    }
  } catch (error) {
    console.error('古い却下済み投稿の削除に失敗しました:', error);
    // エラーが発生しても処理は続行
  }
}

function renderRejectedPosts() {
  const container = document.getElementById('rejected-posts');
  const paginationEl = document.getElementById('rejected-posts-pagination');
  const prevBtn = document.getElementById('rejected-prev-btn');
  const nextBtn = document.getElementById('rejected-next-btn');
  const pageInfo = document.getElementById('rejected-page-info');
  
  if (!container) return;

  const { allPosts, currentPage, totalPages } = state.rejectedPosts;
  
  if (allPosts.length === 0) {
    container.innerHTML = '<p class="empty-message">却下済み投稿はありません。</p>';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  // 現在のページの投稿を取得
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPosts = allPosts.slice(startIndex, endIndex);

  container.innerHTML = '';
  currentPosts.forEach((post) => {
    const card = createRejectedCard(post.id, post);
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

function createRejectedCard(postId, data) {
  const card = document.createElement('article');
  card.className = 'admin-post-card';

  // 投稿日時
  let createdAt = null;
  if (data.createdAt) {
    try {
      if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (data.createdAt.seconds) {
        createdAt = new Date(data.createdAt.seconds * 1000 + (data.createdAt.nanoseconds || 0) / 1000000);
      }
    } catch (error) {
      console.error('投稿日時の変換エラー:', error);
    }
  }
  const createdText = createdAt
    ? createdAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '投稿日時不明';

  // 却下日時
  let rejectedAt = null;
  if (data.rejectedAt) {
    try {
      if (data.rejectedAt.toDate && typeof data.rejectedAt.toDate === 'function') {
        rejectedAt = data.rejectedAt.toDate();
      } else if (data.rejectedAt instanceof Date) {
        rejectedAt = data.rejectedAt;
      } else if (data.rejectedAt.seconds) {
        rejectedAt = new Date(data.rejectedAt.seconds * 1000 + (data.rejectedAt.nanoseconds || 0) / 1000000);
      }
    } catch (error) {
      console.error('却下日時の変換エラー:', error);
    }
  }
  const rejectedText = rejectedAt
    ? rejectedAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '却下日時不明';

  card.innerHTML = `
    <div class="post-card-header">
      <h3>${escapeHtml(data.title || '無題の投稿')}</h3>
      <p class="post-meta">
        投稿者: ${escapeHtml(data.authorName || '匿名')}・投稿日時: ${createdText}<br>
        却下日時: ${rejectedText}
      </p>
    </div>
    <p class="post-content">${escapeHtml(data.content || '')}</p>
    ${data.rejectionReason ? `<p class="rejection-reason"><strong>却下理由:</strong> ${escapeHtml(data.rejectionReason)}</p>` : ''}
  `;

  return card;
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
  if (!container) {
    console.error('ログイン履歴コンテナが見つかりません');
    return;
  }

  try {
    console.log('ログイン履歴の読み込みを開始...');
    
    // 1週間以上前のログイン履歴を削除
    await deleteOldLoginHistory();

    console.log('ログイン履歴を取得中...');
    const snapshot = await db
      .collection('login_history')
      .orderBy('loginAt', 'desc')
      .limit(1000) // 最新1000件まで取得
      .get();

    console.log(`取得したログイン履歴: ${snapshot.size}件`);

    const allHistory = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      allHistory.push({
        id: doc.id,
        userId: data.userId,
        email: data.email,
        displayName: data.displayName,
        providerId: data.providerId,
        loginAt: data.loginAt, // FirestoreのTimestampオブジェクトをそのまま保持
        userAgent: data.userAgent,
        ipAddress: data.ipAddress
      });
    });

    console.log(`処理したログイン履歴: ${allHistory.length}件`);

    state.loginHistory.allHistory = allHistory;
    state.loginHistory.totalPages = Math.max(1, Math.ceil(allHistory.length / ITEMS_PER_PAGE));
    state.loginHistory.currentPage = 1;

    renderLoginHistory();
    console.log('ログイン履歴の表示を完了');
  } catch (error) {
    console.error('ログイン履歴の取得に失敗しました', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    container.innerHTML = `<p class="empty-message">ログイン履歴を読み込めませんでした。<br>エラー: ${error.message || error.code || '不明なエラー'}</p>`;
    if (paginationEl) paginationEl.style.display = 'none';
  }
}

/**
 * 1週間以上前のログイン履歴を削除
 */
async function deleteOldLoginHistory() {
  try {
    // 1週間前の日時を計算
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoTimestamp = firebase.firestore.Timestamp.fromDate(oneWeekAgo);

    // 1週間以上前のログイン履歴を取得
    const oldHistorySnapshot = await db
      .collection('login_history')
      .where('loginAt', '<', oneWeekAgoTimestamp)
      .limit(500) // 一度に削除する件数を制限（Firestoreの制限を考慮）
      .get();

    if (oldHistorySnapshot.empty) {
      return; // 削除するデータがない
    }

    // バッチ削除（Firestoreの制限により、1回のバッチで最大500件まで）
    const batch = db.batch();
    let deleteCount = 0;

    oldHistorySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    await batch.commit();
    console.log(`${deleteCount}件の古いログイン履歴を削除しました（1週間以上前）`);

    // 500件以上ある場合は、再帰的に削除を続ける
    if (deleteCount === 500) {
      // 少し待ってから再度実行（レート制限を避けるため）
      await new Promise(resolve => setTimeout(resolve, 1000));
      await deleteOldLoginHistory();
    }
  } catch (error) {
    console.error('古いログイン履歴の削除に失敗しました:', error);
    // エラーが発生しても処理は続行
  }
}

function renderLoginHistory() {
  const container = document.getElementById('login-history');
  const paginationEl = document.getElementById('login-history-pagination');
  const prevBtn = document.getElementById('history-prev-btn');
  const nextBtn = document.getElementById('history-next-btn');
  const pageInfo = document.getElementById('history-page-info');
  
  if (!container) {
    console.error('ログイン履歴コンテナが見つかりません（renderLoginHistory）');
    return;
  }

  const { allHistory, currentPage, totalPages } = state.loginHistory;
  
  console.log(`ログイン履歴を表示中: ${allHistory.length}件, 現在のページ: ${currentPage}/${totalPages}`);
  
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

  // FirestoreのTimestampオブジェクトをDateオブジェクトに変換
  let loginAt = null;
  if (history.loginAt) {
    try {
      // FirestoreのTimestampオブジェクトの場合
      if (history.loginAt.toDate && typeof history.loginAt.toDate === 'function') {
        loginAt = history.loginAt.toDate();
      } 
      // 既にDateオブジェクトの場合
      else if (history.loginAt instanceof Date) {
        loginAt = history.loginAt;
      }
      // Timestampオブジェクトのsecondsとnanosecondsプロパティがある場合
      else if (history.loginAt.seconds) {
        loginAt = new Date(history.loginAt.seconds * 1000 + (history.loginAt.nanoseconds || 0) / 1000000);
      }
      // 数値（ミリ秒）の場合
      else if (typeof history.loginAt === 'number') {
        loginAt = new Date(history.loginAt);
      }
    } catch (error) {
      console.error('ログイン日時の変換エラー:', error, history.loginAt);
    }
  }
  
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