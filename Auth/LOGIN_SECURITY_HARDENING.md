# ログイン認証強化ガイド

このドキュメントでは、Firebase Authentication を利用した現行サイトを無料プランの範囲でできるだけ安全に運用するための手順をまとめます。既に Firebase プロジェクトと Authentication が設定済みであることを前提としています。

---

## 概要

- **目的**: Cloudflare Pages でホストしている静的サイトを、無料のまま安全に運用する
- **アプローチ**:
  1. Firestore セキュリティルールでアクセス権を強制
  2. 管理者コレクションで権限を管理
  3. Firebase App Check で正規クライアント以外からのアクセスを遮断
  4. (任意) Cloudflare Access で HTML 配信前に認証
  5. 静的 HTML に機密情報を含めず、認証後に Firestore からデータを取得

---

## 1. Firestore セキュリティルールの更新

1. Firebase Console → **Firestore Database** → **ルール** タブを開く
2. 既存ルールをすべて削除し、以下を貼り付けて **「公開」** をクリック

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /admins/{adminId} {
      allow read: if request.auth != null &&
                    (request.auth.uid == adminId ||
                     (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true));

      allow write: if request.auth != null &&
                     exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                     get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'super_admin';
    }

    match /posts/{postId} {
      allow read: if request.auth != null && resource.data.status == 'approved';

      allow read: if request.auth != null &&
                    (resource.data.status == 'pending' || resource.data.status == 'rejected') &&
                    exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                    get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;

      allow read: if request.auth != null && resource.data.authorId == request.auth.uid;

      allow create: if request.auth != null &&
                      request.resource.data.authorId == request.auth.uid &&
                      request.resource.data.status == 'pending';

      allow update: if request.auth != null &&
                      exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true &&
                      (request.resource.data.status == 'approved' || request.resource.data.status == 'rejected');

      allow delete: if request.auth != null &&
                      (resource.data.authorId == request.auth.uid ||
                       (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true));

      match /votes/{userId} {
        allow read: if request.auth != null;

        allow create: if request.auth != null &&
                        request.auth.uid == userId &&
                        request.resource.data.postId == postId &&
                        (request.resource.data.voteType == 'agree' ||
                         request.resource.data.voteType == 'neutral' ||
                         request.resource.data.voteType == 'disagree') &&
                        !exists(/databases/$(database)/documents/posts/$(postId)/votes/$(userId));

        allow delete: if request.auth != null && request.auth.uid == userId;
      }
    }

    match /daily_counters/{date} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

> **メモ**: ルールを更新したら「テストルール」や実際の画面でデータが取得できることを確認してください。必要に応じてインデックス作成の案内が表示されます。

---

## 2. 管理者コレクションの設定

管理者ユーザーを Firestore に登録し、承認操作を許可します。この設定により、特定のユーザーのみが投稿の承認・却下を行えるようになります。

### ステップ1: 管理者にしたいユーザーでログイン

1. サイト（例: `https://gov-edu-fci.pages.dev/login.html`）にアクセス
2. 管理者にしたいアカウント（Google または GitHub）でログイン
3. ログインが完了したことを確認

### ステップ2: ユーザーUIDを取得

1. ブラウザの開発者ツールを開く
   - **Chrome/Edge**: `F12` キー または `Ctrl + Shift + I`（Windows）/ `Cmd + Option + I`（Mac）
   - **Firefox**: `F12` キー または `Ctrl + Shift + I`（Windows）/ `Cmd + Option + I`（Mac）
2. **Console** タブを選択
3. 以下のコマンドを入力して `Enter` キーを押す
   ```javascript
   firebase.auth().currentUser.uid
   ```
4. 表示された文字列（例: `abc123def456ghi789`）をコピーしてメモ帳などに保存
   - この文字列が **ユーザーUID** です

> **注意**: `firebase.auth().currentUser` が `null` と表示される場合は、ログインが完了していない可能性があります。ページを再読み込みしてから再度試してください。

### ステップ3: Firebase Console にアクセス

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択（既に作成済みのプロジェクト）
3. 左側メニューから **「Firestore Database」** をクリック
4. 上部タブから **「データ」** を選択

### ステップ4: 管理者コレクションを作成

1. **「コレクションを開始」** ボタンをクリック
2. **コレクション ID** に `admins` と入力（**必ず小文字で `admins` と入力**）
3. **「次へ」** をクリック

### ステップ5: 管理者ドキュメントを作成

1. **ドキュメント ID** の入力欄で、**「自動ID」** のチェックを**外す**
2. ステップ2で取得した **ユーザーUID** を貼り付け（例: `abc123def456ghi789`）
3. **「次へ」** をクリック

### ステップ6: フィールドを追加

以下のフィールドを順番に追加します。各フィールドを追加するたびに **「フィールドを追加」** をクリックしてください。

| フィールド名 | 型 | 値の例 | 説明 |
|------------|----|--------|------|
| `userId` | **string** | `abc123def456ghi789` | ステップ2で取得したUID（そのまま貼り付け） |
| `email` | **string** | `admin@example.com` | 管理者のメールアドレス |
| `displayName` | **string** | `管理者 太郎` | 表示名（任意） |
| `isAdmin` | **boolean** | `true` | 管理者フラグ（**必ず `true` に設定**） |
| `role` | **string** | `super_admin` | 権限レベル（`super_admin` または `admin`） |
| `createdAt` | **timestamp** | （現在の日時が自動入力） | 作成日時（**「現在」** を選択） |
| `createdBy` | **string** | `abc123def456ghi789` | 作成者のUID（自分自身のUID） |

**フィールド追加の手順（例: `userId` フィールド）**:
1. **「フィールドを追加」** をクリック
2. **フィールド名** に `userId` と入力
3. **型** で **「string」** を選択
4. **値** に UID を貼り付け
5. **「保存」** をクリック

**`isAdmin` フィールドの追加（重要）**:
1. **フィールド名**: `isAdmin`
2. **型**: **「boolean」** を選択
3. **値**: **`true`** を選択（チェックボックスをオンにする）
4. **「保存」** をクリック

**`createdAt` フィールドの追加**:
1. **フィールド名**: `createdAt`
2. **型**: **「timestamp」** を選択
3. **値**: **「現在」** を選択（自動的に現在の日時が設定されます）
4. **「保存」** をクリック

### ステップ7: ドキュメントを保存

すべてのフィールドを追加したら、**「保存」** ボタンをクリックしてドキュメントを作成します。

### ステップ8: 設定の確認

1. Firestore Database のデータタブで、`admins` コレクションが表示されていることを確認
2. ドキュメントIDが自分のUIDになっていることを確認
3. `isAdmin` が `true` になっていることを確認
4. サイトに戻り、ページを再読み込み
5. 管理者メニューや管理者専用のボタンが表示されることを確認

> **確認方法（推奨）**: ブラウザの開発者ツール（Console）で以下を実行すると、管理者権限が正しく設定されているか確認できます。
> 
> **方法1: 1行で実行（最も簡単）**
> 
> 以下のコードを**1行で**コピーして、Consoleに貼り付けて `Enter` キーを押してください：
> ```javascript
> firebase.firestore().collection('admins').doc(firebase.auth().currentUser.uid).get().then(doc => { if (doc.exists) { console.log('✅ 管理者権限:', doc.data()); } else { console.log('❌ 管理者権限が設定されていません'); } });
> ```
> 
> **方法2: より簡単な確認（推奨）**
> 
> 以下のコードをコピーして実行してください：
> ```javascript
> firebase.firestore().collection('admins').doc(firebase.auth().currentUser.uid).get().then(doc => console.log(doc.exists ? '✅ 管理者権限あり: ' + JSON.stringify(doc.data(), null, 2) : '❌ 管理者権限なし'));
> ```
> 
> **方法3: 段階的に確認**
> 
> 1. まず、現在のユーザーUIDを確認：
>    ```javascript
>    console.log('UID:', firebase.auth().currentUser.uid);
>    ```
> 2. 次に、管理者ドキュメントを確認：
>    ```javascript
>    firebase.firestore().collection('admins').doc(firebase.auth().currentUser.uid).get().then(doc => console.log(doc.exists ? doc.data() : 'ドキュメントが見つかりません'));
>    ```
> 
> **エラーが出る場合の対処法**:
> - `auth.local.js` のエラーは無視して問題ありません（開発用ファイルです）
> - 複数行のコードを貼り付ける場合は、コンソールの「複数行モード」ボタン（`</>` アイコン）をクリックしてから貼り付けてください
> - それでもエラーが出る場合は、**方法1** または **方法2** の1行コードを使用してください

### ステップ9: 追加の管理者を登録する場合

2人目以降の管理者を追加する場合も、同じ手順を繰り返します：

1. 追加したい管理者にログインしてもらう
2. そのユーザーのUIDを取得
3. Firebase Console の `admins` コレクションで **「ドキュメントを追加」** をクリック
4. ドキュメントIDに新しいUIDを入力
5. 同じフィールドを追加（`isAdmin: true`, `role: 'super_admin'` など）

### トラブルシューティング

**問題**: `admins` コレクションが見つからない
- **解決策**: Firestore Database の「データ」タブで、コレクション一覧を確認してください。`admins` が表示されない場合は、ステップ4からやり直してください。

**問題**: `isAdmin` が `false` になっている
- **解決策**: ドキュメントを編集して、`isAdmin` フィールドの値を `true` に変更してください。

**問題**: 管理者メニューが表示されない
- **解決策**: 
  1. ページを再読み込み（`Ctrl + F5` または `Cmd + Shift + R`）
  2. ブラウザのキャッシュをクリア
  3. 開発者ツールのConsoleでエラーが出ていないか確認
  4. `admin.js` が正しく読み込まれているか確認

**問題**: セキュリティルールでエラーが出る
- **解決策**: ステップ1で設定した Firestore セキュリティルールが正しく公開されているか確認してください。`admins` コレクションの読み取り権限が設定されている必要があります。

---

## 3. Firebase App Check の有効化（推奨）

App Check を利用することで、Firebase SDK 以外からのアクセスを抑止できます。Spark プランでも無料です。

1. Firebase Console → **Build > App Check**
2. 対象アプリを選択して「登録」をクリック
3. プロバイダに **reCAPTCHA v3**（または Enterprise）を選択
4. `site key` が発行されるので、以下のスクリプトを HTML に追加
   ```html
   <script src="https://www.google.com/recaptcha/enterprise.js?render=SITE_KEY"></script>
   <script>
     const appCheck = firebase.appCheck();
     appCheck.activate('SITE_KEY', true); // true: auto-refresh
   </script>
   ```
5. Firestore / Authentication / Storage などで「App Check を必須」に設定

> App Check を必須にすると、未認証クライアントからのリクエストはエラーになります。QA 環境などでは一時的に緩和することも可能です。

---

## 4. Cloudflare Access の導入（任意）

HTML 自体へのアクセスを制限したい場合、Cloudflare Pages の前段に Cloudflare Access を設定します（無料枠は最大 50 ユーザー）。

1. Cloudflare Zero Trust（https://dash.teams.cloudflare.com/）にログイン
2. **Access > Applications > Add an application** を選択
3. 「Self-hosted」を選択し、以下を入力
   - Application name: 任意（例: `Gov EDU FCI Portal`）
   - Domain: `gov-edu-fci.pages.dev`
   - Session duration: 任意（例: 12h）
4. ポリシー設定で許可するメールアドレス／ドメインを指定
   - 例: `*@fcihs-satoyama.ed.jp`
5. 「Login methods」で Google / GitHub などを選択
6. 保存すると、指定したユーザーのみが HTML にアクセス可能になります

> 50 ユーザーを超える場合は有料プランが必要です。全校生徒に公開する必要があるページには適しません。

---

## 5. コード側のベストプラクティス

- 静的 HTML に機密情報を埋め込まない（ログイン状態に応じて Firestore から取得）
- `auth.js` でメールドメイン・GitHub ユーザーをチェックし、許可外のユーザーは即ログアウト
- ログイン確認が完了するまでは `<div id="main-content">` を隠しておき、許可が確認できれば `showMainContent()` で初めて表示
- `board.js` / `admin-dashboard.js` の読み取りは必ず Firestore に依存し、未認証ではデータを取得できないようにする
- 投票・投稿の読み取り件数はリアルタイムリスナーを必要最小限にし、無料枠の範囲に収まるよう監視する

---

## 6. インデックス設定（必要に応じて）

初回アクセス時に Firestore からインデックス作成の案内が表示される場合があります。以下の組み合わせを作成すると、掲示板と管理者ダッシュボードで利用するクエリが安定します。

| コレクション | インデックス | 用途 |
|--------------|--------------|------|
| `posts` | `status` (ASC), `createdAt` (ASC) | 承認済み一覧、承認待ち一覧 |

Firebase Console → Firestore Database → インデックス → 「複合インデックスを作成」で設定してください。

---

## 7. 運用上のチェックポイント

- Firestore の使用量（読み取り/書き込み回数、ストレージ）を定期的に確認
- `daily_counters` コレクションで日次上限が適切に更新されているか検証
- 管理者権限を付与／削除するときは `admins/{uid}` を更新
- App Check を有効にした後、ローカル環境で動作させる場合は `auth.local.js` などの設定に注意（開発用に App Check を緩和できます）

---

## 8. 参考ドキュメント

- [Firebase App Check 公式ドキュメント](https://firebase.google.com/docs/app-check)
- [Firestore セキュリティルール](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloudflare Zero Trust / Access](https://developers.cloudflare.com/cloudflare-one/applications/application-types/self-hosted/)

---

これらの設定を適用することで、無料プランの範囲内でも「未ログインユーザーはデータを取得できない」「仮に HTML の要素が表示されても中身は空」という状態を実現できます。さらに Cloudflare Access を併用すれば、HTML 配信前にも認証を要求できるため、より強固な運用が可能です。
