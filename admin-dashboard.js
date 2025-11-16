const db = firebase.firestore();
const ADMIN_DAILY_POST_LIMIT = 30;
const ADMIN_DAILY_VOTE_LIMIT = 3000;

let adminInitialized = false;
let unsubscribePending = null;

const state = {
  currentUser: null,
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
}

async function refreshAdminDashboard() {
  await updateAdminStats();
  subscribePendingPosts();
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

function subscribePendingPosts() {
  const container = document.getElementById('pending-posts');
  const pendingCountEl = document.getElementById('admin-pending-count');
  if (!container) return;

  if (unsubscribePending) {
    unsubscribePending();
  }

  unsubscribePending = db
    .collection('posts')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .onSnapshot(
      (snapshot) => {
        container.innerHTML = '';
        const pendingCount = snapshot.size;
        if (pendingCountEl) pendingCountEl.textContent = `${pendingCount} 件`;

        if (snapshot.empty) {
          container.innerHTML = '<p class="empty-message">承認待ちの投稿はありません。</p>';
          return;
        }

        snapshot.forEach((doc) => {
          const card = createPendingCard(doc.id, doc.data());
          container.appendChild(card);
        });
      },
      (error) => {
        console.error('承認待ち投稿の取得に失敗しました', error);
        container.innerHTML = '<p class="empty-message">投稿を読み込めませんでした。</p>';
        if (pendingCountEl) pendingCountEl.textContent = '---';
      }
    );
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