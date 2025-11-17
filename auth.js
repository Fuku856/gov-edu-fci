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
      
      // 認証状態確認済みフラグは、認証チェック完了後に追加
      // これにより、読み込み中のちらつきを防ぐ
      
      // タイムアウト処理：認証チェックが10秒以内に完了しない場合、ローディング画面を非表示にする
      const authCheckTimeout = setTimeout(() => {
        console.warn('認証チェックがタイムアウトしました。ローディング画面を非表示にします。');
        document.body.classList.add('auth-checked');
      }, 10000);
      
      // 認証状態の監視
      firebase.auth().onAuthStateChanged((user) => {
        // タイムアウトをクリア
        clearTimeout(authCheckTimeout);
        
        // 非同期処理を実行するための即時実行関数
        (async () => {
          try {
            if (user) {
            // ユーザーがログインしている
            const userEmail = user.email;
            
            // GitHub認証でログインしている場合、開発者用のチェックを行う
            console.log('認証状態変更: ユーザーがログインしました', user.email, user.uid);
            
            // 認証チェックを並列化して高速化
            const [isGitHubUser, isAllowed] = await Promise.all([
              isAllowedGitHubUser(user),
              Promise.resolve(isAllowedEmailDomain(userEmail))
            ]);
            
            console.log('GitHubユーザーチェック結果:', isGitHubUser);
            console.log('メールドメインチェック結果:', isAllowed);
            
            // GitHub認証でログインし、許可されたGitHubユーザー名の場合、allowed_usersコレクションに自動追加を試みる
            if (isGitHubUser) {
              const isGitHubProvider = user.providerData.some(
                provider => provider.providerId === 'github.com'
              );
              
              if (isGitHubProvider) {
                try {
                  // GitHubユーザー名を取得
                  const githubUsername = await getGitHubUsernameFromUser(user);
                  
                  if (githubUsername) {
                    // allowed_usersコレクションに追加を試みる（既に存在する場合はスキップ）
                    const allowedUserRef = firebase.firestore()
                      .collection('allowed_users')
                      .doc(user.uid);
                    
                    const allowedUserDoc = await allowedUserRef.get();
                    
                    if (!allowedUserDoc.exists) {
                      // まだ登録されていない場合、追加を試みる
                      try {
                        await allowedUserRef.set({
                          userId: user.uid,
                          email: user.email || '',
                          displayName: user.displayName || githubUsername,
                          githubUsername: githubUsername,
                          provider: 'github.com',
                          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                          autoAdded: true
                        }, { merge: true });
                        console.log('GitHubユーザーをallowed_usersコレクションに追加しました:', githubUsername);
                      } catch (addError) {
                        // 権限エラーの場合、管理者が手動で追加する必要がある
                        if (addError.code === 'permission-denied') {
                          console.warn('allowed_usersコレクションへの追加に権限がありません。管理者に連絡してください。');
                        } else {
                          console.error('allowed_usersコレクションへの追加エラー:', addError);
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error('GitHubユーザー情報の取得エラー:', error);
                }
              }
            }
            
            // サーバー側（Firestore）での認証チェックを試行
            // これにより、クライアント側のチェックを回避してもFirestoreへのアクセスが拒否される
            // メールドメインチェックとFirestoreチェックを並列化して高速化
            let isServerAllowed = false;
            const isSchoolDomain = userEmail && (
              userEmail.toLowerCase().endsWith('@fcihs-satoyama.ed.jp') ||
              userEmail.toLowerCase().endsWith('@fcidux.dpdns.org')
            );
            
            try {
              // Firestoreのallowed_usersコレクションにアクセスを試みる
              // セキュリティルールで保護されているため、許可されていないユーザーはアクセスできない
              const allowedUserDoc = await firebase.firestore()
                .collection('allowed_users')
                .doc(user.uid)
                .get();
              
              if (allowedUserDoc.exists) {
                isServerAllowed = true;
              } else if (isSchoolDomain) {
                // allowed_usersに存在しないが、学校のメールドメインまたはテスト用ドメインの場合
                // Firestoreセキュリティルールでメールドメイン（@fcihs-satoyama.ed.jp または @fcidux.dpdns.org）が許可されている
                isServerAllowed = true;
              }
            } catch (error) {
              // 権限エラーの場合、許可されていないユーザー（ただし、学校ドメインの場合は許可）
              if (error.code === 'permission-denied') {
                isServerAllowed = isSchoolDomain; // 学校ドメインなら許可
              } else {
                console.error('サーバー側認証チェックエラー:', error);
                // エラーの場合は、メールドメインをチェック（フォールバック）
                isServerAllowed = isSchoolDomain;
              }
            }
            
            // GitHub認証の場合、自動登録処理が実行されているため、少し待ってから再チェック
            if (!isServerAllowed && isGitHubUser) {
              console.log('GitHubユーザーの自動登録を待機中...');
              // 自動登録処理が完了するまで最大3秒待機（500ms間隔で6回チェック）
              for (let i = 0; i < 6; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                try {
                  const allowedUserDoc = await firebase.firestore()
                    .collection('allowed_users')
                    .doc(user.uid)
                    .get();
                  if (allowedUserDoc.exists) {
                    console.log('GitHubユーザーがallowed_usersコレクションに登録されました');
                    isServerAllowed = true;
                    break;
                  }
                } catch (error) {
                  console.error('GitHub認証後の再チェックエラー:', error);
                }
              }
              if (!isServerAllowed) {
                console.warn('GitHubユーザーの自動登録が完了しませんでした');
              }
            }
            
            console.log('サーバー側認証チェック結果:', isServerAllowed);
            
            // サーバー側のチェックを優先
            // サーバー側で許可されていない場合、クライアント側のチェックは使用しない（セキュリティのため）
            // ただし、学校のメールドメイン（@fcihs-satoyama.ed.jp）またはテスト用ドメイン（@fcidux.dpdns.org）の場合は、Firestoreセキュリティルールで許可されているため、isServerAllowedがtrueになっている
            if (isServerAllowed) {
              // 許可されたユーザー（GitHub開発者または学校アカウント）の場合
              
              // login.htmlページの場合、リダイレクト先のURLに遷移
              const urlParams = new URLSearchParams(window.location.search);
              const redirectUrl = urlParams.get('redirect');
              
              // login.htmlページかどうかをチェック（パスの形式が異なる可能性があるため、複数のパターンをチェック）
              const isLoginPage = window.location.pathname.includes('login') || 
                                  window.location.pathname.endsWith('/login') ||
                                  window.location.pathname.endsWith('/login.html') ||
                                  window.location.pathname === '/login' ||
                                  window.location.pathname === '/login.html' ||
                                  window.location.href.includes('login.html') ||
                                  window.location.href.includes('/login');
              
              if (redirectUrl && isLoginPage) {
                // 元のページにリダイレクト
                console.log('認証成功: login.htmlページからリダイレクトします');
                console.log('リダイレクト先:', redirectUrl);
                console.log('現在のパス:', window.location.pathname);
                console.log('現在のURL:', window.location.href);
                
                // 認証処理が完全に完了するまで待機（GitHub認証の自動登録処理も含む）
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // リダイレクト実行
                window.location.href = redirectUrl;
                return; // リダイレクトするので、以降の処理は実行しない
              } else if (isLoginPage && !redirectUrl) {
                // redirectパラメータがない場合、index.htmlにリダイレクト
                console.log('認証成功: redirectパラメータがないため、index.htmlにリダイレクトします');
                await new Promise(resolve => setTimeout(resolve, 300));
                window.location.href = 'index.html';
                return;
              }
              
              // 通常のページの場合、サイトを表示
              // auth-checkedクラスを追加して、CSSで一括表示
              document.body.classList.add('auth-checked');
              
              // 少し待ってから要素を表示（CSSアニメーションが正常に動作するように）
              await new Promise(resolve => setTimeout(resolve, 10));
              
              hideLoginPage();
              showMainContent();
              
              // ユーザー情報を表示（ヘッダーにログアウトボタンを表示）
              await updateUserInfo(user);
              
              // ログイン履歴を保存
              await saveLoginHistory(user);
            } else {
              // 許可されていないユーザーの場合、ログアウトしてログインページにリダイレクト
              hideUserInfo();
              const providerType = user.providerData.some(p => p.providerId === 'github.com') 
                ? 'GitHubアカウント' 
                : 'メールアドレス';
              alert('このサイトは学校関係者または開発者のみがアクセスできます。\n許可されていない' + providerType + 'です。\nメールアドレス: ' + userEmail);
              firebase.auth().signOut().then(() => {
                // ログインページにリダイレクト（redirectパラメータを除去して無限リダイレクトを防ぐ）
                const url = new URL(window.location.href);
                const redirectParam = url.searchParams.get('redirect');
                let redirectUrl = url.origin + url.pathname;
                
                // redirectパラメータがあり、それがlogin.htmlでない場合、そのURLを使用
                if (redirectParam && !redirectParam.includes('login.html')) {
                  redirectUrl = redirectParam;
                }
                
                const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
                window.location.href = loginUrl;
              });
            }
          } else {
            // ユーザーがログインしていない
            // ログインページ（login.html）にリダイレクト
            // 現在のURLをクエリパラメータに保存して、認証後に元のページに戻れるようにする
            // login.htmlページでない場合のみリダイレクト
            if (!window.location.pathname.includes('login.html')) {
              // 現在のURLからredirectパラメータを除去（無限リダイレクトを防ぐ）
              const url = new URL(window.location.href);
              const redirectParam = url.searchParams.get('redirect');
              
              // redirectパラメータがない場合、またはredirect先がlogin.htmlでない場合のみ、現在のURLをredirectパラメータに設定
              let redirectUrl = window.location.href;
              
              // 既にredirectパラメータがあり、それがlogin.htmlを指していない場合、そのURLを使用
              if (redirectParam && !redirectParam.includes('login.html')) {
                redirectUrl = redirectParam;
              } else if (redirectParam && redirectParam.includes('login.html')) {
                // redirect先がlogin.htmlの場合、パラメータなしの現在のページのベースURLを使用
                redirectUrl = url.origin + url.pathname;
              }
              
              // auth-checkedクラスを削除してメインコンテンツを非表示にしてからリダイレクト
              document.body.classList.remove('auth-checked');
              const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
              window.location.href = loginUrl;
              return; // リダイレクトするので、以降の処理は実行しない
            }
            
            // login.htmlページの場合は、ログインページを表示
            document.body.classList.remove('auth-checked');
            hideUserInfo();
            showLoginPage();
            hideMainContent();
            
            // ログインボタンの状態をリセット
            resetLoginButton();
            
            // login.htmlページの場合、ローディング画面を非表示にする
            document.body.classList.add('auth-checked');
          }
          
          // 認証チェック完了後、必ずauth-checkedクラスを追加してローディング画面を非表示にする
          // （エラーが発生した場合でも、ローディング画面が残らないようにする）
          if (!document.body.classList.contains('auth-checked')) {
            document.body.classList.add('auth-checked');
          }
        } catch (error) {
          console.error('認証チェック中にエラーが発生しました:', error);
          // エラーが発生した場合でも、ローディング画面を非表示にする
          document.body.classList.add('auth-checked');
          
          // ログインしていない場合、ログインページにリダイレクト
          if (!firebase.auth().currentUser) {
            const isLoginPageCheck = window.location.pathname.includes('login') || 
                                     window.location.pathname.endsWith('/login') ||
                                     window.location.pathname.endsWith('/login.html') ||
                                     window.location.pathname === '/login' ||
                                     window.location.pathname === '/login.html' ||
                                     window.location.href.includes('login.html') ||
                                     window.location.href.includes('/login');
            
            if (!isLoginPageCheck) {
              // redirectパラメータを除去して無限リダイレクトを防ぐ
              const url = new URL(window.location.href);
              const redirectParam = url.searchParams.get('redirect');
              let redirectUrl = url.origin + url.pathname;
              
              if (redirectParam && !redirectParam.includes('login.html')) {
                redirectUrl = redirectParam;
              }
              
              const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
              window.location.href = loginUrl;
            }
          }
        }
        })(); // 即時実行関数の終了
      }, (error) => {
        // onAuthStateChangedのエラーハンドラー
        console.error('認証状態の監視中にエラーが発生しました:', error);
        clearTimeout(authCheckTimeout);
        // エラーが発生した場合でも、ローディング画面を非表示にする
        document.body.classList.add('auth-checked');
        
        // ログインページにリダイレクト（redirectパラメータを除去して無限リダイレクトを防ぐ）
        const isLoginPageCheck = window.location.pathname.includes('login') || 
                                 window.location.pathname.endsWith('/login') ||
                                 window.location.pathname.endsWith('/login.html') ||
                                 window.location.pathname === '/login' ||
                                 window.location.pathname === '/login.html' ||
                                 window.location.href.includes('login.html') ||
                                 window.location.href.includes('/login');
        
        if (!isLoginPageCheck) {
          const url = new URL(window.location.href);
          const redirectParam = url.searchParams.get('redirect');
          let redirectUrl = url.origin + url.pathname;
          
          if (redirectParam && !redirectParam.includes('login.html')) {
            redirectUrl = redirectParam;
          }
          
          const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
          window.location.href = loginUrl;
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
      // SVGロゴを保持したままテキストのみ変更
      const svg = loginButton.querySelector('svg');
      const textSpan = loginButton.querySelector('span');
      if (svg && textSpan) {
        // span要素がある場合（index.html、login.html）、テキストのみ変更
        textSpan.textContent = 'ログイン中...';
      } else if (svg) {
        // SVGはあるがspanがない場合、テキストノードを更新
        // 既存のテキストノードを削除
        const textNodes = [];
        for (let node of loginButton.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
          }
        }
        textNodes.forEach(node => node.remove());
        // 新しいテキストを追加
        loginButton.appendChild(document.createTextNode(' ログイン中...'));
      } else {
        loginButton.textContent = 'ログイン中...';
      }
    }
    
    // Googleログインを実行
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    
    
  } catch (error) {
    console.error('ログインエラー:', error);
    
    // エラーメッセージを表示
    const errorMessage = getErrorMessage(error.code);
    alert('ログインに失敗しました: ' + errorMessage);
    
    // ログインボタンを再有効化
    const loginButton = document.getElementById('google-login-btn');
    if (loginButton) {
      loginButton.disabled = false;
      // resetLoginButton関数を使用してリセット（一貫性のため）
      resetLoginButton();
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
      // SVGロゴを保持したままテキストのみ変更
      const svg = loginButton.querySelector('svg');
      const textSpan = loginButton.querySelector('span');
      if (svg && textSpan) {
        // span要素がある場合（index.html）、テキストのみ変更
        textSpan.textContent = 'ログイン中...';
      } else if (svg) {
        // SVGはあるがspanがない場合（login.html）、テキストノードを更新
        const textNodes = [];
        for (let node of loginButton.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
          }
        }
        textNodes.forEach(node => node.remove());
        // 新しいテキストを追加
        loginButton.appendChild(document.createTextNode(' ログイン中...'));
      } else {
        loginButton.textContent = 'ログイン中...';
      }
    }
    
    // GitHubログインを実行
    console.log('GitHub認証を開始します...');
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    console.log('GitHub認証成功:', user.email, user.uid);
    
    // GitHub OAuthアクセストークンを取得
    const githubCredential = result.credential;
    if (githubCredential && githubCredential.accessToken) {
      // アクセストークンをsessionStorageに保存
      sessionStorage.setItem('github_access_token', githubCredential.accessToken);
      console.log('GitHubアクセストークンを保存しました');
      
      // GitHub APIを使用してユーザー名を取得
      try {
        const githubResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${githubCredential.accessToken}`
          }
        });
        if (githubResponse.ok) {
          const githubUser = await githubResponse.json();
          // ユーザー名をsessionStorageに保存（認証チェック時に使用）
          sessionStorage.setItem('github_username', githubUser.login);
          console.log('GitHubユーザー名を保存しました:', githubUser.login);
        } else {
          console.error('GitHub API呼び出し失敗:', githubResponse.status, githubResponse.statusText);
        }
      } catch (error) {
        console.error('GitHub API呼び出しエラー:', error);
      }
    } else {
      console.warn('GitHubアクセストークンが取得できませんでした');
    }
    
    // 認証成功後、onAuthStateChangedが発火するまで少し待つ
    // ただし、onAuthStateChangedが既に発火している可能性もあるため、
    // ここではボタンの状態のみリセット（リダイレクトはonAuthStateChangedで処理）
    console.log('GitHub認証が完了しました。onAuthStateChangedの処理を待ちます...');
    
  } catch (error) {
    console.error('GitHubログインエラー:', error);
    console.error('エラーコード:', error.code);
    console.error('エラーメッセージ:', error.message);
    
    // ネットワークエラーやサービス利用不可エラーの場合、リトライを促す
    if (error.code && (
      error.code.includes('visibility-check-was-unavailable') ||
      error.code.includes('network') ||
      error.code.includes('503') ||
      error.code.includes('service-unavailable')
    )) {
      const errorMessage = getErrorMessage(error.code);
      const retry = confirm(
        errorMessage + '\n\n' +
        'リトライしますか？\n\n' +
        '「OK」をクリック: 再度ログインを試みる\n' +
        '「キャンセル」をクリック: キャンセル'
      );
      
      if (retry) {
        // 少し待ってから再度試す
        setTimeout(() => {
          signInWithGitHub();
        }, 1000);
        return;
      }
    }
    
    // 既存のアカウントが異なるプロバイダーで存在する場合の処理
    if (error.code === 'auth/account-exists-with-different-credential') {
      const email = error.email;
      const credential = error.credential;
      
      console.log('既存のアカウントが異なるプロバイダーで存在します:', email);
      
      // ユーザーに既存のアカウントでログインするよう促す
      const linkAccount = confirm(
        'このメールアドレス (' + email + ') は既にGoogleアカウントで登録されています。\n\n' +
        '既存のアカウントにGitHub認証をリンクしますか？\n\n' +
        '「OK」をクリック: 既存のアカウントにGitHub認証をリンク\n' +
        '「キャンセル」をクリック: Googleアカウントでログイン'
      );
      
      if (linkAccount) {
        // 既存のアカウントにGitHub認証をリンク
        try {
          // まず、既存のプロバイダーでサインインを試みる
          // Googleプロバイダーのリストを取得
          const signInMethods = await firebase.auth().fetchSignInMethodsForEmail(email);
          console.log('利用可能なサインインメソッド:', signInMethods);
          
          if (signInMethods.includes('google.com')) {
            // GoogleアカウントでログインしてからGitHubをリンク
            alert(
              '既存のGoogleアカウントでログインしてから、GitHub認証をリンクしてください。\n\n' +
              '手順:\n' +
              '1. Googleアカウントでログイン\n' +
              '2. プロフィール設定からGitHub認証をリンク\n\n' +
              'または、GitHubアカウントで別のメールアドレスを使用してください。'
            );
          } else {
            // その他のプロバイダーの場合
            alert(
              'このメールアドレスは既に他の方法で登録されています。\n\n' +
              '既存のアカウントでログインするか、GitHubアカウントで別のメールアドレスを使用してください。'
            );
          }
        } catch (linkError) {
          console.error('アカウントリンクエラー:', linkError);
          alert(
            'アカウントのリンクに失敗しました。\n\n' +
            '既存のGoogleアカウントでログインするか、GitHubアカウントで別のメールアドレスを使用してください。'
          );
        }
      } else {
        // Googleアカウントでログインするよう促す
        alert('Googleアカウントでログインしてください。');
      }
    } else {
      // その他のエラーの場合
      const errorMessage = getErrorMessage(error.code);
      alert('GitHubログインに失敗しました: ' + errorMessage);
    }
    
    // ログインボタンを再有効化
    const loginButton = document.getElementById('github-login-btn');
    if (loginButton) {
      loginButton.disabled = false;
      // resetLoginButton関数を使用してリセット（一貫性のため）
      resetGitHubLoginButton();
    }
  }
}

/**
 * 既存のアカウントにGitHub認証をリンク
 */
async function linkGitHubProvider() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert('まずGoogleアカウントでログインしてください。');
    return;
  }
  
  const provider = new firebase.auth.GithubAuthProvider();
  provider.addScope('read:user');
  provider.addScope('user:email');
  
  try {
    const result = await user.linkWithPopup(provider);
    alert('GitHub認証をリンクしました。今後はGitHubアカウントでもログインできます。');
    
    // ユーザー情報を更新
    await updateUserInfo(result.user);
  } catch (error) {
    console.error('GitHub認証のリンクエラー:', error);
    
    if (error.code === 'auth/credential-already-in-use') {
      alert('このGitHubアカウントは既に他のアカウントにリンクされています。');
    } else if (error.code === 'auth/email-already-in-use') {
      alert('このメールアドレスは既に使用されています。');
    } else {
      const errorMessage = getErrorMessage(error.code);
      alert('GitHub認証のリンクに失敗しました: ' + errorMessage);
    }
  }
}

/**
 * ログアウトを実行
 */
async function signOut() {
  try {
    // ログアウト前に即座にメインコンテンツを非表示にして、ちらつきを防ぐ
    document.body.classList.remove('auth-checked');
    hideUserInfo();
    hideMainContent();
    
    // ログインページに即座にリダイレクト（ログアウト処理はバックグラウンドで実行）
    // redirectパラメータを除去して無限リダイレクトを防ぐ
    const url = new URL(window.location.href);
    const redirectParam = url.searchParams.get('redirect');
    let redirectUrl = url.origin + url.pathname;
    
    if (redirectParam && !redirectParam.includes('login.html')) {
      redirectUrl = redirectParam;
    }
    
    const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
    
    // 即座にリダイレクト（signOut()は並行して実行）
    window.location.href = loginUrl;
    
    // ログアウト処理はリダイレクトと並行して実行（リダイレクト後に完了する可能性もあるが問題ない）
    firebase.auth().signOut().then(() => {
      console.log('ログアウト成功');
    }).catch((error) => {
      console.error('ログアウトエラー:', error);
    });
  } catch (error) {
    console.error('ログアウトエラー:', error);
    // エラーが発生した場合もリダイレクト（redirectパラメータを除去）
    const url = new URL(window.location.href);
    const redirectParam = url.searchParams.get('redirect');
    let redirectUrl = url.origin + url.pathname;
    
    if (redirectParam && !redirectParam.includes('login.html')) {
      redirectUrl = redirectParam;
    }
    
    const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = loginUrl;
  }
}

/**
 * GitHub OAuthアクセストークンを取得してGitHub APIからユーザー名を取得
 * 注意: この関数はログイン直後に呼び出す必要があります（トークンは一時的なため）
 */
async function getGitHubUsernameFromAPI(accessToken) {
  try {
    if (!accessToken) {
      return null;
    }
    
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`
      }
    });
    
    if (response.ok) {
      const githubUser = await response.json();
      return githubUser.login;
    }
    
    return null;
  } catch (error) {
    console.error('getGitHubUsernameFromAPI: エラー:', error);
    return null;
  }
}

/**
 * GitHub OAuthトークンを取得（現在のユーザーから）
 * 注意: これは直接取得できないため、別の方法を使用する必要があります
 */
async function getGitHubAccessToken(user) {
  // Firebase Authenticationでは、現在ログインしているユーザーのOAuthトークンを
  // 直接取得することはできません。そのため、signInWithPopupの結果から取得する必要があります。
  // ここでは、sessionStorageに保存されたトークンを使用します（一時的な解決策）
  return sessionStorage.getItem('github_access_token');
}

/**
 * GitHubユーザー名を取得（複数の方法を試す）
 */
async function getGitHubUsernameFromUser(user) {
  // 方法1: sessionStorageから取得（ログイン時に保存されたもの）
  let username = sessionStorage.getItem('github_username');
  if (username) {
    console.log('getGitHubUsernameFromUser: sessionStorageから取得:', username);
    return username;
  }
  
  // 方法2: sessionStorageに保存されたアクセストークンを使用してGitHub APIから取得
  const accessToken = sessionStorage.getItem('github_access_token');
  if (accessToken) {
    console.log('getGitHubUsernameFromUser: アクセストークンを使用してGitHub APIから取得を試みます');
    try {
      const githubResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (githubResponse.ok) {
        const githubUser = await githubResponse.json();
        console.log('getGitHubUsernameFromUser: GitHub APIから取得したユーザー名:', githubUser.login);
        // sessionStorageに保存
        sessionStorage.setItem('github_username', githubUser.login);
        return githubUser.login;
      } else {
        console.log('getGitHubUsernameFromUser: GitHub API呼び出しに失敗:', githubResponse.status);
      }
    } catch (error) {
      console.error('getGitHubUsernameFromUser: GitHub API呼び出しエラー:', error);
    }
  }
  
  console.log('getGitHubUsernameFromUser: ユーザー名を取得できませんでした');
  return null;
}

/**
 * GitHubユーザーが許可されているかチェック
 */
async function isAllowedGitHubUser(user) {
  console.log('isAllowedGitHubUser: チェック開始', user?.email, user?.uid);
  if (!user) {
    console.log('isAllowedGitHubUser: ユーザーがnull');
    return false;
  }
  
  // GitHubプロバイダーでログインしているか確認
  const isGitHubProvider = user.providerData.some(
    provider => provider.providerId === 'github.com'
  );
  console.log('isAllowedGitHubUser: GitHubプロバイダーチェック:', isGitHubProvider);
  
  if (!isGitHubProvider) {
    console.log('isAllowedGitHubUser: GitHubプロバイダーではありません');
    return false;
  }
  
  // 許可されたGitHubメールアドレスをチェック
  const allowedGitHubEmails = typeof ALLOWED_GITHUB_EMAILS !== 'undefined' 
    ? ALLOWED_GITHUB_EMAILS 
    : [];
  
  if (user.email) {
    const emailLower = user.email.toLowerCase().trim();
    if (allowedGitHubEmails.includes(emailLower)) {
      return true;
    }
  }
  
  // GitHubユーザー名を取得
  const allowedGitHubUsernames = typeof ALLOWED_GITHUB_USERNAMES !== 'undefined' 
    ? ALLOWED_GITHUB_USERNAMES 
    : [];
  
  // sessionStorageからGitHubユーザー名を取得
  let username = await getGitHubUsernameFromUser(user);
  console.log('isAllowedGitHubUser: 取得したユーザー名:', username);
  console.log('isAllowedGitHubUser: 許可されたユーザー名リスト:', allowedGitHubUsernames);
  
  if (!username) {
    // sessionStorageにない場合、少し待ってから再度試す（最大3回、500ms間隔でリトライ）
    console.log('isAllowedGitHubUser: ユーザー名が取得できなかったため、リトライします');
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      username = await getGitHubUsernameFromUser(user);
      if (username) {
        console.log('isAllowedGitHubUser: リトライでユーザー名を取得:', username);
        break;
      }
    }
  }
  
  if (username) {
    const usernameLower = username.toLowerCase().trim();
    const isAllowed = allowedGitHubUsernames.some(allowedUsername => 
      allowedUsername.toLowerCase().trim() === usernameLower
    );
    console.log('isAllowedGitHubUser: ユーザー名チェック結果:', isAllowed);
    if (isAllowed) {
      return true;
    }
  }
  
  // providerDataからGitHubの情報を取得
  const githubProviderData = user.providerData.find(provider => provider.providerId === 'github.com');
  
  // 表示名からユーザー名を推測
  if (user.displayName) {
    const displayNameLower = user.displayName.toLowerCase().trim();
    if (allowedGitHubUsernames.some(username => 
      username.toLowerCase().trim() === displayNameLower
    )) {
      return true;
    }
  }
  
  // providerDataのdisplayNameからもチェック
  if (githubProviderData && githubProviderData.displayName) {
    const providerDisplayNameLower = githubProviderData.displayName.toLowerCase().trim();
    if (allowedGitHubUsernames.some(username => 
      username.toLowerCase().trim() === providerDisplayNameLower
    )) {
      return true;
    }
  }
  
  // メールアドレスのローカル部分からユーザー名を推測
  if (user.email) {
    const emailLocalPart = user.email.split('@')[0].toLowerCase().trim();
    if (allowedGitHubUsernames.some(username => 
      username.toLowerCase().trim() === emailLocalPart
    )) {
      return true;
    }
  }
  
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
  
  // 許可されたメールアドレスのリストをチェック
  if (ALLOWED_EMAILS.includes(emailLower)) {
    return true;
  }
  
  // メールドメインをチェック
  const emailDomain = email.split('@')[1];
  
  if (!emailDomain) {
    return false;
  }
  
  // ALLOWED_EMAIL_DOMAINSが定義されているか確認
  const allowedDomains = typeof ALLOWED_EMAIL_DOMAINS !== 'undefined' 
    ? ALLOWED_EMAIL_DOMAINS 
    : [];
  
  return allowedDomains.includes(emailDomain);
}

/**
 * ログインページを表示
 */
function showLoginPage() {
  // login.htmlページの場合は何もしない（既にログインページが表示されている）
  const isLoginPage = window.location.pathname.includes('login') || 
                      window.location.pathname.endsWith('/login') ||
                      window.location.pathname.endsWith('/login.html') ||
                      window.location.pathname === '/login' ||
                      window.location.pathname === '/login.html' ||
                      window.location.href.includes('login.html') ||
                      window.location.href.includes('/login');
  
  if (isLoginPage) {
    return;
  }
  
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.style.display = 'flex';
    loginPage.style.visibility = 'visible';
    // トランジション効果のため、少し遅延してopacityを変更
    setTimeout(() => {
      loginPage.style.opacity = '1';
    }, 10);
  }
}

/**
 * ログインページを非表示
 */
function hideLoginPage() {
  // login.htmlページの場合は何もしない（リダイレクトでページを離れるため）
  const isLoginPage = window.location.pathname.includes('login') || 
                      window.location.pathname.endsWith('/login') ||
                      window.location.pathname.endsWith('/login.html') ||
                      window.location.pathname === '/login' ||
                      window.location.pathname === '/login.html' ||
                      window.location.href.includes('login.html') ||
                      window.location.href.includes('/login');
  
  if (isLoginPage) {
    return;
  }
  
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.style.opacity = '0';
    // トランジション効果のため、少し遅延して非表示
    setTimeout(() => {
      loginPage.style.display = 'none';
      loginPage.style.visibility = 'hidden';
    }, 300);
  }
}

/**
 * メインコンテンツを表示
 */
function showMainContent() {
  // login.htmlページの場合は何もしない（リダイレクトでページを離れるため）
  const isLoginPage = window.location.pathname.includes('login') || 
                      window.location.pathname.endsWith('/login') ||
                      window.location.pathname.endsWith('/login.html') ||
                      window.location.pathname === '/login' ||
                      window.location.pathname === '/login.html' ||
                      window.location.href.includes('login.html') ||
                      window.location.href.includes('/login');
  
  if (isLoginPage) {
    // login.htmlページの場合、リダイレクト先のURLに遷移
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect');
    const targetUrl = redirectUrl || 'index.html';
    console.log('showMainContent: login.htmlページからリダイレクトします');
    console.log('リダイレクト先:', targetUrl);
    console.log('現在のパス:', window.location.pathname);
    
    // 認証処理が完全に完了するまで待機
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 300);
    return;
  }
  
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    // まず、bodyにauth-checkedクラスを追加（CSSの!importantルールを回避）
    document.body.classList.add('auth-checked');
    
    // インラインスタイルで確実に表示（!importantを使用）
    mainContent.style.setProperty('display', 'block', 'important');
    mainContent.style.setProperty('visibility', 'visible', 'important');
    
    // body要素のクラスを削除（ログイン状態のスタイルを適用）
    document.body.classList.remove('logged-out');
    document.body.classList.add('logged-in');
    
    // アニメーションクラスを追加する関数（即座に実行して同期を保つ）
    const applyAnimations = () => {
      // ヘッダー
      const header = mainContent.querySelector('header');
      if (header) {
        header.classList.add('header-visible');
      }
      
      // セクションタイトル、カード、アイテムなどのアニメーション
      const sectionTitles = mainContent.querySelectorAll('.section-title');
      sectionTitles.forEach((title) => {
        title.classList.add('animate-in');
      });
      
      const featureCards = mainContent.querySelectorAll('.feature-card');
      featureCards.forEach((card) => {
        card.classList.add('animate-in');
      });
      
      const statCards = mainContent.querySelectorAll('.stat-card');
      statCards.forEach((card) => {
        card.classList.add('animate-in');
      });
      
      const goalItems = mainContent.querySelectorAll('.goal-item');
      goalItems.forEach((item) => {
        item.classList.add('animate-in');
      });
      
      const ctaContent = mainContent.querySelector('.cta-section-content');
      if (ctaContent) {
        ctaContent.classList.add('animate-in');
      }
      
      // フッター
      const footer = mainContent.querySelector('footer');
      if (footer) {
        footer.classList.add('visible');
      }
    };
    
    // initPageAnimations()が定義されている場合はそれを使用、なければ直接適用
    // 即座に実行してページ全体のフェードインアニメーションと同期させる
    if (typeof window.initPageAnimations === 'function') {
      window.initPageAnimations();
    } else {
      applyAnimations();
    }
    
    // アクティブなナビゲーションリンクを設定
    if (typeof setActiveNavLink === 'function') {
      setActiveNavLink();
    } else if (typeof initActiveNavLink === 'function') {
      initActiveNavLink();
    }
  } else {
    // login.htmlを使用している場合は、リダイレクト先のURLに遷移
    // パスの形式が異なる可能性があるため、複数のパターンをチェック
    const isLoginPage = window.location.pathname.includes('login') || 
                        window.location.pathname.endsWith('/login') ||
                        window.location.pathname.endsWith('/login.html') ||
                        window.location.pathname === '/login' ||
                        window.location.pathname === '/login.html' ||
                        window.location.href.includes('login.html') ||
                        window.location.href.includes('/login');
    
    if (isLoginPage) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      const targetUrl = redirectUrl || 'index.html';
      console.log('showMainContent: login.htmlページからリダイレクトします');
      console.log('リダイレクト先:', targetUrl);
      console.log('現在のパス:', window.location.pathname);
      
      // 認証処理が完全に完了するまで待機
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 300);
      return;
    }
    
    // body要素のクラスを削除（ログイン状態のスタイルを適用）
    document.body.classList.remove('logged-out');
    document.body.classList.add('logged-in');
  }
}

/**
 * メインコンテンツを非表示
 */
function hideMainContent() {
  // login.htmlページの場合は何もしない（ログインページ専用ページのため）
  const isLoginPage = window.location.pathname.includes('login') || 
                      window.location.pathname.endsWith('/login') ||
                      window.location.pathname.endsWith('/login.html') ||
                      window.location.pathname === '/login' ||
                      window.location.pathname === '/login.html' ||
                      window.location.href.includes('login.html') ||
                      window.location.href.includes('/login');
  
  if (isLoginPage) {
    return;
  }
  
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.style.visibility = 'hidden';
    mainContent.style.display = 'none';
  }
  
  // body要素のクラスを追加（ログアウト状態のスタイルを適用）
  document.body.classList.remove('logged-in');
  document.body.classList.add('logged-out');
}

/**
 * 認証プロバイダーのロゴを取得
 */
function getProviderIcon(providerId) {
  if (providerId === 'github.com') {
    return `<svg style="width: 18px; height: 18px; fill: currentColor; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`;
  } else if (providerId === 'google.com') {
    return `<svg style="width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;
  }
  return '';
}

/**
 * ユーザー情報を更新（ヘッダーにログアウトボタンを表示）
 */
async function updateUserInfo(user) {
  const userInfo = document.getElementById('user-info');
  const mobileUserInfo = document.getElementById('mobile-user-info');
  
  // 認証プロバイダーを取得（最初のプロバイダーを使用）
  const providerId = user.providerData && user.providerData.length > 0 
    ? user.providerData[0].providerId 
    : 'google.com'; // デフォルトはGoogle
  
  // GitHubプロバイダーの場合はGitHubユーザー名を取得
  let userName;
  if (providerId === 'github.com') {
    const githubUsername = await getGitHubUsernameFromUser(user);
    if (githubUsername) {
      userName = githubUsername;
    } else {
      // GitHubユーザー名が取得できない場合は、メールアドレスのローカル部分を使用
      userName = user.displayName || user.email.split('@')[0];
    }
  } else {
    // Googleなどの他のプロバイダーの場合は従来通り
    userName = user.displayName || user.email.split('@')[0];
  }
  
  const providerIcon = getProviderIcon(providerId);
  
  // モバイル表示用（モバイルメニュー内に表示）
  // モバイルでは常にモバイルメニュー内に表示
  if (mobileUserInfo) {
    mobileUserInfo.style.display = 'block';
    mobileUserInfo.innerHTML = `
      <div style="text-align: center; color: white;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1rem; font-size: 0.9rem; opacity: 0.9;">
          ${providerIcon}
          <span>${userName}</span>
        </div>
        <button onclick="signOut()" class="mobile-nav-link" style="width: 100%; background: #dc3545; color: white; border: 1px solid #c82333; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500; transition: all 0.3s;" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">ログアウト</button>
      </div>
    `;
  }
  
  // デスクトップ表示用（ヘッダー）
  // モバイル（768px以下）では非表示にする（CSSで制御）
  if (userInfo && window.innerWidth > 768) {
    userInfo.style.display = 'flex';
    userInfo.style.alignItems = 'center';
    userInfo.style.gap = '1rem';
    userInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        ${providerIcon}
        <span style="color: white; font-size: 0.9rem;">${userName}</span>
      </div>
      <button onclick="signOut()" style="background: #dc3545; color: white; border: 1px solid #c82333; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s; font-weight: 500;" onmouseover="this.style.background='#c82333'; this.style.borderColor='#bd2130'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#dc3545'; this.style.borderColor='#c82333'; this.style.transform='translateY(0)'">ログアウト</button>
    `;
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
 * GitHubログインボタンの状態をリセット
 */
function resetGitHubLoginButton() {
  const githubLoginButton = document.getElementById('github-login-btn');
  if (!githubLoginButton) {
    return;
  }
  
  githubLoginButton.disabled = false;
  
  // login.htmlとindex.htmlで構造が異なる可能性があるため、両方に対応
  // login.html: SVG + テキストノード
  // index.html: SVG + span要素
  
  const svg = githubLoginButton.querySelector('svg');
  const textSpan = githubLoginButton.querySelector('span');
  
  if (svg && textSpan) {
    // span要素がある場合（index.html）、テキストのみ変更
    textSpan.textContent = 'GitHubでログイン（開発者用）';
  } else if (svg) {
    // SVGはあるがspanがない場合（login.html）、テキストノードを更新
    // すべてのテキストノードを削除
    const textNodes = [];
    for (let node of githubLoginButton.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node);
      }
    }
    textNodes.forEach(node => node.remove());
    
    // テキストを追加
    githubLoginButton.appendChild(document.createTextNode(' GitHubでログイン（開発者用）'));
  } else {
    // SVGが見つからない場合、元のHTMLを復元
    // login.html用
    if (githubLoginButton.classList && githubLoginButton.classList.contains('github-login-btn')) {
      githubLoginButton.innerHTML = '<svg class="github-logo" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHubでログイン（開発者用）';
    } else {
      // index.html用（インラインスタイル + span）
      githubLoginButton.innerHTML = '<svg style="width: 20px; height: 20px; fill: currentColor; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg><span>GitHubでログイン（開発者用）</span>';
    }
  }
}

/**
 * ログインボタンの状態をリセット
 */
function resetLoginButton() {
  // Googleログインボタンをリセット
  const googleLoginButton = document.getElementById('google-login-btn');
  if (googleLoginButton) {
    googleLoginButton.disabled = false;
    // SVGアイコンを保持したままテキストをリセット
    const svg = googleLoginButton.querySelector('svg');
    const textSpan = googleLoginButton.querySelector('span');
    if (svg && textSpan) {
      // span要素がある場合、テキストのみ変更
      textSpan.textContent = 'Googleでログイン';
    } else if (svg) {
      // SVGはあるがspanがない場合、テキストノードを更新
      const textNodes = [];
      for (let node of googleLoginButton.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node);
        }
      }
      textNodes.forEach(node => node.remove());
      googleLoginButton.appendChild(document.createTextNode(' Googleでログイン'));
    } else {
      googleLoginButton.textContent = 'Googleでログイン';
    }
  }
  
  // GitHubログインボタンをリセット
  resetGitHubLoginButton();
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
    'auth/unauthorized-domain': 'このドメインは許可されていません',
    'auth/account-exists-with-different-credential': 'このメールアドレスは既に他の方法で登録されています。既存のアカウントでログインするか、別のメールアドレスを使用してください。',
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/operation-not-allowed': 'この認証方法は許可されていません',
    'auth/invalid-credential': '認証情報が無効です',
    'auth/user-disabled': 'このアカウントは無効化されています',
    'auth/user-not-found': 'ユーザーが見つかりません',
    'auth/wrong-password': 'パスワードが間違っています',
    'auth/too-many-requests': 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
    'auth/visibility-check-was-unavailable.-please-retry-the-request-and-contact-support-if-the-problem-persists': '認証プロセスが中断されました。ポップアップがブロックされている可能性があります。ブラウザのポップアップブロッカーを無効化してから再度お試しください。',
    'auth/visibility-check-was-unavailable': '認証プロセスが中断されました。ポップアップがブロックされている可能性があります。ブラウザのポップアップブロッカーを無効化してから再度お試しください。',
    'auth/internal-error': '内部エラーが発生しました。しばらく待ってから再度お試しください。',
    'auth/service-unavailable': '認証サービスが一時的に利用できません。しばらく待ってから再度お試しください。'
  };
  
  // エラーコードが完全一致しない場合、部分一致を試す
  if (errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }
  
  // エラーコードに特定の文字列が含まれているかチェック
  if (errorCode.includes('visibility-check-was-unavailable')) {
    return '認証プロセスが中断されました。ポップアップがブロックされている可能性があります。ブラウザのポップアップブロッカーを無効化してから再度お試しください。';
  }
  
  if (errorCode.includes('network') || errorCode.includes('503') || errorCode.includes('service-unavailable')) {
    return 'ネットワークエラーまたはサービスが一時的に利用できません。しばらく待ってから再度お試しください。';
  }
  
  return '不明なエラーが発生しました: ' + errorCode;
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

/**
 * ログイン履歴を保存
 * @param {Object} user - Firebase Authentication のユーザーオブジェクト
 */
async function saveLoginHistory(user) {
  if (!user || typeof firebase === 'undefined') {
    return;
  }
  
  try {
    const db = firebase.firestore();
    const loginHistoryRef = db.collection('login_history').doc();
    
    const providerData = user.providerData && user.providerData.length > 0 
      ? user.providerData[0] 
      : null;
    const providerId = providerData ? providerData.providerId : 'unknown';
    
    await loginHistoryRef.set({
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || (user.email ? user.email.split('@')[0] : '匿名'),
      providerId: providerId,
      loginAt: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent || '',
      ipAddress: null // クライアント側では取得できないためnull
    });
    
    console.log('ログイン履歴を保存しました:', user.uid);
  } catch (error) {
    // ログイン履歴の保存に失敗してもログイン処理は続行
    console.error('ログイン履歴の保存に失敗しました:', error);
  }
}

// グローバルに公開
window.signInWithGoogle = signInWithGoogle;
window.signInWithGitHub = signInWithGitHub;
window.linkGitHubProvider = linkGitHubProvider;
window.signOut = signOut;
window.getIdToken = getIdToken;

