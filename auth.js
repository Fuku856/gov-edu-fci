/**
 * Firebase Authentication 管理
 * Googleログインと認証状態の管理を行う
 */

// DOM要素が読み込まれるまで待つ関数
function waitForElement(id, callback, maxAttempts = 50) {
  let attempts = 0;
  const checkElement = () => {
    attempts++;
    const element = document.getElementById(id);
    if (element) {
      callback(element);
    } else if (attempts < maxAttempts) {
      setTimeout(checkElement, 100);
    } else {
      console.warn(`要素 ${id} が見つかりませんでした`);
    }
  };
  checkElement();
}

// Firebaseが初期化されるまで待つ
function initializeAuth() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません');
    // Firebase SDKが読み込まれていない場合でも、初期状態を設定
    waitForElement('login-page', () => showLoginPage());
    waitForElement('main-content', () => hideMainContent());
    return;
  }
  
  // 認証状態の監視（要素の存在を確認してから実行）
  waitForElement('login-page', () => {
    waitForElement('main-content', () => {
      // 初期状態を設定（ログイン前はログインページを表示）
      console.log('初期状態を設定: ログインページを表示');
      showLoginPage();
      hideMainContent();
      
      // 認証状態の監視
      firebase.auth().onAuthStateChanged((user) => {
    console.log('認証状態が変更されました:', user ? user.email : 'ログアウト');
    
    if (user) {
      // ユーザーがログインしている
      const email = user.email;
      console.log('ログイン中のメールアドレス:', email);
      
      // メールドメインをチェック
      const isAllowed = isAllowedEmailDomain(email);
      console.log('メールアドレスのチェック結果:', isAllowed);
      console.log('許可されたメールドメイン:', ALLOWED_EMAIL_DOMAINS);
      
      if (isAllowed) {
        // 許可されたドメインの場合、サイトを表示
        console.log('認証成功: サイトを表示します');
        hideLoginPage();
        showMainContent();
        
        // ユーザー情報を表示（オプション）
        updateUserInfo(user);
      } else {
        // 許可されていないドメインの場合、ログアウト
        console.log('認証失敗: 許可されていないメールアドレス');
        alert('このサイトは学校関係者のみがアクセスできます。\n許可されていないメールアドレスです。\nメールアドレス: ' + email);
        firebase.auth().signOut().then(() => {
          showLoginPage();
          hideMainContent();
        });
      }
    } else {
      // ユーザーがログインしていない
      console.log('ユーザーがログインしていません');
      showLoginPage();
      hideMainContent();
    }
      });
    });
  });
}

// DOMが読み込まれた後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
  // DOMが既に読み込まれている場合
  initializeAuth();
}

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
  if (!email) {
    console.log('isAllowedEmailDomain: メールアドレスが空です');
    return false;
  }
  
  // 動作確認用: 特定のメールアドレスを許可する場合は、ここに追加
  const ALLOWED_EMAILS = [
    'hachi56kiku56@gmail.com',
    // 'your-email@gmail.com',  // 動作確認用: コメントアウトを外してメールアドレスを追加
  ];
  
  const emailLower = email.toLowerCase().trim();
  console.log('isAllowedEmailDomain: チェック中のメールアドレス:', emailLower);
  console.log('isAllowedEmailDomain: 許可されたメールアドレス:', ALLOWED_EMAILS);
  
  // 許可されたメールアドレスのリストをチェック
  if (ALLOWED_EMAILS.includes(emailLower)) {
    console.log('isAllowedEmailDomain: メールアドレスが許可リストに一致しました');
    return true;
  }
  
  // メールドメインをチェック
  const emailDomain = email.split('@')[1];
  console.log('isAllowedEmailDomain: メールドメイン:', emailDomain);
  console.log('isAllowedEmailDomain: 許可されたドメイン:', ALLOWED_EMAIL_DOMAINS);
  
  const domainAllowed = ALLOWED_EMAIL_DOMAINS.includes(emailDomain);
  console.log('isAllowedEmailDomain: ドメインチェック結果:', domainAllowed);
  
  return domainAllowed;
}

/**
 * ログインページを表示
 */
function showLoginPage() {
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.style.display = 'flex';
    console.log('showLoginPage: ログインページを表示しました');
  } else {
    console.warn('showLoginPage: ログインページの要素が見つかりません（login.htmlを使用している可能性があります）');
  }
}

/**
 * ログインページを非表示
 */
function hideLoginPage() {
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.style.display = 'none';
    console.log('hideLoginPage: ログインページを非表示にしました');
  } else {
    console.warn('hideLoginPage: ログインページの要素が見つかりません');
  }
}

/**
 * メインコンテンツを表示
 */
function showMainContent() {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.style.display = 'block';
    console.log('showMainContent: メインコンテンツを表示しました');
  } else {
    console.warn('showMainContent: メインコンテンツの要素が見つかりません（login.htmlを使用している可能性があります）');
    // login.htmlを使用している場合は、index.htmlにリダイレクト
    if (window.location.pathname.includes('login.html')) {
      console.log('login.htmlからindex.htmlにリダイレクトします');
      window.location.href = 'index.html';
      return;
    }
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
    console.log('hideMainContent: メインコンテンツを非表示にしました');
  } else {
    console.warn('hideMainContent: メインコンテンツの要素が見つかりません（login.htmlを使用している可能性があります）');
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

