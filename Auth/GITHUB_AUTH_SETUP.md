# GitHub認証のセットアップガイド（開発者用）

## 概要

このプロジェクトでは、学校関係者用のGoogle認証に加えて、開発者用のGitHub認証を追加できます。GitHub認証は**完全無料**で使用できます。

## セットアップ手順

### 1. Firebase ConsoleでGitHub認証プロバイダーを有効にする

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクトを選択（`gov-edu-fci`）
3. 左メニューから「Authentication」を選択
4. 「Sign-in method」タブを開く
5. 「GitHub」をクリック
6. 「有効にする」をトグルしてONにする
7. **GitHub OAuth Appの作成**が必要です（次のステップ参照）

### 2. GitHub OAuth Appの作成

1. [GitHub Developer Settings](https://github.com/settings/developers)にアクセス
2. 「OAuth Apps」をクリック
3. 「New OAuth App」をクリック
4. 以下の情報を入力：
   - **Application name**: `生徒会活動資金見える化プロジェクト`（任意の名前）
   - **Homepage URL**: あなたのサイトのURL（例: `https://your-site.pages.dev`）
   - **Authorization callback URL**: 
     ```
     https://gov-edu-fci.firebaseapp.com/__/auth/handler
     ```
     または
     ```
     https://YOUR-PROJECT-ID.firebaseapp.com/__/auth/handler
     ```
     （YOUR-PROJECT-IDはFirebaseプロジェクトID）
5. 「Register application」をクリック
6. **Client ID**と**Client Secret**が表示されます（後で使用します）

### 3. Firebase ConsoleにClient IDとClient Secretを登録

1. Firebase ConsoleのGitHub認証設定画面に戻る
2. 「Client ID」に、GitHub OAuth Appから取得したClient IDを入力
3. 「Client Secret」に、GitHub OAuth Appから取得したClient Secretを入力
4. 「保存」をクリック

### 4. 開発者の許可リストに追加

`firebase-config.js`ファイルを編集して、許可する開発者のGitHubユーザー名またはメールアドレスを追加します。

#### 方法1: GitHubユーザー名で許可（推奨）

```javascript
const ALLOWED_GITHUB_USERNAMES = [
  'your-github-username',  // 開発者のGitHubユーザー名
  'another-developer',     // 他の開発者のGitHubユーザー名
];
```

#### 方法2: GitHubメールアドレスで許可

```javascript
const ALLOWED_GITHUB_EMAILS = [
  'developer@example.com',  // 開発者のGitHubアカウントのメールアドレス
];
```

**注意**: 
- メールアドレスはGitHubアカウントで公開設定されている必要があります
- プライバシー保護のため、ユーザー名での認証を推奨します

### 5. 動作確認

1. サイトにアクセス
2. ログインページで「GitHubでログイン（開発者用）」ボタンをクリック
3. GitHubの認証画面が表示される
4. 許可をクリック
5. 許可リストに追加した開発者の場合、ログイン成功

## セキュリティ上の注意点

### ✅ 推奨事項

1. **許可リストの管理**
   - 必要最小限の開発者のみを許可リストに追加
   - 不要になった開発者は削除

2. **Client Secretの保護**
   - Client Secretは絶対にGitHubに公開しない
   - Firebase Consoleの環境変数として管理（自動的に保護されます）

3. **GitHub OAuth Appの設定**
   - Authorization callback URLは正確に設定
   - 本番環境と開発環境で別々のOAuth Appを作成することを推奨

### ⚠️ 注意事項

1. **許可リストの公開**
   - `ALLOWED_GITHUB_USERNAMES`と`ALLOWED_GITHUB_EMAILS`は`firebase-config.js`に記載されるため、GitHubに公開されます
   - ユーザー名は公開情報ですが、メールアドレスは慎重に扱ってください

2. **GitHub認証の制限**
   - GitHub認証は開発者用のみに使用してください
   - 学校関係者は引き続きGoogle認証を使用します

## トラブルシューティング

### エラー: "GitHubログインに失敗しました"

1. **Firebase ConsoleでGitHub認証が有効になっているか確認**
   - Authentication > Sign-in method > GitHub が有効になっているか

2. **Client IDとClient Secretが正しいか確認**
   - GitHub OAuth Appの設定画面で確認
   - Firebase Consoleの設定と一致しているか

3. **Authorization callback URLが正しいか確認**
   - FirebaseプロジェクトIDが正しいか
   - URLの形式が正確か（`https://PROJECT-ID.firebaseapp.com/__/auth/handler`）

### エラー: "許可されていないGitHubアカウントです"

1. **許可リストに追加されているか確認**
   - `firebase-config.js`の`ALLOWED_GITHUB_USERNAMES`または`ALLOWED_GITHUB_EMAILS`を確認
   - GitHubユーザー名やメールアドレスが正確か

2. **GitHubアカウントの設定を確認**
   - メールアドレスが公開設定になっているか（メールアドレスで認証する場合）
   - ユーザー名が正確か

### ログインは成功するが、サイトにアクセスできない

1. **ブラウザのコンソールを確認**
   - エラーメッセージがないか確認
   - `isAllowedGitHubUser`関数が正しく動作しているか確認

2. **認証プロバイダーの確認**
   - ブラウザのコンソールで`user.providerData`を確認
   - `github.com`が含まれているか

## 料金について

### ✅ 完全無料

- **Firebase Authentication**: GitHub認証を含むすべての認証プロバイダーが無料
- **GitHub OAuth App**: 無料で作成・使用可能
- **ユーザー数制限**: Firebase Authenticationの無料プランで十分

### 制限事項

- Firebase Authenticationの無料プランでは、月間50,000 MAU（Monthly Active Users）まで無料
- 開発者用認証の場合、通常はこの制限を超えることはありません

## まとめ

GitHub認証を追加することで、開発者が簡単にログインできるようになります。

- ✅ 完全無料で使用可能
- ✅ セットアップが簡単
- ✅ 学校関係者のGoogle認証と共存可能
- ✅ 開発者のみがアクセス可能

**推奨**: 開発チームで作業する場合、GitHub認証を追加することで、開発環境へのアクセスが簡単になります。

