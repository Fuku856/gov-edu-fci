# Firebase サーバー側認証の実装ガイド（無料）

## 概要

Firebase Admin SDKを使用したサーバー側認証は**無料で実装可能**です。Cloudflare Pages Functionsで実装する方法を説明します。

## 料金について

### Firebase Admin SDK
- ✅ **完全無料** - Firebase Admin SDK自体の使用に料金はかかりません
- ✅ **認証トークンの検証** - 無料で無制限に使用可能
- ✅ **Cloudflare Pages Functions** - 無料プランでも十分なリクエスト数が利用可能

### 注意点
- Firebase Authenticationの使用量（ユーザー数）は無料枠内であれば問題なし
- Cloudflare Pages Functionsの無料プラン: 100,000リクエスト/日まで無料

## 実装方法

### 1. Firebase Admin SDKのセットアップ

#### 1.1 サービスアカウントキーの取得

1. Firebase Console > プロジェクト設定 > サービスアカウント
2. 「新しい秘密鍵の生成」をクリック
3. JSONファイルをダウンロード（**このファイルは絶対にGitHubに公開しない**）

#### 1.2 Cloudflare Pages環境変数の設定

1. Cloudflare Dashboard > Pages > プロジェクト > Settings > Environment Variables
2. 以下の環境変数を追加：
   - `FIREBASE_ADMIN_PRIVATE_KEY`: サービスアカウントキーの`private_key`フィールド
   - `FIREBASE_ADMIN_CLIENT_EMAIL`: サービスアカウントキーの`client_email`フィールド
   - `FIREBASE_PROJECT_ID`: プロジェクトID（既に設定済みの可能性あり）

### 2. Cloudflare Pages Functionsの実装

#### 2.1 package.jsonの作成

プロジェクトルートに`package.json`を作成：

```json
{
  "name": "gov-edu-fci",
  "version": "1.0.0",
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

#### 2.2 functions/_middleware.js の実装

```javascript
/**
 * Cloudflare Pages Functions - Firebase Admin SDK を使用したサーバー側認証
 * 
 * この実装により、クライアント側での認証回避を防ぐことができます
 */

// Firebase Admin SDKの初期化（初回のみ）
let admin = null;

async function initFirebaseAdmin() {
  if (admin) return admin;
  
  try {
    const adminModule = await import('firebase-admin');
    admin = adminModule.default;
    
    // 既に初期化されている場合はスキップ
    if (admin.apps.length > 0) {
      return admin;
    }
    
    // 環境変数から認証情報を取得
    const privateKey = context.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = context.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const projectId = context.env.FIREBASE_PROJECT_ID;
    
    if (!privateKey || !clientEmail || !projectId) {
      console.error('Firebase Admin SDKの環境変数が設定されていません');
      return null;
    }
    
    // Firebase Admin SDKを初期化
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
    
    return admin;
  } catch (error) {
    console.error('Firebase Admin SDKの初期化に失敗しました:', error);
    return null;
  }
}

// 許可されたメールドメイン
const ALLOWED_DOMAINS = [
  'fcihs-satoyama.ed.jp',
  // 本番環境では学校のドメインのみを許可
];

// 許可されたメールアドレス（テスト用、本番では削除）
const ALLOWED_EMAILS = [
  // 'hachi56kiku56@gmail.com',  // テスト用: 必要に応じて追加
];

/**
 * IDトークンを検証
 */
async function verifyIdToken(idToken) {
  try {
    const admin = await initFirebaseAdmin();
    if (!admin) {
      return null;
    }
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('IDトークンの検証に失敗しました:', error);
    return null;
  }
}

/**
 * メールアドレスが許可されているかチェック
 */
function isAllowedEmail(email) {
  if (!email) return false;
  
  const emailLower = email.toLowerCase().trim();
  
  // 許可されたメールアドレスのリストをチェック
  if (ALLOWED_EMAILS.includes(emailLower)) {
    return true;
  }
  
  // メールドメインをチェック
  const domain = emailLower.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  
  // 静的ファイル（CSS、JS、画像など）は認証不要
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  const isStaticFile = staticExtensions.some(ext => url.pathname.endsWith(ext));
  
  if (isStaticFile) {
    return context.next();
  }
  
  // ログインページは認証不要
  if (url.pathname === '/login.html' || url.pathname === '/') {
    // ただし、既にログインしている場合はメインコンテンツにリダイレクト
    const idToken = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    request.cookies.get('firebase-auth-token');
    
    if (idToken) {
      const decodedToken = await verifyIdToken(idToken);
      if (decodedToken && isAllowedEmail(decodedToken.email)) {
        // 既にログインしている場合はメインコンテンツを表示
        return context.next();
      }
    }
    return context.next();
  }
  
  // その他のページは認証必須
  const idToken = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('firebase-auth-token');
  
  if (!idToken) {
    // トークンがない場合はログインページにリダイレクト
    return Response.redirect(new URL('/login.html', request.url), 302);
  }
  
  // IDトークンを検証
  const decodedToken = await verifyIdToken(idToken);
  
  if (!decodedToken) {
    // トークンが無効な場合はログインページにリダイレクト
    return Response.redirect(new URL('/login.html', request.url), 302);
  }
  
  // メールアドレスをチェック
  if (!isAllowedEmail(decodedToken.email)) {
    // 許可されていないメールアドレスの場合は403エラー
    return new Response('Forbidden: このサイトは学校関係者のみがアクセスできます', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  
  // 認証成功: リクエストを続行
  return context.next();
}
```

### 3. クライアント側の修正

#### 3.1 auth.js の修正

IDトークンをCookieに保存する処理を追加：

```javascript
// ログイン成功時にIDトークンをCookieに保存
async function signInWithGoogle() {
  // ... 既存のコード ...
  
  const result = await firebase.auth().signInWithPopup(provider);
  const user = result.user;
  
  // IDトークンを取得してCookieに保存
  const idToken = await user.getIdToken();
  document.cookie = `firebase-auth-token=${idToken}; path=/; max-age=3600; SameSite=Lax; Secure`;
  
  // ... 既存のコード ...
}
```

### 4. 制約事項と注意点

#### Cloudflare Pages Functionsの制約

1. **パッケージサイズ制限**
   - Firebase Admin SDKは比較的大きい（約2MB）
   - Cloudflare Pages Functionsの制限内であれば問題なし

2. **実行時間制限**
   - 無料プラン: 10秒
   - 有料プラン: 30秒
   - 認証チェックは数ミリ秒で完了するため問題なし

3. **Node.jsバージョン**
   - Cloudflare Pages FunctionsはNode.js 18.xをサポート
   - Firebase Admin SDKは互換性あり

#### セキュリティ上の注意点

1. **サービスアカウントキーの管理**
   - 絶対にGitHubに公開しない
   - Cloudflare Pagesの環境変数として管理
   - 定期的にローテーション

2. **HTTPS必須**
   - Cookieの`Secure`フラグを使用
   - 本番環境ではHTTPS必須

3. **トークンの有効期限**
   - Firebase IDトークンの有効期限は1時間
   - 定期的にリフレッシュが必要

## 実装のメリット

### ✅ セキュリティの向上
- クライアント側での認証回避が不可能
- 開発者ツールでの操作では破られない
- サーバー側で確実に認証チェック

### ✅ 無料で実装可能
- Firebase Admin SDK: 無料
- Cloudflare Pages Functions: 無料プランで十分

### ✅ スケーラブル
- ユーザー数が増えても対応可能
- サーバー管理不要

## 実装のデメリット

### ⚠️ 複雑性の増加
- クライアント側のみの実装より複雑
- 環境変数の管理が必要

### ⚠️ デプロイの手順
- 環境変数の設定が必要
- 初回セットアップがやや複雑

## まとめ

Firebase Admin SDKを使用したサーバー側認証は**完全無料で実装可能**です。

- ✅ Firebase Admin SDK: 無料
- ✅ Cloudflare Pages Functions: 無料プランで十分
- ✅ セキュリティが大幅に向上
- ⚠️ 実装がやや複雑

**推奨**: 機密情報を含む場合や、より強固なセキュリティが必要な場合は、この実装を強く推奨します。

