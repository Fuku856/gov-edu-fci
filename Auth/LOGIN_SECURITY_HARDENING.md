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

管理者ユーザーを Firestore に登録し、承認操作を許可します。

1. 管理者にしたいユーザーでサイトにログイン
2. ブラウザ開発者ツール（Console）で以下を実行して UID を取得
   ```javascript
   firebase.auth().currentUser.uid
   ```
3. Firebase Console → Firestore Database → **データ** → 「コレクションを開始」
4. コレクション ID: `admins`
5. ドキュメント ID: 取得した UID
6. フィールドを追加（例）

   | フィールド | 型 | 値 |
   |-----------|----|-----|
   | `userId`  | string  | UID |
   | `email`   | string  | ユーザーのメール |
   | `displayName` | string | 表示名 |
   | `isAdmin` | boolean | true |
   | `role`    | string  | `super_admin` |
   | `createdAt` | timestamp | 現在日時 |
   | `createdBy` | string | 自分の UID |

7. 以降、管理者ユーザーを追加するときは同様にドキュメントを作成します。

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
