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

---

## 管理者ができること

管理者権限を設定したユーザーは、以下の操作が可能になります：

### 1. 投稿の承認・却下

- **承認待ち投稿の確認**: ユーザーが投稿した内容を確認できます
- **投稿の承認**: 承認ボタンをクリックすると、投稿が掲示板に表示されます
- **投稿の却下**: 却下ボタンをクリックすると、投稿が非表示になります（却下理由を入力可能）

### 2. 利用状況の確認

- **本日の投稿数**: 今日投稿された件数と上限（30件）を確認できます
- **本日の投票数**: 今日投票された件数と上限（3,000票）を確認できます
- **承認待ち投稿数**: 現在承認待ちの投稿件数を確認できます

### 3. 管理者の管理（スーパー管理者のみ）

- **管理者の追加**: 他のユーザーを管理者に追加できます
- **管理者の削除**: 他の管理者を削除できます（自分自身は削除できません）

---

## 管理者ページへのアクセス方法

管理者ページにアクセスするには、以下のいずれかの方法を使用してください：

### 方法1: 直接URLでアクセス（推奨）

ブラウザのアドレスバーに以下のURLを入力してアクセス：

```
https://gov-edu-fci.pages.dev/admin.html
```

または、ローカル開発環境の場合：

```
http://localhost:8080/admin.html
```

> **注意**: 管理者権限がないユーザーがアクセスした場合、自動的にトップページ（`index.html`）にリダイレクトされます。

### 方法2: ナビゲーションメニューから（管理者ページ内）

`admin.html` ページ内のナビゲーションメニューには「管理者」リンクが表示されています。他のページから管理者ページに戻る際に使用できます。

### 方法3: ブックマークに追加

管理者ページをよく使用する場合は、ブラウザのブックマークに追加しておくと便利です。

---

## 管理者ページの使い方

### 1. 承認待ち投稿の確認

1. 管理者ページ（`admin.html`）にアクセス
2. 「承認待ちの投稿」セクションに、承認待ちの投稿が一覧表示されます
3. 各投稿には以下の情報が表示されます：
   - 投稿タイトル
   - 投稿内容
   - 投稿者名
   - 投稿日時

### 2. 投稿を承認する

1. 承認したい投稿の **「承認」** ボタンをクリック
2. 投稿のステータスが `approved` に変更され、掲示板（`board.html`）に表示されます
3. 承認後、投稿は承認待ちリストから自動的に削除されます

### 3. 投稿を却下する

1. 却下したい投稿の **「却下」** ボタンをクリック
2. 却下理由を入力するダイアログが表示されます（任意）
3. 理由を入力して「OK」をクリックすると、投稿が却下されます
4. 却下された投稿は掲示板に表示されません

### 4. 利用状況の確認

管理者ページの上部に表示される統計情報で、以下の情報を確認できます：

- **本日の投稿数**: 今日投稿された件数（上限: 30件）
- **本日の投票数**: 今日投票された件数（上限: 3,000票）
- **承認待ち投稿**: 現在承認待ちの投稿件数と最終更新時刻

---

## 管理者権限の種類

### 通常の管理者（`role: 'admin'`）

- 投稿の承認・却下が可能
- 利用状況の確認が可能
- 管理者の追加・削除は**不可**

### スーパー管理者（`role: 'super_admin'`）

- 投稿の承認・却下が可能
- 利用状況の確認が可能
- **管理者の追加・削除が可能**

> **注意**: 現在の実装では、管理者の追加・削除機能はコード内に実装されていますが、UI（画面）はまだ用意されていません。スーパー管理者が他の管理者を追加・削除する場合は、Firebase Console から直接 `admins` コレクションを編集するか、ブラウザの開発者ツール（Console）で `addAdmin()` や `removeAdmin()` 関数を使用してください。

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

**問題**: 承認待ち投稿が表示されない / 「The query requires an index」エラーが出る
- **原因**: Firestore の複合インデックスが作成されていないため、承認待ち投稿を取得するクエリが実行できません。
- **解決策**: 以下の手順でインデックスを作成してください。

#### インデックス作成手順（方法1: エラーメッセージのリンクから）

1. ブラウザの開発者ツール（Console）でエラーメッセージを確認
2. エラーメッセージ内のリンク（`https://console.firebase.google.com/v1/r/project/...`）をクリック
3. Firebase Console のインデックス作成画面が開きます
4. **「インデックスを作成」** ボタンをクリック
5. インデックスの作成が完了するまで数分待ちます（通常1〜5分）
6. 管理者ページを再読み込みして、承認待ち投稿が表示されるか確認

#### インデックス作成手順（方法2: 手動で作成）

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左側メニューから **「Firestore Database」** をクリック
4. 上部タブから **「インデックス」** を選択
5. **「複合インデックスを作成」** ボタンをクリック
6. 以下の設定を入力：
   - **コレクション ID**: `posts`
   - **フィールドを追加** をクリックし  て、以下のフィールドを追加：
     - フィールド1: `status` - **昇順** (Ascending)
     - フィールド2: `createdAt` - **昇順** (Ascending)
7. **「作成」** ボタンをクリック
8. インデックスの作成が完了するまで数分待ちます（ステータスが「構築中」から「有効」に変わります）
9. 管理者ページを再読み込みして、承認待ち投稿が表示されるか確認

> **注意**: 
> - `auth.local.js` のエラーは無視して問題ありません（開発用ファイルです）
> - インデックスの作成には数分かかる場合があります。作成中は「構築中」と表示されます
> - インデックスが作成されると、承認待ち投稿が自動的に表示されるようになります

**問題**: 承認した投稿が掲示板に表示されない / 「The query requires an index」エラーが出る
- **原因**: 掲示板（`board.html`）で承認済み投稿を取得するクエリにも複合インデックスが必要です。管理者ページとは異なるインデックス（降順）が必要な場合があります。
- **解決策**: 以下の手順でインデックスを作成してください。

#### インデックス作成手順（方法1: エラーメッセージのリンクから - 推奨）

1. 掲示板ページ（`board.html`）にアクセス
2. ブラウザの開発者ツール（Console）を開く
3. エラーメッセージ内のリンク（`https://console.firebase.google.com/v1/r/project/...`）をクリック
4. Firebase Console のインデックス作成画面が開きます
5. **「インデックスを作成」** ボタンをクリック
6. インデックスの作成が完了するまで数分待ちます（通常1〜5分）
7. 掲示板ページを再読み込みして、承認済み投稿が表示されるか確認

#### インデックス作成手順（方法2: 手動で作成）

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左側メニューから **「Firestore Database」** をクリック
4. 上部タブから **「インデックス」** を選択
5. **「複合インデックスを作成」** ボタンをクリック
6. 以下の設定を入力：
   - **コレクション ID**: `posts`
   - **フィールドを追加** をクリックして、以下のフィールドを追加：
     - フィールド1: `status` - **昇順** (Ascending)
     - フィールド2: `createdAt` - **降順** (Descending) ← **重要: 降順を選択**
7. **「作成」** ボタンをクリック
8. インデックスの作成が完了するまで数分待ちます（ステータスが「構築中」から「有効」に変わります）
9. 掲示板ページを再読み込みして、承認済み投稿が表示されるか確認

> **注意**: 
> - 管理者ページ用のインデックス（`status` 昇順 + `createdAt` 昇順）と掲示板用のインデックス（`status` 昇順 + `createdAt` 降順）は**別々のインデックス**です
> - 両方のインデックスを作成する必要があります
> - 既に管理者ページ用のインデックスを作成済みの場合でも、掲示板用のインデックスを追加で作成してください

---

## 3. Firebase App Check の有効化（推奨）

### Firebase App Check とは

Firebase App Check は、Firebase サービス（Firestore、Authentication、Storage など）へのアクセスを、**正規のアプリからのみ**に制限するセキュリティ機能です。不正なリクエスト（ボット、スクレイピング、自動化ツールなど）をブロックし、Firebase リソースを保護します。

### reCAPTCHA v3 の表示タイミング

**重要なポイント**: reCAPTCHA v3 は、**ユーザーには表示されません**。

- **reCAPTCHA v2**: 「私はロボットではありません」というチェックボックスや画像選択が表示される
- **reCAPTCHA v3**: **バックグラウンドで動作**し、ユーザーには何も表示されない（「見えないreCAPTCHA」）

#### 動作の仕組み

1. **ページ読み込み時**: Firebase App Check SDK が自動的に reCAPTCHA v3 トークンを取得
2. **バックグラウンド処理**: ユーザーの行動（マウスの動き、クリック、スクロールなど）を分析してスコアを算出
3. **トークン生成**: スコアに基づいてトークンが生成され、Firebase サービスへのリクエストと一緒に送信
4. **検証**: Firebase がトークンを検証し、正規のアプリからのリクエストかどうかを判断

**ユーザー体験**: ユーザーは何も操作する必要がなく、通常通りサイトを利用できます。reCAPTCHA の存在を意識することはありません。

### どのようなセキュリティを強化しているか

#### 1. **API キーの保護**

**問題**: Firebase の API キーは、HTML や JavaScript に埋め込まれるため、誰でも見ることができます。悪意のあるユーザーが API キーを使って、直接 Firebase サービスにアクセスする可能性があります。

**App Check の保護**:
- API キーだけではアクセスできません
- App Check トークンが必要です
- トークンは正規のアプリからのみ生成されます

**例**:
```
❌ App Check なし: API キーがあれば誰でもアクセス可能
✅ App Check あり: API キー + App Check トークンが必要（正規のアプリからのみ）
```

#### 2. **ボットやスクレイピングツールのブロック**

**問題**: 
- ボットが大量のリクエストを送信して、無料枠を消費する
- スクレイピングツールがデータを取得する
- 自動化ツールが不正な操作を行う

**App Check の保護**:
- ボットやスクレイピングツールは reCAPTCHA v3 のトークンを取得できない
- トークンがないリクエストはすべてブロックされる
- 正規のブラウザからのリクエストのみが許可される

#### 3. **セキュリティルールの補完**

**現在の防御**:
- Firestore セキュリティルール: サーバーサイドでのアクセス制御（誰が何を読み書きできるか）

**App Check の追加防御**:
- クライアント側でのアプリ認証（正規のアプリからのリクエストかどうか）

**2層防御の例**:
```
リクエスト → App Check（正規のアプリか？） → セキュリティルール（権限があるか？） → データアクセス
```

#### 4. **DDoS攻撃への対策**

**問題**: 悪意のあるユーザーが大量のリクエストを送信して、サービスを停止させたり、使用量を増やしたりする

**App Check の保護**:
- 正規のアプリからのリクエストのみが処理される
- 自動化された攻撃はブロックされる
- 無料枠を保護できる

#### 5. **データの整合性保護**

**問題**: 不正なツールやスクリプトから送信されたデータが、データベースの整合性を損なう可能性がある

**App Check の保護**:
- 正規のアプリからのみデータの書き込みが許可される
- 不正なデータ操作を防止できる

### セキュリティ強化の具体例

#### シナリオ1: ボットがデータを取得しようとする

**App Check なし**:
```
ボット → API キーを使用 → Firestore に直接アクセス → データを取得（成功）
```

**App Check あり**:
```
ボット → API キーを使用 → App Check トークンなし → アクセス拒否（失敗）
```

#### シナリオ2: スクレイピングツールが大量のリクエストを送信

**App Check なし**:
```
スクレイピングツール → 大量のリクエスト → 無料枠を消費 → サービス停止の可能性
```

**App Check あり**:
```
スクレイピングツール → App Check トークンなし → すべてのリクエストがブロック → 無料枠を保護
```

#### シナリオ3: 悪意のあるユーザーが API キーを悪用

**App Check なし**:
```
悪意のあるユーザー → HTML から API キーを取得 → 直接 Firestore にアクセス → データを操作
```

**App Check あり**:
```
悪意のあるユーザー → API キーを取得 → App Check トークンなし → アクセス拒否
```

### まとめ

**reCAPTCHA v3 の表示**:
- ✅ **ユーザーには表示されません**（バックグラウンドで動作）
- ✅ ユーザー体験を損なわない
- ✅ 自動的にセキュリティを強化

**セキュリティ強化の内容**:
- ✅ **API キーの保護**（API キーだけではアクセスできない）
- ✅ **ボットやスクレイピングツールのブロック**
- ✅ **セキュリティルールの補完**（2層防御）
- ✅ **DDoS攻撃への対策**
- ✅ **データの整合性保護**

**特に重要なポイント**:
- App Check は、**セキュリティルールの代わりではなく、補完するもの**です
- セキュリティルール（誰が何を読み書きできるか）と App Check（正規のアプリからのリクエストか）の2層で防御することで、より強固なセキュリティを実現できます

### App Check の主なメリット

#### 1. **無料プランの使用量保護** 💰

- **問題**: 悪意のあるボットやスクレイピングツールが大量のリクエストを送信すると、Firebase の無料枠（読み取り50,000回/日、書き込み20,000回/日）をすぐに使い切ってしまいます
- **解決**: App Check により、正規のアプリからのリクエストのみが許可されるため、無駄な使用量を防げます
- **効果**: 無料プランの範囲内で安全に運用できます

#### 2. **不正なデータ操作の防止** 🛡️

- **問題**: Firebase の API キーが公開されている場合、誰でも Firestore に直接アクセスしてデータを読み取ったり、書き込んだりできる可能性があります
- **解決**: App Check により、正規のアプリから送信されたリクエストのみが処理されます
- **効果**: セキュリティルールと組み合わせることで、より強固な防御が可能になります

#### 3. **DDoS攻撃やボット攻撃への対策** 🚫

- **問題**: 悪意のあるユーザーが大量のリクエストを送信して、サービスを停止させたり、使用量を増やしたりする可能性があります
- **解決**: App Check により、正規のアプリからのリクエストのみが許可されるため、自動化された攻撃をブロックできます
- **効果**: サービスが安定して動作し続けます

#### 4. **データの整合性保護** ✅

- **問題**: 不正なツールやスクリプトから送信されたデータが、データベースの整合性を損なう可能性があります
- **解決**: 正規のアプリからのみデータの書き込みが許可されるため、データの整合性が保たれます
- **効果**: 信頼性の高いデータ管理が可能になります

#### 5. **コスト削減** 💵

- **問題**: 無料枠を超えると、従量課金が発生する可能性があります（Blaze プランにアップグレードした場合）
- **解決**: 不正なリクエストをブロックすることで、使用量を最小限に抑えられます
- **効果**: 予期しない課金を防げます

#### 6. **セキュリティの多層防御** 🔒

- **現在の防御**: Firestore セキュリティルール（サーバーサイドでのアクセス制御）
- **App Check の追加**: クライアント側でのアプリ認証（正規のアプリからのみアクセス）
- **効果**: セキュリティルールと App Check の2層で防御することで、より強固なセキュリティを実現できます

### 導入前と導入後の比較

| 項目 | App Check なし | App Check あり |
|------|---------------|---------------|
| ボットからのアクセス | 可能（ブロックされない） | ブロックされる |
| スクレイピングツール | アクセス可能 | ブロックされる |
| 無料枠の保護 | 弱い（使用量が増える可能性） | 強い（正規のリクエストのみ） |
| セキュリティレベル | 中（セキュリティルールのみ） | 高（セキュリティルール + App Check） |
| コスト | 使用量が増える可能性 | 使用量を最小限に抑制 |

### 設定手順

#### ステップ1: Google reCAPTCHA でサイトキーと秘密鍵を取得

1. [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) にアクセス
2. 右上の **「+」** ボタンをクリックして新しいサイトを登録
3. 以下の情報を入力：
   - **ラベル**: 任意の名前（例: `生徒会見える化プロジェクト`）
   - **reCAPTCHA タイプ**: **reCAPTCHA v3** を選択
   - **ドメイン**: 以下のドメインを追加：
     - `gov-edu-fci.pages.dev`（本番環境）
     - `localhost`（ローカル開発用、オプション）
   - **所有者**: 自分のメールアドレス
4. **利用規約に同意** して **「送信」** をクリック
5. **サイトキー** と **秘密鍵** が表示されます
   - **サイトキー**: 後でHTMLに追加します（例: `6Lc...`）
   - **秘密鍵**: Firebase Console に入力します（例: `6Lc...`）
6. 両方のキーをコピーしてメモ帳などに保存

> **重要**: 秘密鍵は他人に公開しないでください。サイトキーはHTMLに埋め込まれますが、秘密鍵はFirebase Console のみで使用します。

#### ステップ2: Firebase Console で App Check を設定

1. Firebase Console → **Build > App Check** にアクセス
2. **「アプリ」** タブを選択
3. 登録したいアプリ（例: 「生徒会 ウェブアプリ」）を確認
4. **reCAPTCHA** セクションを展開（「+」アイコンをクリック）
5. **「reCAPTCHA 秘密鍵」** の入力欄に、ステップ1で取得した **秘密鍵** を貼り付け
6. **「トークンの有効期間」** はデフォルトのまま（1日ごとに送信）で問題ありません
7. **「保存」** ボタンをクリック
8. 設定が完了すると、アプリのステータスが「未登録」から「登録済み」に変わります

#### ステップ3: HTML に App Check スクリプトを追加

1. すべてのHTMLファイル（`index.html`, `board.html`, `admin.html` など）の `<head>` セクションに、以下のスクリプトを追加：

```html
<!-- Firebase App Check -->
<script src="https://www.google.com/recaptcha/enterprise.js?render=SITE_KEY"></script>
<script>
  // Firebase App Check を初期化
  const appCheck = firebase.appCheck();
  appCheck.activate('SITE_KEY', true); // true: 自動更新を有効化
</script>
```

2. `SITE_KEY` を、ステップ1で取得した **サイトキー** に置き換えます

**例**:
```html
<!-- Firebase App Check -->
<script src="https://www.google.com/recaptcha/enterprise.js?render=6LcAbCdEfGhIjKlMnOpQrStUvWxYz"></script>
<script>
  const appCheck = firebase.appCheck();
  appCheck.activate('6LcAbCdEfGhIjKlMnOpQrStUvWxYz', true);
</script>
```

3. このスクリプトは、**Firebase SDK の読み込み後**、**firebase-config.js の読み込み後**に配置してください

**推奨される配置順序**:
```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<!-- Firebase設定 -->
<script src="firebase-config.js"></script>

<!-- Firebase App Check -->
<script src="https://www.google.com/recaptcha/enterprise.js?render=SITE_KEY"></script>
<script>
  const appCheck = firebase.appCheck();
  appCheck.activate('SITE_KEY', true);
</script>

<!-- その他のスクリプト -->
<script src="auth.js"></script>
<script src="admin.js"></script>
```

#### ステップ4: Firestore で App Check を必須に設定

1. Firebase Console → **Firestore Database** にアクセス
2. **「App Check」** タブを選択
3. **「App Check を必須にする」** を有効化
4. これにより、App Check トークンがないリクエストはすべてブロックされます

> **注意**: 
> - App Check を必須にすると、正規のアプリからのリクエストのみが許可されます
> - 開発中は一時的に無効化することも可能です
> - 本番環境では必ず有効化してください

#### ステップ5: 動作確認

1. サイトにアクセスして、正常に動作するか確認
2. ブラウザの開発者ツール（Console）でエラーが出ていないか確認
3. Firestore への読み書きが正常に動作するか確認

> **トラブルシューティング**: 
> - App Check のエラーが出る場合は、サイトキーが正しく設定されているか確認してください
> - ローカル環境でテストする場合は、reCAPTCHA の設定で `localhost` をドメインに追加してください

### 無料プランでの利用

- **reCAPTCHA v3**: 無料で利用可能（Spark プランでも利用可能）
- **reCAPTCHA Enterprise**: 有料プランが必要（より高度な機能）
- **推奨**: まずは **reCAPTCHA v3** で導入し、必要に応じて Enterprise にアップグレード

### まとめ

Firebase App Check を導入することで、以下のようなメリットが得られます：

✅ **無料プランの使用量を保護**（ボットやスクレイピングツールからの無駄なリクエストをブロック）  
✅ **セキュリティの強化**（正規のアプリからのみアクセスを許可）  
✅ **コスト削減**（予期しない使用量の増加を防ぐ）  
✅ **データの整合性保護**（不正なデータ操作を防止）  
✅ **サービス安定性の向上**（DDoS攻撃やボット攻撃への対策）

特に、**無料プランで100人以上のユーザーを管理する場合**、App Check は必須の機能です。不正なリクエストをブロックすることで、無料枠を超えるリスクを大幅に減らせます。

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
