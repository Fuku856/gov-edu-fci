const db = firebase.firestore();
const DAILY_POST_LIMIT = 30;
const DAILY_VOTE_LIMIT = 3000;

let currentUser = null;
let boardInitialized = false;
let unsubscribePosts = null;
const voteSubscriptions = new Map();
let currentSortBy = 'newest';

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
      email: user.email
    });

    updateUserAvatar(user);

    if (!boardInitialized) {
      setupBoardPage();
      boardInitialized = true;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    await refreshBoardData(currentSortBy);
  });
});

function updateUserAvatar(user) {
  const initialEl = document.getElementById('current-user-initial');
  if (initialEl) {
    const name = user.displayName || user.email || '?';
    initialEl.textContent = name.charAt(0).toUpperCase();
  }
}

function setupBoardPage() {
  // 投稿フォーム
  const postForm = document.getElementById('post-form');
  if (postForm) {
    postForm.addEventListener('submit', handlePostSubmit);
  }

  // FAB
  const fabBtn = document.getElementById('fab-post');
  const postModal = document.getElementById('post-modal');
  const closePostModalBtn = document.getElementById('close-post-modal');

  if (fabBtn && postModal) {
    fabBtn.addEventListener('click', () => {
      postModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closePostModalBtn && postModal) {
    closePostModalBtn.addEventListener('click', () => {
      postModal.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // 情報メニュー
  const infoBtn = document.getElementById('info-menu-btn');
  const infoModal = document.getElementById('info-modal');
  const closeInfoModalBtn = document.getElementById('close-info-modal');

  if (infoBtn && infoModal) {
    infoBtn.addEventListener('click', () => {
      updateDailyUsage();
      infoModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeInfoModalBtn && infoModal) {
    closeInfoModalBtn.addEventListener('click', () => {
      infoModal.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // モーダル外側クリック
  window.addEventListener('click', (e) => {
    if (e.target === postModal) {
      postModal.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (e.target === infoModal) {
      infoModal.classList.remove('open');
      document.body.style.overflow = '';
    }
    // ソートメニューを閉じる
    const sortMenu = document.getElementById('sort-menu');
    const sortBtn = document.getElementById('sort-trigger');
    if (sortMenu && sortBtn && !sortMenu.contains(e.target) && !sortBtn.contains(e.target)) {
      sortMenu.classList.remove('show');
    }
  });

  // ソートメニュー制御
  const sortBtn = document.getElementById('sort-trigger');
  const sortMenu = document.getElementById('sort-menu');
  const sortOptions = document.querySelectorAll('.sort-option');

  if (sortBtn && sortMenu) {
    sortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sortMenu.classList.toggle('show');
    });

    sortOptions.forEach(option => {
      option.addEventListener('click', () => {
        const sortBy = option.dataset.sort;

        // 選択状態の更新
        sortOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        currentSortBy = sortBy;
        refreshBoardData(currentSortBy);

        sortMenu.classList.remove('show');
      });
    });
  }
}

async function refreshBoardData(sortBy = 'newest') {
  currentSortBy = sortBy;
  await updateDailyUsage();
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
  const postCountEl = document.getElementById('daily-post-count');
  const voteCountEl = document.getElementById('daily-vote-count');

  if (!postCountEl || !voteCountEl || !currentUser) return;

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
      postCountEl.textContent = '-';
      voteCountEl.textContent = '-';
    });
}

function subscribeApprovedPosts(sortBy = 'newest') {
  const container = document.getElementById('posts-container');
  if (!container) return;

  const authUser = firebase.auth().currentUser;
  if (!authUser) {
    container.innerHTML = '<div style="padding: 20px; text-align: center;">認証されていません。ログインしてください。</div>';
    return;
  }

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
        container.innerHTML = '<div style="padding: 20px; text-align: center;">まだ承認済みの投稿はありません。<br>右下のボタンから投稿してみましょう！</div>';
        return;
      }

      let posts = [];
      snapshot.forEach((doc) => {
        posts.push({
          id: doc.id,
          data: doc.data()
        });
      });

      posts.sort((a, b) => {
        const dataA = a.data;
        const dataB = b.data;

        const getCount = (data, key) => {
          const val = data[key];
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };

        const getTime = (data) => {
          if (!data.createdAt) return 0;
          if (typeof data.createdAt.toMillis === 'function') return data.createdAt.toMillis();
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

        switch (sortBy) {
          case 'newest': return timeB - timeA;
          case 'oldest': return timeA - timeB;
          case 'popular':
            if (agreeB !== agreeA) return agreeB - agreeA;
            if (neutralB !== neutralA) return neutralB - neutralA;
            if (disagreeB !== disagreeA) return disagreeB - disagreeA;
            return timeB - timeA;
          case 'controversial':
            if (disagreeB !== disagreeA) return disagreeB - disagreeA;
            if (neutralB !== neutralA) return neutralB - neutralA;
            if (agreeB !== agreeA) return agreeB - agreeA;
            return timeB - timeA;
          default: return timeB - timeA;
        }
      });

      posts.forEach((post) => {
        const card = createPostCard(post.id, post.data);
        container.appendChild(card);
        subscribeToVotes(post.id, card);
      });
    },
    (error) => {
      console.error('投稿の取得に失敗しました', error);
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">投稿を読み込めませんでした。</div>';
    }
  );
}

function repairVoteCounts() {
  db.collection('posts').where('status', '==', 'approved').get()
    .then(async (snapshot) => {
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
        const data = doc.data();
        if (data.agreeCount !== agree || data.disagreeCount !== disagree || data.neutralCount !== neutral) {
          updates.push(doc.ref.update({ agreeCount: agree, neutralCount: neutral, disagreeCount: disagree }));
        }
      }
      if (updates.length > 0) await Promise.all(updates);
    })
    .catch(console.error);
}

function createPostCard(postId, data) {
  const card = document.createElement('article');
  card.className = 'post-card';

  const createdAt = data.createdAt ? data.createdAt.toDate() : null;
  const createdText = createdAt
    ? createdAt.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const authorName = data.authorName || '匿名';
  const authorInitial = authorName.charAt(0).toUpperCase();

  card.innerHTML = `
    <div class="post-avatar">${escapeHtml(authorInitial)}</div>
    <div class="post-body">
      <div class="post-header">
        <span class="post-author-name">${escapeHtml(authorName)}</span>
        <span class="post-meta">・${createdText}</span>
      </div>
      <div class="post-content">${escapeHtml(data.content || '')}</div>
      
      <div class="post-actions">
        <button class="action-item agree" data-action="agree" data-post-id="${postId}" aria-label="賛成">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <span class="vote-count" data-vote="agree">0</span>
        </button>

        <button class="action-item neutral" data-action="neutral" data-post-id="${postId}" aria-label="中立">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span class="vote-count" data-vote="neutral">0</span>
        </button>

        <button class="action-item disagree" data-action="disagree" data-post-id="${postId}" aria-label="反対">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
          <span class="vote-count" data-vote="disagree">0</span>
        </button>
      </div>
    </div>
  `;

  // イベントデリゲーションではなく、個別に設定して確実性を高める
  // かつ、擬似要素クリックも拾えるように親要素で判定
  card.querySelectorAll('.action-item').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleVoteWithConfirm(postId, button.dataset.action);
    });
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
  const container = card.querySelector('.post-actions');
  if (container) {
    container.querySelector('[data-vote="agree"]').textContent = counts.agree;
    container.querySelector('[data-vote="neutral"]').textContent = counts.neutral;
    container.querySelector('[data-vote="disagree"]').textContent = counts.disagree;
  }

  const buttons = card.querySelectorAll('.action-item');
  buttons.forEach((btn) => {
    if (!currentUser) {
      btn.disabled = true;
      btn.classList.remove('active');
      return;
    }

    const isSelected = userVoteType === btn.dataset.action;

    if (userVoteType) {
      // 投票済みの場合
      btn.disabled = true; // ボタンとしては無効化
      btn.style.pointerEvents = 'none'; // クリック不可に

      if (isSelected) {
        btn.classList.add('active');
        btn.style.opacity = '1';
      } else {
        btn.classList.remove('active');
        btn.style.opacity = '0.5';
      }
    } else {
      // 未投票の場合
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.classList.remove('active');
      btn.style.opacity = '1';
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
  const submitBtn = form.querySelector('button[type="submit"]');

  const title = (titleInput.value || '').trim();
  const content = (contentInput.value || '').trim();

  if (!title || !content) {
    feedback.textContent = 'タイトルと内容は必須です。';
    return;
  }

  submitBtn.disabled = true;
  feedback.textContent = '送信中...';

  try {
    await createPost(title, content);
    feedback.textContent = '';
    form.reset();

    document.getElementById('post-modal').classList.remove('open');
    document.body.style.overflow = '';

    alert('投稿を受け付けました。承認までしばらくお待ちください。');
    await updateDailyUsage();
  } catch (error) {
    console.error('投稿に失敗しました', error);
    feedback.textContent = error.message || '投稿に失敗しました。';
  } finally {
    submitBtn.disabled = false;
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

// 独自ダイアログを使った投票確認
function handleVoteWithConfirm(postId, voteType) {
  if (!currentUser) return;

  const dialog = document.getElementById('confirm-dialog');
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!dialog || !okBtn || !cancelBtn) {
    console.error('確認ダイアログの要素が見つかりません');
    return;
  }

  // ダイアログ表示
  dialog.classList.add('open');
  document.body.style.overflow = 'hidden';

  // イベントリスナーの一時的な定義（重複登録を防ぐため、新しい関数を作成して登録・削除）
  const handleOk = async () => {
    cleanup();
    try {
      await submitVote(postId, voteType);
      await updateDailyUsage();
    } catch (error) {
      console.error('投票に失敗しました', error);
      alert(error.message || '投票に失敗しました。');
    }
  };

  const handleCancel = () => {
    cleanup();
  };

  const cleanup = () => {
    dialog.classList.remove('open');
    document.body.style.overflow = '';
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
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