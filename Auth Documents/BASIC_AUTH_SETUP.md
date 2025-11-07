# Cloudflare Basic認証 導入ガイド

このガイドでは、Cloudflare PagesサイトにBasic認証を導入する手順を説明します。

## 📋 前提条件

- Cloudflareアカウントを持っていること
- Cloudflare Pagesでサイトがデプロイされていること
- 管理者権限があること

## 🚀 導入手順

### 手順1: Cloudflare Workersの作成

1. **Cloudflareダッシュボードにログイン**
   - https://dash.cloudflare.com/ にアクセス

2. **Workers & Pagesに移動**
   - 左メニューから「Workers & Pages」を選択
   - 「Create」ボタンをクリック
   - 「Create Worker」を選択

3. **Workerの設定**
   - Worker名を入力（例: `gov-edu-fci-auth`）
   - 「Deploy」をクリック

4. **Workerコードの編集**
   - 「Quick edit」をクリック
   - このリポジトリの `worker.js` の内容をコピー＆ペースト
   - 「Save and deploy」をクリック

### 手順2: 環境変数の設定

1. **Workersの設定ページに移動**
   - 作成したWorkerのページで「Settings」タブを選択
   - 「Variables」セクションを開く

2. **環境変数を追加**
   - 「Add variable」をクリック
   - 以下の変数を追加：

   | 変数名 | 値 | 説明 |
   |--------|-----|------|
   | `AUTH_USERNAME` | `student` | ユーザー名（任意） |
   | `AUTH_PASSWORD` | `あなたのパスワード` | パスワード（強力なものを設定） |

   **⚠️ 重要: パスワードは強力なものを設定してください**
   - 12文字以上
   - 英数字と記号を含む
   - 例: `StuCouncil2025!Secure`

3. **環境変数を保存**
   - 「Save」をクリック

### 手順3: Pages FunctionsでBasic認証を設定（推奨方法）

**⚠️ 「Trigガー」タブがない場合の方法です。この方法が最も簡単で確実です。**

#### ステップ1: Functionsディレクトリとファイルを作成

1. **プロジェクトのルートディレクトリに `functions` フォルダを作成**
   ```
   your-project/
   ├── functions/
   │   └── _middleware.js  ← このファイルを作成
   ├── index.html
   ├── style.css
   └── ...
   ```

2. **`functions/_middleware.js` ファイルを作成**
   - このリポジトリの `functions/_middleware.js` ファイルを使用してください
   - すでに作成済みの場合は、そのまま使用できます

#### ステップ2: 環境変数を設定

1. **Cloudflareダッシュボードにログイン**
   - https://dash.cloudflare.com/ にアクセス

2. **Pagesプロジェクトを選択**
   - 「Workers & Pages」→「Pages」を選択
   - あなたのPagesプロジェクト（`gov-edu-fci`）を選択

3. **環境変数を設定**
   - 「Settings」タブを選択
   - 「Environment variables」セクションを開く
   - 「Add variable」をクリックして以下を追加：

   **変数1:**
   - 名前: `AUTH_USERNAME`
   - 値: `student`
   - 適用先: 「Production」と「Preview」の両方にチェック

   **変数2:**
   - 名前: `AUTH_PASSWORD`
   - 値: あなたのパスワード（例: `StuCouncil2025!Secure`）
   - 適用先: 「Production」と「Preview」の両方にチェック

4. **環境変数を保存**
   - 「Save」をクリック

#### ステップ3: 変更をデプロイ

1. **変更をコミット**
   ```bash
   git add functions/_middleware.js
   git commit -m "Basic認証を追加"
   git push
   ```

2. **自動デプロイを確認**
   - Cloudflare Pagesは自動的に変更を検出してデプロイします
   - 「デプロイ」タブでデプロイ状況を確認できます

### 手順4: 動作確認

1. **サイトにアクセス**
   - ブラウザをシークレットモードで開く
   - サイトのURLにアクセス（例: `https://gov-edu-fci.pages.dev`）

2. **認証ダイアログが表示されることを確認**
   - ブラウザに認証ダイアログが表示されるはずです
   - 設定したユーザー名とパスワードを入力

3. **アクセスできることを確認**
   - 認証成功後、サイトが正常に表示されることを確認

## 🔧 カスタマイズ

### ユーザー名を変更する

環境変数 `AUTH_USERNAME` を変更することで、ユーザー名を変更できます。

### パスワードを変更する

環境変数 `AUTH_PASSWORD` を変更することで、パスワードを変更できます。
変更後は、Workersを再デプロイする必要はありません（自動で反映されます）。

### 認証をスキップするパスを追加

`worker.js` の `publicPaths` 配列にパスを追加することで、認証をスキップできます。

```javascript
const publicPaths = ['/robots.txt', '/favicon.ico', '/public-page'];
```

## 🔒 セキュリティのベストプラクティス

1. **強力なパスワードを使用**
   - 12文字以上
   - 英数字と記号を含む
   - 推測しにくい文字列

2. **定期的にパスワードを変更**
   - 学期ごと、または必要に応じて

3. **パスワードの安全な共有**
   - メールやチャットではなく、安全な方法で共有
   - 必要に応じてパスワード管理ツールを使用

4. **HTTPSの使用**
   - Cloudflare Pagesは自動でHTTPSを使用します
   - 通信は暗号化されます

## ❓ トラブルシューティング

### 認証ダイアログが表示されない

- Workersが正しく接続されているか確認
- ブラウザのキャッシュをクリア
- シークレットモードで再度試す

### パスワードを入力してもアクセスできない

- 環境変数が正しく設定されているか確認
- ユーザー名とパスワードのスペルを確認
- 大文字・小文字を確認

### サイトにアクセスできない

- Workersのコードにエラーがないか確認
- CloudflareダッシュボードでWorkersのログを確認
- ルーティング設定が正しいか確認

## 📚 参考資料

- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages ドキュメント](https://developers.cloudflare.com/pages/)
- [HTTP Basic認証 - MDN](https://developer.mozilla.org/ja/docs/Web/HTTP/Guides/Authentication)

## 💡 注意事項

- Basic認証はシンプルですが、セキュリティレベルは中程度です
- 機密性の高い情報を扱う場合は、より強固な認証方式の検討をお勧めします
- パスワードは定期的に変更してください

---

問題が発生した場合は、Cloudflareのサポートまたはプロジェクト管理者に連絡してください。

