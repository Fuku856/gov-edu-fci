# Firebase認証 詳細セットアップガイド

## 📋 現在の状況

✅ Firebaseプロジェクト作成完了
✅ メールドメイン設定: `fcihs-satoyama.ed.jp`

## 🚀 次のステップ（詳細手順）

### ステップ1: Webアプリを追加して設定情報を取得

#### 1-1. Firebase ConsoleでWebアプリを追加

1. **Firebase Consoleを開く**
   - https://console.firebase.google.com/ にアクセス
   - 作成したプロジェクトを選択

2. **Webアプリを追加**
   - プロジェクトのホーム画面で、「</>」（Web）アイコンをクリック
   - または、左メニューの「⚙️ プロジェクトの設定」→「全般」タブ → 下にスクロールして「アプリを追加」セクションから「</> Web」をクリック

3. **アプリの登録**
   - アプリのニックネームを入力（例: `生徒会サイト` または `gov-edu-fci`）
   - 「このアプリのFirebase Hostingも設定します」は**チェックしない**（Cloudflare Pagesを使用するため）
   - 「アプリを登録」をクリック

#### 1-2. 設定情報をコピー

4. **Firebase設定情報が表示されます**
   - 以下のようなコードが表示されます：
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```

5. **設定情報をコピー**
   - このコード全体をコピーします
   - **⚠️ 重要: この情報は後で使用するので、メモ帳などに一時保存しておいてください**

---

### ステップ2: `firebase-config.js` を更新

#### 2-1. ファイルを開く

1. プロジェクトの `firebase-config.js` ファイルを開きます

#### 2-2. 設定情報を貼り付け

2. **Firebase設定情報を貼り付け**
   - ステップ1-2でコピーした設定情報を、`firebaseConfig` オブジェクトに貼り付けます
   - 以下の部分を置き換えます：
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",  // ← コピーした値に置き換え
     authDomain: "your-project-id.firebaseapp.com",  // ← コピーした値に置き換え
     projectId: "your-project-id",  // ← コピーした値に置き換え
     storageBucket: "your-project-id.appspot.com",  // ← コピーした値に置き換え
     messagingSenderId: "123456789012",  // ← コピーした値に置き換え
     appId: "1:123456789012:web:abcdef1234567890"  // ← コピーした値に置き換え
   };
   ```

3. **メールドメインの確認**
   - `ALLOWED_EMAIL_DOMAINS` が `['fcihs-satoyama.ed.jp']` になっていることを確認
   - すでに設定されている場合は変更不要です

#### 2-3. 保存

4. ファイルを保存します

---

### ステップ3: Firebase ConsoleでGoogle認証を有効化

#### 3-1. Authenticationを有効化

1. **Firebase ConsoleでAuthenticationを開く**
   - 左メニューの「Authentication」をクリック
   - 初回の場合、「始める」ボタンが表示されるので、クリック

#### 3-2. Googleプロバイダーを有効化

2. **Sign-in methodタブを選択**
   - 「Sign-in method」（サインイン方法）タブをクリック

3. **Googleを有効化**
   - プロバイダー一覧から「Google」をクリック
   - 「有効にする」トグルを**ON**にします

4. **プロジェクトのサポートメールを設定**
   - 「プロジェクトのサポートメール」ドロップダウンから、メールアドレスを選択
   - （通常は、Firebaseプロジェクトの作成者メールアドレスが選択されています）

5. **保存**
   - 「保存」ボタンをクリック

#### 3-3. 承認済みドメインを設定（重要）

6. **承認済みドメインを設定**
   - 同じ画面で、「承認済みドメイン」セクションを探します
   - または、左メニューの「Authentication」→「設定」タブを開きます

7. **ドメインを追加**
   - 「承認済みドメイン」セクションで、「ドメインを追加」をクリック
   - 以下のドメインを追加：
     - `gov-edu-fci.pages.dev` （Cloudflare Pagesのデフォルトドメイン）
     - カスタムドメインを使用している場合は、それも追加
     - `localhost` （開発用、既にある場合はそのまま）

8. **保存**
   - ドメインを追加したら、自動的に保存されます

---

### ステップ4: Cloudflare環境変数を設定

#### 4-1. Cloudflareダッシュボードにログイン

1. **Cloudflareダッシュボードを開く**
   - https://dash.cloudflare.com/ にアクセス
   - ログインします

#### 4-2. Pagesプロジェクトを選択

2. **Pagesプロジェクトを開く**
   - 左メニューの「Workers & Pages」をクリック
   - 「Pages」をクリック
   - プロジェクト名（`gov-edu-fci`）をクリック

#### 4-3. 環境変数を追加

3. **Settingsタブを開く**
   - プロジェクトページの上部タブから「Settings」をクリック

4. **Environment variablesセクションを開く**
   - ページをスクロールして、「Environment variables」セクションを見つけます
   - 「Add variable」ボタンをクリック

5. **環境変数1: FIREBASE_PROJECT_ID**
   - **名前**: `FIREBASE_PROJECT_ID`
   - **値**: FirebaseプロジェクトID（`firebase-config.js`の`projectId`の値）
     - 例: `your-project-id`
   - **適用先**: 
     - ✅ Production にチェック
     - ✅ Preview にチェック
   - 「Save」をクリック

6. **環境変数2: ALLOWED_EMAIL_DOMAINS**
   - 再度「Add variable」ボタンをクリック
   - **名前**: `ALLOWED_EMAIL_DOMAINS`
   - **値**: `fcihs-satoyama.ed.jp`
     - 複数のドメインがある場合は、カンマ区切りで追加（例: `fcihs-satoyama.ed.jp,example.edu`）
   - **適用先**: 
     - ✅ Production にチェック
     - ✅ Preview にチェック
   - 「Save」をクリック

#### 4-4. 確認

7. **環境変数が正しく設定されたか確認**
   - 環境変数一覧に、`FIREBASE_PROJECT_ID` と `ALLOWED_EMAIL_DOMAINS` が表示されていることを確認

---

### ステップ5: デプロイと動作確認

#### 5-1. 変更をコミット

1. **変更をGitにコミット**
   ```bash
   git add firebase-config.js
   git commit -m "Firebase認証設定を追加"
   git push
   ```

   **または、GitHub DesktopなどのGUIツールを使用:**
   - 変更されたファイルを選択
   - コミットメッセージを入力
   - プッシュ

#### 5-2. デプロイの確認

2. **Cloudflare Pagesでデプロイを確認**
   - Cloudflareダッシュボードの「デプロイ」タブを開く
   - 最新のデプロイが進行中または完了していることを確認
   - デプロイが完了するまで数分待ちます

#### 5-3. 動作確認

3. **サイトにアクセス**
   - ブラウザをシークレットモード（プライベートモード）で開く
   - サイトのURLにアクセス（例: `https://gov-edu-fci.pages.dev`）

4. **ログインページが表示されることを確認**
   - ログインページが表示されることを確認
   - 「Googleでログイン」ボタンが表示されることを確認

5. **Googleでログイン**
   - 「Googleでログイン」ボタンをクリック
   - Googleアカウントの選択画面が表示される
   - **`@fcihs-satoyama.ed.jp` のメールアドレスでログイン**

6. **サイトが表示されることを確認**
   - ログインが成功すると、サイトのメインコンテンツが表示される
   - ログイン前には表示されなかったコンテンツが表示されることを確認

7. **ログアウトの確認（オプション）**
   - ヘッダーにログアウトボタンが表示されている場合は、クリック
   - ログアウト後、再度ログインページが表示されることを確認

---

## ❓ トラブルシューティング

### ログインボタンをクリックしても何も起こらない

**原因**: Firebase SDKが正しく読み込まれていない可能性

**解決方法**:
1. ブラウザのコンソール（F12キー）を開く
2. エラーメッセージを確認
3. `firebase-config.js` の設定が正しいか確認
4. Firebase SDKの読み込みが正しいか確認（`index.html`の`<head>`セクション）

### 「このドメインは許可されていません」というエラー

**原因**: 承認済みドメインにサイトのドメインが追加されていない

**解決方法**:
1. Firebase Console → Authentication → 設定
2. 「承認済みドメイン」に `gov-edu-fci.pages.dev` が追加されているか確認
3. 追加されていない場合は追加

### ログイン後もサイトが表示されない

**原因**: メールドメインが正しくチェックされていない可能性

**解決方法**:
1. ブラウザのコンソール（F12キー）を開く
2. エラーメッセージを確認
3. `firebase-config.js` の `ALLOWED_EMAIL_DOMAINS` が正しいか確認
4. Cloudflare環境変数の `ALLOWED_EMAIL_DOMAINS` が正しいか確認

### 認証後すぐにログアウトされる

**原因**: メールドメインが許可されていない

**解決方法**:
1. ログインに使用したメールアドレスが `@fcihs-satoyama.ed.jp` で終わっているか確認
2. `firebase-config.js` と Cloudflare環境変数の `ALLOWED_EMAIL_DOMAINS` を確認

---

## ✅ 完了チェックリスト

- [ ] Webアプリを追加して設定情報を取得
- [ ] `firebase-config.js` に設定情報を貼り付け
- [ ] Firebase ConsoleでGoogle認証を有効化
- [ ] 承認済みドメインにサイトのドメインを追加
- [ ] Cloudflare環境変数 `FIREBASE_PROJECT_ID` を設定
- [ ] Cloudflare環境変数 `ALLOWED_EMAIL_DOMAINS` を設定
- [ ] 変更をGitにコミット＆プッシュ
- [ ] デプロイが完了していることを確認
- [ ] サイトにアクセスしてログインページが表示される
- [ ] Googleでログインできる
- [ ] ログイン後にサイトが表示される

---

## 📚 参考資料

- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Google認証の設定](https://firebase.google.com/docs/auth/web/google-signin)
- [Cloudflare Pages Functions ドキュメント](https://developers.cloudflare.com/pages/platform/functions/)

---

問題が発生した場合は、ブラウザのコンソール（F12キー）でエラーメッセージを確認し、上記のトラブルシューティングを参照してください。

