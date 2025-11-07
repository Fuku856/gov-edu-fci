# セキュリティに関する注意事項

## 現在の認証システムについて

### 実装方式
現在、このサイトは**クライアント側（ブラウザ側）のみで認証チェック**を行っています。

### セキュリティレベル
- **保護レベル**: 中程度
- **推奨用途**: 内部向けサイト、公開情報の閲覧制限

### 開発者ツールでの回避可能性

**はい、開発者メニューから操作することで認証を回避できます。**

#### 回避可能な方法
1. **JavaScriptの無効化**
   - ブラウザの開発者ツールでJavaScriptを無効化
   - `auth.js`が実行されないため、認証チェックがスキップされる

2. **DOM要素の直接操作**
   - 開発者ツールで`#main-content`の`display: none`を`display: block`に変更
   - `#login-page`を非表示にする

3. **JavaScriptの実行**
   - コンソールで`showMainContent()`や`hideLoginPage()`を実行
   - 認証チェックをバイパスしてコンテンツを表示

4. **ネットワークリクエストの改ざん**
   - 開発者ツールのNetworkタブでリクエストを改ざん
   - 認証トークンを偽造（Firebaseの場合は困難）

### 本番環境での推奨事項

#### 1. サーバー側認証の実装（推奨）
```javascript
// Cloudflare Pages Functions での実装例
// functions/_middleware.js
export async function onRequest(context) {
  const token = context.request.headers.get('Authorization');
  
  // Firebase Admin SDKでトークンを検証
  const decodedToken = await admin.auth().verifyIdToken(token);
  
  // メールドメインをチェック
  const email = decodedToken.email;
  const domain = email.split('@')[1];
  
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  return context.next();
}
```

#### 2. 重要な情報の保護
- **機密情報（個人情報、財務データなど）を表示しない**
- 公開情報のみを表示する
- 機密情報が必要な場合は、サーバー側認証を必須とする

#### 3. ログの監視
- Firebase Authenticationのログを定期的に確認
- 不正なアクセス試行を検知

### 現在の実装が適切な場合
- ✅ 学校内部向けの情報公開サイト
- ✅ 公開情報の閲覧制限のみが必要
- ✅ 機密情報を含まない
- ✅ 閲覧者の識別が主な目的

### より強固な認証が必要な場合
- ❌ 個人情報を含む
- ❌ 財務データを含む
- ❌ 機密情報を含む
- ❌ データの改ざんが問題になる

この場合は、**サーバー側認証の実装**を強く推奨します。

## 実装の改善提案

### 短期的な改善
1. **Content Security Policy (CSP) の設定**
   - インラインスクリプトの実行を制限
   - 外部リソースの読み込みを制限

2. **認証状態の定期的な再確認**
   - 定期的にFirebase認証状態をチェック
   - 認証が切れた場合は自動的にログアウト

### 長期的な改善
1. **サーバー側認証の実装**
   - Cloudflare Pages Functionsで認証チェック
   - Firebase Admin SDKでトークン検証

2. **API エンドポイントの保護**
   - すべてのAPIリクエストに認証トークンを必須とする
   - サーバー側でトークンを検証

## まとめ

現在の実装は、**内部向けの情報公開サイト**としては適切ですが、**機密情報の保護**には不十分です。

開発者ツールでの操作により認証を回避できるため、重要な情報を含む場合は、**サーバー側認証の実装**を検討してください。

