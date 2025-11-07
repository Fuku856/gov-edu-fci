/**
 * Cloudflare Pages Functions - Basic認証 Middleware
 * このファイルは、すべてのリクエストに対してBasic認証を適用します
 */

export async function onRequest(context) {
  const { request, env } = context;
  
  // リクエストのURLを取得
  const url = new URL(request.url);
  
  // 認証をスキップするパス（オプション）
  // 例: ロボットやヘルスチェック用のエンドポイント
  const publicPaths = ['/robots.txt', '/favicon.ico'];
  if (publicPaths.some(path => url.pathname === path)) {
    return context.next();
  }
  
  // 環境変数から認証情報を取得
  const AUTH_USERNAME = env.AUTH_USERNAME || 'student';
  const AUTH_PASSWORD = env.AUTH_PASSWORD;
  
  // パスワードが設定されていない場合はエラー
  if (!AUTH_PASSWORD) {
    return new Response('認証設定が完了していません。管理者に連絡してください。', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  
  // リクエストヘッダーから認証情報を取得
  const authHeader = request.headers.get('Authorization');
  
  // Basic認証の形式: "Basic base64(username:password)"
  const expectedAuth = 'Basic ' + btoa(`${AUTH_USERNAME}:${AUTH_PASSWORD}`);
  
  // 認証チェック
  if (authHeader !== expectedAuth) {
    // 認証が必要であることを通知
    return new Response(
      `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>認証が必要です - 生徒会サイト</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        .auth-container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        h1 {
            color: #667eea;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <h1>🔒 認証が必要です</h1>
        <p>このサイトは学校関係者のみがアクセスできます。<br>ブラウザに認証ダイアログが表示されますので、ユーザー名とパスワードを入力してください。</p>
    </div>
</body>
</html>`,
      {
        status: 401,
        headers: {
          'WWW-Authenticate': `Basic realm="生徒会活動資金見える化プロジェクト"`,
          'Content-Type': 'text/html; charset=utf-8'
        }
      }
    );
  }
  
  // 認証成功 - 次の処理に進む
  return context.next();
}

