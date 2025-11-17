# 次のステップ - 詳細手順

## 完了したこと ✅

- ✅ Firestoreセキュリティルールのデプロイ完了
- ✅ GitHub認証の自動登録機能の実装完了
- ✅ サーバー側認証チェックの実装完了

---

## ステップ1: 変更をGitHubにプッシュ

### 1-1. 変更されたファイルを確認

以下のファイルが変更されています：

- `firestore.rules` - セキュリティルール（強化版）
- `auth.js` - GitHub認証の自動登録機能を追加
- `admin.js` - 許可されたユーザー管理機能を追加
- `firebase.json` - Firebase設定ファイル（新規作成）
- `.firebaserc` - Firebaseプロジェクト設定（新規作成）
- `firestore.indexes.json` - Firestoreインデックス設定（新規作成）
- `SECURITY_IMPROVEMENTS.md` - セキュリティ改善のドキュメント（新規作成）
- `DEPLOY_GUIDE.md` - デプロイ手順ガイド（新規作成）

### 1-2. Gitの状態を確認

```bash
git status
```

変更されたファイルと新規ファイルが表示されます。

### 1-3. 変更をステージング

```bash
# すべての変更をステージング
git add .

# または、個別に追加する場合
git add firestore.rules
git add auth.js
git add admin.js
git add firebase.json
git add .firebaserc
git add firestore.indexes.json
git add SECURITY_IMPROVEMENTS.md
git add DEPLOY_GUIDE.md
```

### 1-4. コミット

```bash
git commit -m "FirestoreセキュリティルールとGitHub認証の自動登録機能を追加

- Firestoreセキュリティルールを強化（サーバー側認証チェック）
- GitHub認証でログインしたユーザーが自動的にallowed_usersコレクションに追加される機能を実装
- 許可されたユーザー管理機能を追加（admin.js）
- Firebase設定ファイルを追加（firebase.json, .firebaserc）
- セキュリティ改善のドキュメントを追加"
```

### 1-5. GitHubにプッシュ

```bash
# メインブランチにプッシュ
git push origin main

# または、ブランチ名が異なる場合
git push origin master
```

**注意**: ブランチ名を確認する場合：
```bash
git branch
```

---

## ステップ2: Cloudflare Pagesでの自動デプロイを確認

### 2-1. Cloudflareダッシュボードにアクセス

1. https://dash.cloudflare.com/ にアクセス
2. ログイン（必要な場合）

### 2-2. Pagesプロジェクトを確認

1. 左側メニューから **Pages** を選択
2. プロジェクト `gov-edu-fci` を選択
3. **デプロイ** タブを開く

### 2-3. デプロイの進行状況を確認

- 新しいデプロイが開始されていることを確認
- ステータスが **「ビルド中」** → **「デプロイ中」** → **「成功」** に変わるのを待つ
- 通常、1〜3分程度で完了します

### 2-4. デプロイが完了したら確認

- デプロイが成功したら、**「プレビュー」** または **「本番環境」** のURLをクリック
- サイトが正常に表示されることを確認

---

## ステップ3: 動作確認

### 3-1. Googleアカウントでのログイン確認

1. サイトにアクセス
2. **「Googleでログイン」** ボタンをクリック
3. 学校のGoogleアカウント（`@fcihs-satoyama.ed.jp`）でログイン
4. 正常にログインでき、サイトのコンテンツが表示されることを確認

### 3-2. GitHubアカウントでのログイン確認

1. サイトにアクセス（ログアウトしている状態）
2. **「GitHubでログイン（開発者用）」** ボタンをクリック
3. 許可されたGitHubアカウント（`Fuku856` または `yosh-20`）でログイン
4. 正常にログインできることを確認
5. ブラウザのコンソール（F12）を開いて、以下のメッセージが表示されることを確認：
   ```
   GitHubユーザーをallowed_usersコレクションに追加しました: [ユーザー名]
   ```

### 3-3. Firestoreでの確認

1. **Firebase Console** にアクセス
   - https://console.firebase.google.com/project/gov-edu-fci/firestore/data
2. **Firestore Database** > **データ** タブを開く
3. `allowed_users` コレクションを確認
4. GitHub認証でログインしたユーザーのレコードが自動的に追加されていることを確認

**確認項目**:
- `userId`: Firebase AuthenticationのUID
- `email`: メールアドレス
- `displayName`: 表示名
- `githubUsername`: GitHubユーザー名
- `provider`: `github.com`
- `autoAdded`: `true`
- `createdAt`: タイムスタンプ

### 3-4. 未許可ユーザーのテスト（オプション）

1. 許可されていないGitHubアカウントでログインを試みる
2. アラートが表示され、アクセスが拒否されることを確認
3. ログアウトされることを確認

---

## ステップ4: 管理者機能の確認（オプション）

### 4-1. 管理者としてログイン

1. 管理者アカウントでログイン
2. 管理画面（`admin.html`）にアクセス

### 4-2. 許可されたユーザーリストの確認

1. 管理画面で許可されたユーザーリストを表示
2. GitHub認証でログインしたユーザーが表示されることを確認

### 4-3. 手動でユーザーを追加（テスト）

1. 管理画面から新しいユーザーを追加
2. Firestoreで確認
3. 追加したユーザーでログインできることを確認

---

## トラブルシューティング

### GitHub認証でログインできない

**確認項目**:
1. `firebase-config.js`の`ALLOWED_GITHUB_USERNAMES`にユーザー名が含まれているか
2. Firebase Console > Authentication > Sign-in method > GitHub が有効になっているか
3. GitHub OAuth Appの設定が正しいか

**解決方法**:
- `firebase-config.js`を確認して、GitHubユーザー名を追加
- GitHubにプッシュして再デプロイ

### 自動登録が動作しない

**確認項目**:
1. ブラウザのコンソールでエラーメッセージを確認
2. Firestoreのセキュリティルールが正しくデプロイされているか
3. `allowed_users`コレクションへの書き込み権限があるか

**解決方法**:
- Firestoreのセキュリティルールを再確認
- 管理者が手動でユーザーを追加

### Cloudflare Pagesのデプロイが失敗する

**確認項目**:
1. Cloudflareダッシュボードのデプロイログを確認
2. エラーメッセージを確認

**解決方法**:
- エラーメッセージに従って修正
- 通常、静的サイトなのでビルドエラーは発生しにくい

---

## 完了チェックリスト

### デプロイ
- [ ] 変更をGitHubにプッシュ
- [ ] Cloudflare Pagesでデプロイが完了
- [ ] サイトが正常に表示される

### 認証機能
- [ ] Googleアカウントでログインできる
- [ ] GitHubアカウントでログインできる（許可されたユーザーのみ）
- [ ] 未許可ユーザーはアクセス拒否される

### Firestore
- [ ] `allowed_users`コレクションにGitHubユーザーが自動追加される
- [ ] セキュリティルールが正しく動作している

### ドキュメント
- [ ] チームメンバーに変更内容を共有
- [ ] 新しい開発者にGitHub認証の設定方法を説明

---

## 次の開発タスク（オプション）

1. **管理者画面の改善**
   - 許可されたユーザーリストの表示・編集機能
   - ユーザーの追加・削除機能のUI改善

2. **ログ機能の追加**
   - ログイン履歴の記録
   - アクセスログの管理

3. **通知機能**
   - 新しいユーザーが追加された際の通知
   - 管理者へのメール通知

---

## 参考リンク

- [Firebase Console](https://console.firebase.google.com/project/gov-edu-fci/overview)
- [Cloudflare Pages](https://dash.cloudflare.com/)
- [GitHubリポジトリ](https://github.com/Fuku856/gov-edu-fci)
- [Firestoreセキュリティルール ドキュメント](https://firebase.google.com/docs/firestore/security/get-started)

---

## サポート

問題が発生した場合：
1. エラーメッセージを確認
2. ブラウザのコンソール（F12）でエラーを確認
3. Firebase ConsoleとCloudflareダッシュボードでログを確認
4. 必要に応じて、チームメンバーに相談

