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
      // 初期状態: 認証状態をチェックするまで何も表示しない
      // これにより、リロード時の一瞬のコンテンツ表示を防ぐ
      const loginPage = document.getElementById('login-page');
      const mainContent = document.getElementById('main-content');
      if (loginPage) {
        loginPage.style.display = 'none';
        loginPage.style.visibility = 'hidden';
        loginPage.style.opacity = '0';
      }
      if (mainContent) {
        mainContent.style.display = 'none';
        mainContent.style.visibility = 'hidden';
      }
      
      // 認証状態確認済みフラグを設定
      document.body.classList.add('auth-checked');
      
      // 認証状態の監視
      firebase.auth().onAuthStateChanged((user) => {
    console.log('認証状態が変更されました:', user ? user.email : 'ログアウト');
    
    if (user) {
      // ユーザーがログインしている
      const email = user.email;
      console.log('ログイン中のメールアドレス:', email);
      console.log('認証プロバイダー:', user.providerData.map(p => p.providerId));
      
      // GitHub認証でログインしている場合、開発者用のチェックを行う
      const isGitHubUser = isAllowedGitHubUser(user);
      console.log('GitHubユーザーのチェック結果:', isGitHubUser);
      
      // メールドメインをチェック（通常の学校アカウント用）
      const isAllowed = isAllowedEmailDomain(email);
      console.log('メールアドレスのチェック結果:', isAllowed);
      console.log('許可されたメールドメイン:', typeof ALLOWED_EMAIL_DOMAINS !== 'undefined' ? ALLOWED_EMAIL_DOMAINS : '未定義（firebase-config.jsを確認してください）');
      
      if (isGitHubUser || isAllowed) {
        // 許可されたユーザー（GitHub開発者または学校アカウント）の場合、サイトを表示
        console.log('認証成功: サイトを表示します', isGitHubUser ? '(GitHub開発者)' : '(学校アカウント)');
        hideLoginPage();
        showMainContent();
        
        // ユーザー情報を表示（ヘッダーにログアウトボタンを表示）
        updateUserInfo(user);
      } else {
        // 許可されていないユーザーの場合、ログアウト
        console.log('認証失敗: 許可されていないユーザー');
        hideUserInfo();
        const providerType = user.providerData.some(p => p.providerId === 'github.com') 
          ? 'GitHubアカウント' 
          : 'メールアドレス';
        alert('このサイトは学校関係者または開発者のみがアクセスできます。\n許可されていない' + providerType + 'です。\nメールアドレス: ' + email);
        firebase.auth().signOut().then(() => {
          showLoginPage();
          hideMainContent();
        });
      }
    } else {
      // ユーザーがログインしていない
      console.log('ユーザーがログインしていません');
      hideUserInfo();
      showLoginPage();
      hideMainContent();
      
      // ログインボタンの状態をリセット
      resetLoginButton();
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
 * GitHubログインを実行（開発者用）
 */
async function signInWithGitHub() {
  const provider = new firebase.auth.GithubAuthProvider();
  
  // GitHub認証に必要なスコープを追加（ユーザー名やメールアドレスを取得するため）
  provider.addScope('read:user');
  provider.addScope('user:email');
  
  try {
    // ログインボタンを無効化
    const loginButton = document.getElementById('github-login-btn');
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'ログイン中...';
    }
    
    // GitHubログインを実行
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    
    console.log('GitHubログイン成功:', user.email);
    console.log('GitHubプロバイダー情報:', result.credential);
    
  } catch (error) {
    console.error('GitHubログインエラー:', error);
    
    // エラーメッセージを表示
    const errorMessage = getErrorMessage(error.code);
    alert('GitHubログインに失敗しました: ' + errorMessage);
    
    // ログインボタンを再有効化
    const loginButton = document.getElementById('github-login-btn');
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'GitHubでログイン（開発者用）';
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
    hideUserInfo();
    showLoginPage();
    hideMainContent();
    
    // ログインボタンの状態をリセット
    resetLoginButton();
  } catch (error) {
    console.error('ログアウトエラー:', error);
    alert('ログアウトに失敗しました');
  }
}

/**
 * GitHubユーザーが許可されているかチェック
 */
function isAllowedGitHubUser(user) {
  if (!user) {
    console.log('isAllowedGitHubUser: ユーザーが空です');
    return false;
  }
  
  // GitHubプロバイダーでログインしているか確認
  const isGitHubProvider = user.providerData.some(
    provider => provider.providerId === 'github.com'
  );
  
  if (!isGitHubProvider) {
    // GitHubプロバイダーでログインしていない場合は、この関数では判定しない
    return false;
  }
  
  console.log('isAllowedGitHubUser: GitHubユーザーをチェック中');
  
  // 許可されたGitHubメールアドレスをチェック
  const allowedGitHubEmails = typeof ALLOWED_GITHUB_EMAILS !== 'undefined' 
    ? ALLOWED_GITHUB_EMAILS 
    : [];
  
  if (user.email) {
    const emailLower = user.email.toLowerCase().trim();
    if (allowedGitHubEmails.includes(emailLower)) {
      console.log('isAllowedGitHubUser: GitHubメールアドレスが許可リストに一致しました');
      return true;
    }
  }
  
  // GitHubユーザー名を取得（providerDataから）
  // 注意: Firebase Authenticationでは、GitHubユーザー名を直接取得できない場合があります
  // そのため、表示名（displayName）やメールアドレスから判定します
  const allowedGitHubUsernames = typeof ALLOWED_GITHUB_USERNAMES !== 'undefined' 
    ? ALLOWED_GITHUB_USERNAMES 
    : [];
  
  // 表示名からユーザー名を推測（GitHubの場合、表示名は通常ユーザー名）
  if (user.displayName) {
    const displayNameLower = user.displayName.toLowerCase().trim();
    if (allowedGitHubUsernames.some(username => 
      username.toLowerCase().trim() === displayNameLower
    )) {
      console.log('isAllowedGitHubUser: GitHubユーザー名が許可リストに一致しました');
      return true;
    }
  }
  
  // メールアドレスのローカル部分（@より前）からユーザー名を推測
  if (user.email) {
    const emailLocalPart = user.email.split('@')[0].toLowerCase().trim();
    if (allowedGitHubUsernames.some(username => 
      username.toLowerCase().trim() === emailLocalPart
    )) {
      console.log('isAllowedGitHubUser: メールアドレスから推測したGitHubユーザー名が許可リストに一致しました');
      return true;
    }
  }
  
  console.log('isAllowedGitHubUser: GitHubユーザーが許可リストに一致しませんでした');
  return false;
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
  // 注意: 個人のメールアドレスを追加する場合は、auth.local.js を使用してください
  // auth.local.js は .gitignore に含まれているため、GitHubに公開されません
  let ALLOWED_EMAILS = [
    // 個人のメールアドレスは auth.local.js に追加してください
    // 'your-email@gmail.com',  // 動作確認用: コメントアウトを外してメールアドレスを追加
  ];
  
  // 開発用設定ファイルから読み込む（存在する場合）
  // auth.local.js は .gitignore に含まれているため、GitHubに公開されません
  // ローカル環境でのテストに使用します
  if (typeof DEV_ALLOWED_EMAILS !== 'undefined') {
    ALLOWED_EMAILS = ALLOWED_EMAILS.concat(DEV_ALLOWED_EMAILS);
  }
  
  // 本番環境で許可する特定のメールアドレス（firebase-config.jsから読み込む）
  // ⚠️ 注意: このリストはGitHubに公開されます。テストが完了したら削除してください
  if (typeof PROD_ALLOWED_EMAILS !== 'undefined' && PROD_ALLOWED_EMAILS.length > 0) {
    ALLOWED_EMAILS = ALLOWED_EMAILS.concat(PROD_ALLOWED_EMAILS);
  }
  
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
  
  // ALLOWED_EMAIL_DOMAINSが定義されているか確認（firebase-config.jsから読み込まれる）
  // 未定義の場合は空配列を使用（セキュリティのため、すべて拒否）
  const allowedDomains = typeof ALLOWED_EMAIL_DOMAINS !== 'undefined' 
    ? ALLOWED_EMAIL_DOMAINS 
    : [];
  
  console.log('isAllowedEmailDomain: 許可されたドメイン:', allowedDomains);
  
  const domainAllowed = allowedDomains.includes(emailDomain);
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
    loginPage.style.visibility = 'visible';
    // トランジション効果のため、少し遅延してopacityを変更
    setTimeout(() => {
      loginPage.style.opacity = '1';
    }, 10);
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
    loginPage.style.opacity = '0';
    // トランジション効果のため、少し遅延して非表示
    setTimeout(() => {
      loginPage.style.display = 'none';
      loginPage.style.visibility = 'hidden';
    }, 300);
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
    // 表示を確実にするため、少し遅延してvisibilityを変更
    setTimeout(() => {
      mainContent.style.visibility = 'visible';
    }, 10);
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
    mainContent.style.visibility = 'hidden';
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
 * ユーザー情報を更新（ヘッダーにログアウトボタンを表示）
 */
function updateUserInfo(user) {
  const userInfo = document.getElementById('user-info');
  const mobileUserInfo = document.getElementById('mobile-user-info');
  const userName = user.displayName || user.email.split('@')[0];
  
  // モバイル表示用（モバイルメニュー内に表示）
  // モバイルでは常にモバイルメニュー内に表示
  if (mobileUserInfo) {
    mobileUserInfo.style.display = 'block';
    mobileUserInfo.innerHTML = `
      <div style="text-align: center; color: white;">
        <p style="margin-bottom: 1rem; font-size: 0.9rem; opacity: 0.9;">${userName}</p>
        <button onclick="signOut()" class="mobile-nav-link" style="width: 100%; background: #dc3545; color: white; border: 1px solid #c82333; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500; transition: all 0.3s;" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">ログアウト</button>
      </div>
    `;
    console.log('ユーザー情報を更新しました（モバイル）:', userName);
  }
  
  // デスクトップ表示用（ヘッダー）
  // モバイル（768px以下）では非表示にする（CSSで制御）
  if (userInfo && window.innerWidth > 768) {
    userInfo.style.display = 'flex';
    userInfo.style.alignItems = 'center';
    userInfo.style.gap = '1rem';
    userInfo.innerHTML = `
      <span style="color: white; font-size: 0.9rem;">${userName}</span>
      <button onclick="signOut()" style="background: #dc3545; color: white; border: 1px solid #c82333; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s; font-weight: 500;" onmouseover="this.style.background='#c82333'; this.style.borderColor='#bd2130'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#dc3545'; this.style.borderColor='#c82333'; this.style.transform='translateY(0)'">ログアウト</button>
    `;
    console.log('ユーザー情報を更新しました（デスクトップ）:', userName);
  } else if (userInfo) {
    // モバイルの場合は非表示にする
    userInfo.style.display = 'none';
  }
}

/**
 * ユーザー情報を非表示（ログアウト時）
 */
function hideUserInfo() {
  const userInfo = document.getElementById('user-info');
  const mobileUserInfo = document.getElementById('mobile-user-info');
  
  if (userInfo) {
    userInfo.style.display = 'none';
    userInfo.innerHTML = '';
  }
  
  if (mobileUserInfo) {
    mobileUserInfo.style.display = 'none';
    mobileUserInfo.innerHTML = '';
  }
}

/**
 * ログインボタンの状態をリセット
 */
function resetLoginButton() {
  const loginButton = document.getElementById('google-login-btn');
  if (loginButton) {
    loginButton.disabled = false;
    // SVGアイコンを保持したままテキストをリセット
    const svg = loginButton.querySelector('svg');
    if (svg) {
      loginButton.innerHTML = svg.outerHTML + ' Googleでログイン';
    } else {
      loginButton.textContent = 'Googleでログイン';
    }
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
window.signInWithGitHub = signInWithGitHub;
window.signOut = signOut;
window.getIdToken = getIdToken;

