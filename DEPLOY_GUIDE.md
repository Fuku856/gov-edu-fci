# デプロイ手順ガイド

## 概要

このプロジェクトのデプロイは**2つの部分**に分かれています：

1. **Firestoreセキュリティルールのデプロイ**（Firebase CLI使用）
2. **Webサイトのデプロイ**（Cloudflare Pages）

---

## 1. Firestoreセキュリティルールのデプロイ

### 前提条件

Firebase CLIがインストールされている必要があります。

### ステップ1: Firebase CLIのインストール（未インストールの場合）

```bash
npm install -g firebase-tools
```

### ステップ2: Firebaseにログイン

```bash
firebase login
```

ブラウザが開き、Googleアカウントでログインします。

### ステップ3: プロジェクトを初期化（初回のみ）

プロジェクトルートディレクトリで実行：

```bash
firebase init firestore
```

以下の質問に答えます：
- **Firestoreルールファイル**: `firestore.rules`（既に存在）
- **Firestoreインデックスファイル**: `firestore.indexes.json`（作成するか、既存のものを指定）

### ステップ4: Firestoreセキュリティルールをデプロイ

```bash
firebase deploy --only firestore:rules
```

### 確認

Firebase Consoleで確認：
1. https://console.firebase.google.com/ にアクセス
2. プロジェクト `gov-edu-fci` を選択
3. **Firestore Database** > **ルール** タブを開く
4. 更新されたルールが表示されていることを確認

---

## 2. Webサイトのデプロイ（Cloudflare Pages）

### 方法A: GitHub経由で自動デプロイ（推奨）

#### ステップ1: 変更をGitHubにプッシュ

```bash
# 変更をステージング
git add .

# コミット
git commit -m "FirestoreセキュリティルールとGitHub認証を追加"

# GitHubにプッシュ
git push origin main
```

#### ステップ2: Cloudflare Pagesで自動デプロイを確認

1. **Cloudflareダッシュボード**にアクセス
   - https://dash.cloudflare.com/
2. **Pages**を選択
3. プロジェクト `gov-edu-fci` を選択
4. **デプロイ**タブで、新しいデプロイが進行中か完了していることを確認

### 方法B: Cloudflare CLI（Wrangler）を使用（手動デプロイ）

#### ステップ1: Wranglerのインストール

```bash
npm install -g wrangler
```

#### ステップ2: Cloudflareにログイン

```bash
wrangler login
```

#### ステップ3: デプロイ

```bash
wrangler pages deploy . --project-name=gov-edu-fci
```

---

## 3. デプロイ後の確認

### 確認項目

1. **Firestoreセキュリティルール**
   - Firebase Console > Firestore Database > ルール
   - 最新のルールが反映されているか確認

2. **Webサイト**
   - サイトにアクセスして動作確認
   - Googleアカウントでログインできるか確認
   - GitHubアカウントでログインできるか確認（許可されたユーザーのみ）

3. **GitHub認証の動作確認**
   - 許可されたGitHubユーザー名でログイン
   - `allowed_users`コレクションに自動追加されるか確認
   - Firestore Consoleで確認：
     - Firestore Database > データ > `allowed_users`コレクション

---

## トラブルシューティング

### Firestoreルールのデプロイが失敗する

**エラー**: `Firebase project not found`

**解決方法**:
```bash
# プロジェクトを確認
firebase projects:list

# プロジェクトを設定
firebase use gov-edu-fci
```

### Cloudflare Pagesのデプロイが失敗する

**エラー**: ビルドエラー

**解決方法**:
1. Cloudflare Pagesのビルドログを確認
2. エラーメッセージに従って修正
3. 通常、静的サイトなのでビルドは不要（設定を確認）

### GitHub認証が動作しない

**確認項目**:
1. `firebase-config.js`の`ALLOWED_GITHUB_USERNAMES`にユーザー名が含まれているか
2. Firebase Console > Authentication > Sign-in method > GitHub が有効になっているか
3. GitHub OAuth Appの設定が正しいか

---

## デプロイチェックリスト

### Firestoreセキュリティルール
- [ ] Firebase CLIがインストールされている
- [ ] `firebase login`でログイン済み
- [ ] `firebase deploy --only firestore:rules`を実行
- [ ] Firebase Consoleでルールが更新されていることを確認

### Webサイト
- [ ] 変更をGitHubにプッシュ
- [ ] Cloudflare Pagesでデプロイが完了していることを確認
- [ ] サイトにアクセスして動作確認

### 認証機能
- [ ] Googleアカウントでログインできる
- [ ] GitHubアカウントでログインできる（許可されたユーザーのみ）
- [ ] `allowed_users`コレクションに自動追加される

---

## よくある質問

### Q: デプロイは毎回必要ですか？

**A**: 
- **Firestoreセキュリティルール**: `firestore.rules`を変更した場合のみ
- **Webサイト**: コードを変更してGitHubにプッシュした場合、自動的にデプロイされます

### Q: ローカルでテストできますか？

**A**: 
- Firestoreエミュレーターを使用できます：
  ```bash
  firebase emulators:start --only firestore
  ```
- ローカルサーバーでHTMLファイルを開いてテストできます

### Q: デプロイに時間はかかりますか？

**A**:
- **Firestoreルール**: 数秒〜1分程度
- **Cloudflare Pages**: 通常1〜3分程度（自動デプロイの場合）

---

## 参考リンク

- [Firebase CLI ドキュメント](https://firebase.google.com/docs/cli)
- [Cloudflare Pages ドキュメント](https://developers.cloudflare.com/pages/)
- [Firestoreセキュリティルール ドキュメント](https://firebase.google.com/docs/firestore/security/get-started)

