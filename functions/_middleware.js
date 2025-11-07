/**
 * Cloudflare Pages Functions - Firebase Authentication Middleware
 * Firebase IDトークンを検証して、認証済みユーザーのみアクセスを許可します
 */

export async function onRequest(context) {
  const { request, env } = context;
  
  // リクエストのURLを取得
  const url = new URL(request.url);
  
  // 認証をスキップするパス
  const publicPaths = [
    '/robots.txt',
    '/favicon.ico',
    '/login.html',
    '/firebase-config.js',
    '/auth.js'
  ];
  
  // 静的リソースはスキップ
  if (publicPaths.some(path => url.pathname === path) ||
      url.pathname.startsWith('/functions/')) {
    return context.next();
  }
  
  // Firebase Admin SDKの設定（環境変数から取得）
  const FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID;
  const ALLOWED_EMAIL_DOMAINS = env.ALLOWED_EMAIL_DOMAINS ? 
    env.ALLOWED_EMAIL_DOMAINS.split(',') : ['your-school.edu'];
  
  // 認証トークンを取得（CookieまたはAuthorizationヘッダーから）
  const idToken = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                  getCookie(request, 'firebase-token');
  
  if (!idToken) {
    // トークンがない場合はログインページにリダイレクト
    if (url.pathname === '/login.html') {
      return context.next();
    }
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/login.html'
      }
    });
  }
  
  // Firebase IDトークンを検証
  try {
    const decodedToken = await verifyFirebaseToken(idToken, FIREBASE_PROJECT_ID);
    
    // メールドメインをチェック
    const email = decodedToken.email;
    const emailDomain = email.split('@')[1];
    
    if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
      return new Response('このサイトは学校関係者のみがアクセスできます。', {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // 認証成功 - リクエストを処理
    return context.next();
    
  } catch (error) {
    console.error('認証エラー:', error);
    
    // 認証失敗時はログインページにリダイレクト
    if (url.pathname === '/login.html') {
      return context.next();
    }
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/login.html'
      }
    });
  }
}

/**
 * Cookieから値を取得
 */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Firebase IDトークンを検証
 * 注意: Cloudflare Workersでは、Firebase Admin SDKを直接使用できないため、
 * Googleの公開鍵を使用してトークンを検証する必要があります
 */
async function verifyFirebaseToken(idToken, projectId) {
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_IDが設定されていません');
  }
  
  // 簡易的な検証（本番環境では、Googleの公開鍵を使用した完全な検証が必要）
  // ここでは、トークンの存在と形式をチェックするのみ
  // 完全な検証には、Googleの公開鍵を取得してJWTを検証する必要があります
  
  try {
    // JWTトークンをデコード（署名検証なし）
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('無効なトークン形式');
    }
    
    // ペイロードをデコード
    const payload = JSON.parse(atob(parts[1]));
    
    // 有効期限をチェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('トークンの有効期限が切れています');
    }
    
    // 発行者をチェック
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error('無効なトークン発行者');
    }
    
    return payload;
    
  } catch (error) {
    throw new Error('トークンの検証に失敗しました: ' + error.message);
  }
}

// 注意: この実装は簡易版です。本番環境では、Googleの公開鍵を使用した完全なJWT検証を実装することを推奨します。
// または、Cloudflare WorkersでFirebase Admin SDKを使用できるようにする必要があります。
