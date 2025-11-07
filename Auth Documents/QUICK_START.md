# Basic認証 クイックスタートガイド

## 🎯 5分でBasic認証を設定する

### ステップ1: Cloudflare Workersを作成（2分）

1. https://dash.cloudflare.com/ にログイン
2. 左メニューから「Workers & Pages」→「Create」→「Create Worker」
3. Worker名を入力（例: `gov-edu-fci-auth`）
4. 「Quick edit」をクリック
5. このリポジトリの `worker.js` の内容をすべてコピー＆ペースト
6. 「Save and deploy」をクリック

### ステップ2: 環境変数を設定（1分）

1. Workersのページで「Settings」タブを選択
2. 「Variables」セクションを開く
3. 「Add variable」をクリックして以下を追加：

   **変数1:**
   - 名前: `AUTH_USERNAME`
   - 値: `student`

   **変数2:**
   - 名前: `AUTH_PASSWORD`
   - 値: あなたのパスワード（例: `StuCouncil2025!Secure`）

4. 「Save」をクリック

### ステップ3: Pages Functionsで設定（2分）

**この方法が最も簡単で確実です！**

1. **`functions/_middleware.js` ファイルを使用**
   - このリポジトリにはすでに `functions/_middleware.js` が含まれています
   - そのまま使用できます

2. **環境変数を設定**
   - Cloudflareダッシュボードで「Workers & Pages」→「Pages」→ あなたのプロジェクトを選択
   - 「Settings」タブ→「Environment variables」を開く
   - 以下を追加：
     - `AUTH_USERNAME`: `student`
     - `AUTH_PASSWORD`: あなたのパスワード（例: `StuCouncil2025!Secure`）

3. **変更をデプロイ**
   - Gitにコミット＆プッシュ
   - Cloudflare Pagesが自動的にデプロイします

### ステップ4: 動作確認（1分）

1. ブラウザをシークレットモードで開く
2. サイトにアクセス（例: `https://gov-edu-fci.pages.dev`）
3. 認証ダイアログが表示されることを確認
4. ユーザー名とパスワードを入力
5. サイトが表示されることを確認

## ✅ 完了！

これでBasic認証が有効になりました。

## 🔧 パスワードを変更する

1. Workersの「Settings」→「Variables」
2. `AUTH_PASSWORD` の値を変更
3. 「Save」をクリック
4. 変更は即座に反映されます

## ❓ うまくいかない場合

詳細な手順は [BASIC_AUTH_SETUP.md](./BASIC_AUTH_SETUP.md) を参照してください。

