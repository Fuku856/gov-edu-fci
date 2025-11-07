/**
 * Firebase Authentication 管理
 * Googleログインと認証状態の管理を行う
 */

// Firebaseが初期化されるまで待つ
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません');
    return;
  }
  
  // 認証状態の監視
  firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // ユーザーがログインしている
    const email = user.email;
    
    // メールドメインをチェック
    if (isAllowedEmailDomain(email)) {
      // 許可されたドメインの場合、サイトを表示
      hideLoginPage();
      showMainContent();
      
      // ユーザー情報を表示（オプション）
      updateUserInfo(user);
    } else {
      // 許可されていないドメインの場合、ログアウト
      alert('このサイトは学校関係者のみがアクセスできます。\n許可されていないメールアドレスです。');
      firebase.auth().signOut().then(() => {
        showLoginPage();
        hideMainContent();
      });
    }
  } else {
    // ユーザーがログインしていない
    showLoginPage();
    hideMainContent();
  }
  });
});

/**
 * Googleログインを実行
 */
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  try {
    // ログインボタンを無効化
    const loginButton = document.getElementById('google-login-btn');
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'ログイン中...';
    }
    
    // Googleログインを実行
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    
    console.log('ログイン成功:', user.email);
    
  } catch (error) {
    console.error('ログインエラー:', error);
    
    // エラーメッセージを表示
    const errorMessage = getErrorMessage(error.code);
    alert('ログインに失敗しました: ' + errorMessage);
    
    // ログインボタンを再有効化
    const loginButton = document.getElementById('google-login-btn');
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Googleでログイン';
    }
  }
}

/**
 * ログアウトを実行
 */
async function signOut() {
  try {
    await firebase.auth().signOut();
    console.log('ログアウト成功');
    showLoginPage();
    hideMainContent();
  } catch (error) {
    console.error('ログアウトエラー:', error);
    alert('ログアウトに失敗しました');
  }
}

/**
 * メールドメインが許可されているかチェック
 */
function isAllowedEmailDomain(email) {
  if (!email) return false;
  
  const emailDomain = email.split('@')[1];
  return ALLOWED_EMAIL_DOMAINS.includes(emailDomain);
}

/**
 * ログインページを表示
 */
function showLoginPage() {
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.style.display = 'flex';
  }
}

/**
 * ログインページを非表示
 */
function hideLoginPage() {
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.style.display = 'none';
  }
}

/**
 * メインコンテンツを表示
 */
function showMainContent() {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.style.display = 'block';
  }
  
  // body要素のクラスを削除（ログイン状態のスタイルを適用）
  document.body.classList.remove('logged-out');
  document.body.classList.add('logged-in');
}

/**
 * メインコンテンツを非表示
 */
function hideMainContent() {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.style.display = 'none';
  }
  
  // body要素のクラスを追加（ログアウト状態のスタイルを適用）
  document.body.classList.remove('logged-in');
  document.body.classList.add('logged-out');
}

/**
 * ユーザー情報を更新
 */
function updateUserInfo(user) {
  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="user-profile">
        <img src="${user.photoURL || ''}" alt="プロフィール画像" class="user-avatar">
        <span class="user-name">${user.displayName || user.email}</span>
        <button onclick="signOut()" class="logout-btn">ログアウト</button>
      </div>
    `;
  }
}

/**
 * エラーメッセージを取得
 */
function getErrorMessage(errorCode) {
  const errorMessages = {
    'auth/popup-closed-by-user': 'ログインポップアップが閉じられました',
    'auth/cancelled-popup-request': 'ログインがキャンセルされました',
    'auth/network-request-failed': 'ネットワークエラーが発生しました',
    'auth/popup-blocked': 'ポップアップがブロックされています',
    'auth/unauthorized-domain': 'このドメインは許可されていません'
  };
  
  return errorMessages[errorCode] || '不明なエラーが発生しました';
}

/**
 * Firebase IDトークンを取得（サーバー側での検証用）
 */
async function getIdToken() {
  const user = firebase.auth().currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
}

// グローバルに公開
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.getIdToken = getIdToken;

