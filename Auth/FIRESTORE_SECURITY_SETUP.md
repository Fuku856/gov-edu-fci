# Firestoreセキュリティルール設定手順

このドキュメントでは、Firestoreセキュリティルールの設定方法と管理者コレクションの初期設定手順を説明します。

## 📋 目次

1. [Firestoreデータベースの有効化](#1-firestoreデータベースの有効化)
2. [セキュリティルールの設定](#2-セキュリティルールの設定)
3. [管理者コレクションの初期設定](#3-管理者コレクションの初期設定)
4. [動作確認](#4-動作確認)
5. [トラブルシューティング](#5-トラブルシューティング)

---

## 1. Firestoreデータベースの有効化

### 手順1: Firebase Consoleにアクセス

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `gov-edu-fci` を選択

### 手順2: Firestore Databaseを有効化

1. 左側のメニューから「Firestore Database」を選択
2. 「データベースを作成」をクリック
3. 以下の設定を選択：
   - **モード**: 「本番モード」を選択（セキュリティルールで保護するため）
   - **ロケーション**: 以下のいずれかを選択
     - **利用可能なリージョンがすべて表示される場合**: **「asia-northeast1 (Tokyo)」** を選択
     - **「米国、シンガポール、ベルギー」の3つのみ表示される場合**: **「シンガポール (asia-southeast1)」** を選択
       - **理由**: 日本から最も近く、無料プランでも利用可能です
     - **注意**: 一度設定したロケーションは後から変更できません
4. 「有効にする」をクリック

### 手順3: セキュリティルールの確認

1. Firestore Database画面で「ルール」タブを選択
2. デフォルトのルールが表示されることを確認

---

## 2. セキュリティルールの設定

### 手順1: セキュリティルールファイルの確認

プロジェクトのルートディレクトリに `firestore.rules` ファイルがあることを確認してください。

### 手順2: Firebase Consoleでセキュリティルールを設定

#### 方法A: Firebase Consoleから直接設定（推奨）

1. Firebase Console > Firestore Database > 「ルール」タブを開く
2. 既存のルールを削除
3. 以下のルールをコピー＆ペースト：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 管理者コレクション
    match /admins/{adminId} {
      // 読み取り: 管理者のみが自分の情報または他の管理者情報を読み取れる
      allow read: if request.auth != null && 
                    (request.auth.uid == adminId || 
                     (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true));
      
      // 書き込み: スーパー管理者のみが追加/更新/削除できる
      allow write: if request.auth != null && 
                     exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                     get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    // 投稿データ
    match /posts/{postId} {
      // 承認済み投稿: 全認証済みユーザーが閲覧可能
      allow read: if request.auth != null && 
                    resource.data.status == 'approved';
      
      // 承認待ち/却下投稿: 管理者のみ閲覧可能
      allow read: if request.auth != null && 
                    (resource.data.status == 'pending' || resource.data.status == 'rejected') &&
                    exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                    get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
      
      // 投稿者本人は自分の投稿を閲覧可能（承認待ちでも）
      allow read: if request.auth != null && 
                    resource.data.authorId == request.auth.uid;
      
      // 投稿の作成: 認証済みユーザー全員（作成時は必ずpending）
      allow create: if request.auth != null && 
                      request.resource.data.authorId == request.auth.uid &&
                      request.resource.data.status == 'pending';
      
      // 投稿の更新（承認/却下）: 管理者のみ
      allow update: if request.auth != null && 
                      exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true &&
                      // ステータスの変更のみ許可（approved または rejected）
                      (request.resource.data.status == 'approved' || request.resource.data.status == 'rejected');
      
      // 投稿の削除: 投稿者本人または管理者
      allow delete: if request.auth != null && 
                      (resource.data.authorId == request.auth.uid ||
                       (exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
                        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true));
    }
    
    // 投票データ
    match /votes/{voteId} {
      // 読み取り: 認証済みユーザー全員
      allow read: if request.auth != null;
      
      // 投票の作成: 認証済みユーザー全員（1人1回のみ）
      allow create: if request.auth != null && 
                      request.resource.data.userId == request.auth.uid;
      
      // 投票の更新: 自分の投票のみ
      allow update: if request.auth != null && 
                      resource.data.userId == request.auth.uid &&
                      request.resource.data.userId == request.auth.uid;
      
      // 投票の削除: 自分の投票のみ
      allow delete: if request.auth != null && 
                      resource.data.userId == request.auth.uid;
    }
    
    // 日次カウンター
    match /daily_counters/{date} {
      // 読み取り: 認証済みユーザー全員
      allow read: if request.auth != null;
      
      // 書き込み: 認証済みユーザー全員（制限はアプリ側で実装）
      allow write: if request.auth != null;
    }
  }
}
```

4. 「公開」をクリック

#### 方法B: Firebase CLIを使用（オプション）

1. Firebase CLIをインストール（まだの場合）
   ```bash
   npm install -g firebase-tools
   ```

2. Firebaseにログイン
   ```bash
   firebase login
   ```

3. プロジェクトを初期化
   ```bash
   firebase init firestore
   ```

4. セキュリティルールをデプロイ
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 3. 管理者コレクションの初期設定

### 手順1: 最初の管理者（スーパー管理者）を追加

#### 方法A: Firebase Consoleから手動で追加（推奨）

1. Firebase Console > Firestore Database > 「データ」タブを開く
2. 「コレクションを開始」をクリック
3. コレクションID: `admins` を入力
4. ドキュメントID: 管理者のユーザーUID を入力
   - **ユーザーUIDの取得方法**:
     1. 管理者になるユーザーにログインしてもらう
     2. ブラウザの開発者ツール（F12）を開く
     3. コンソールタブで以下を実行:
        ```javascript
        firebase.auth().currentUser.uid
        ```
     4. 表示されたUIDをコピー
5. 以下のフィールドを追加:

| フィールド名 | 型 | 値 |
|------------|------|-----|
| `userId` | string | 管理者のUID（ドキュメントIDと同じ） |
| `email` | string | 管理者のメールアドレス |
| `displayName` | string | 管理者の表示名 |
| `isAdmin` | boolean | `true` |
| `role` | string | `super_admin` |
| `createdAt` | timestamp | 現在の日時 |
| `createdBy` | string | 管理者のUID（自分自身） |

6. 「保存」をクリック

#### 方法B: ブラウザのコンソールから追加（開発用）

1. 管理者になるユーザーでログイン
2. ブラウザの開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// 自分のUIDを取得
const uid = firebase.auth().currentUser.uid;
const email = firebase.auth().currentUser.email;
const displayName = firebase.auth().currentUser.displayName || email.split('@')[0];

// 一時的にセキュリティルールを緩和して追加
// 注意: これは最初の管理者を追加する場合のみ使用
// 追加後はセキュリティルールを元に戻す

// まず、セキュリティルールを一時的に変更（Firebase Consoleで）
// 以下のルールに変更:
// allow write: if request.auth != null;

// その後、以下のコードを実行
firebase.firestore().collection('admins').doc(uid).set({
  userId: uid,
  email: email,
  displayName: displayName,
  isAdmin: true,
  role: 'super_admin',
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  createdBy: uid
}).then(() => {
  console.log('管理者を追加しました');
  // セキュリティルールを元に戻す
}).catch((error) => {
  console.error('エラー:', error);
});
```

### 手順2: 追加の管理者を追加（スーパー管理者から）

1. スーパー管理者でログイン
2. 管理者ページ（`admin.html`）にアクセス
3. 「管理者設定」セクションで管理者を追加

---

## 4. 動作確認

### 確認1: 管理者権限の確認

1. 管理者でログイン
2. ブラウザの開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// admin.jsが読み込まれていることを確認
if (typeof isAdmin === 'function') {
  isAdmin().then((admin) => {
    console.log('管理者:', admin);
  });
  
  isSuperAdmin().then((superAdmin) => {
    console.log('スーパー管理者:', superAdmin);
  });
} else {
  console.error('admin.jsが読み込まれていません');
}
```

### 確認2: セキュリティルールのテスト

1. 一般ユーザーでログイン
2. ブラウザの開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// 管理者コレクションへのアクセスを試みる（失敗するべき）
firebase.firestore().collection('admins').get()
  .then((snapshot) => {
    console.log('取得できた管理者数:', snapshot.size);
    // 一般ユーザーの場合、0件になるべき
  })
  .catch((error) => {
    console.error('エラー（期待される動作）:', error.code);
    // permission-denied エラーが発生するべき
  });
```

### 確認3: 管理者でのアクセステスト

1. 管理者でログイン
2. ブラウザの開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// 管理者コレクションへのアクセスを試みる（成功するべき）
firebase.firestore().collection('admins').get()
  .then((snapshot) => {
    console.log('取得できた管理者数:', snapshot.size);
    // 管理者の場合、管理者リストが取得できる
  })
  .catch((error) => {
    console.error('エラー:', error);
  });
```

---

## 5. トラブルシューティング

### 問題1: セキュリティルールが適用されない

**原因**: セキュリティルールの公開が完了していない可能性

**解決方法**:
1. Firebase Consoleでセキュリティルールを確認
2. 「公開」ボタンをクリック
3. 数分待ってから再度試す

### 問題2: 管理者コレクションにアクセスできない

**原因**: セキュリティルールが正しく設定されていない可能性

**解決方法**:
1. Firebase Consoleでセキュリティルールを確認
2. 管理者コレクションのルールが正しいか確認
3. 管理者のドキュメントが正しく作成されているか確認

### 問題3: 最初の管理者を追加できない

**原因**: セキュリティルールで書き込みが禁止されている

**解決方法**:
1. 一時的にセキュリティルールを緩和（Firebase Consoleで）
2. 最初の管理者を追加
3. セキュリティルールを元に戻す

一時的なルール（最初の管理者追加用）:
```javascript
match /admins/{adminId} {
  allow read, write: if request.auth != null;
}
```

**注意**: 最初の管理者を追加した後、必ずセキュリティルールを元に戻してください。

### 問題4: 権限エラーが発生する

**原因**: ユーザーが管理者として登録されていない

**解決方法**:
1. Firebase Consoleで `admins` コレクションを確認
2. ユーザーのUIDが正しく登録されているか確認
3. `isAdmin` フィールドが `true` になっているか確認

---

## 📝 チェックリスト

設定完了後、以下を確認してください:

- [ ] Firestore Databaseが有効化されている
- [ ] セキュリティルールが正しく設定されている
- [ ] 最初の管理者（スーパー管理者）が追加されている
- [ ] 管理者権限の確認ができる
- [ ] 一般ユーザーは管理者コレクションにアクセスできない
- [ ] 管理者は管理者コレクションにアクセスできる

---

## 🔒 セキュリティのベストプラクティス

1. **定期的なセキュリティルールの確認**: セキュリティルールを定期的に確認し、必要に応じて更新してください。

2. **管理者の最小権限の原則**: 必要最小限の管理者のみを追加し、不要な管理者は削除してください。

3. **ログの監視**: Firebase Consoleでログを確認し、不審なアクセスがないか監視してください。

4. **セキュリティルールのテスト**: 新しい機能を追加する際は、必ずセキュリティルールをテストしてください。

---

**重要**: セキュリティルールはサーバーサイドで実行されるため、クライアント側からは回避できません。適切に設定することで、データベースへのアクセスを保護できます。

