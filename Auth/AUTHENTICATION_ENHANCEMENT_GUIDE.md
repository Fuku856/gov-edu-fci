# ログイン認証強化ガイド

このドキュメントでは、Firestoreセキュリティルールを使用した認証強化の手順を説明します。

## 📋 目次

1. [概要](#概要)
2. [実装内容](#実装内容)
3. [設定手順](#設定手順)
4. [動作確認](#動作確認)
5. [よくある質問](#よくある質問)

---

## 概要

### 強化前の問題点

- クライアントサイド（ブラウザ）での認証チェックのみ
- 開発者ツールから回避可能
- データベースへのアクセス制御が不十分

### 強化後の改善点

- **サーバーサイドでの認証チェック**: Firestoreセキュリティルールで保護
- **開発者ツールから回避不可能**: サーバー側で実行されるため
- **データベースへのアクセス制御**: 適切な権限管理

---

## 実装内容

### 1. Firestore SDKの追加

すべてのHTMLファイルにFirestore SDKを追加しました。

```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
```

### 2. Firestoreセキュリティルールの作成

`firestore.rules` ファイルを作成し、以下の機能を実装:

- **管理者コレクション**: 管理者のみがアクセス可能
- **投稿データ**: 承認済み投稿は全員、承認待ち投稿は管理者のみ
- **投票データ**: 認証済みユーザー全員がアクセス可能
- **日次カウンター**: 認証済みユーザー全員がアクセス可能

### 3. 管理者権限管理機能の実装

`admin.js` ファイルを作成し、以下の機能を実装:

- `isAdmin()`: 管理者かどうかをチェック
- `isSuperAdmin()`: スーパー管理者かどうかをチェック
- `getAdminInfo()`: 管理者情報を取得
- `getAdminList()`: 管理者リストを取得（スーパー管理者のみ）
- `addAdmin()`: 管理者を追加（スーパー管理者のみ）
- `removeAdmin()`: 管理者を削除（スーパー管理者のみ）

---

## 設定手順

### ステップ1: Firestore Databaseの有効化

詳細な手順は [FIRESTORE_SECURITY_SETUP.md](./FIRESTORE_SECURITY_SETUP.md) を参照してください。

1. Firebase Console > Firestore Database にアクセス
2. 「データベースを作成」をクリック
3. モード: 「本番モード」を選択
4. ロケーション: 最も近いリージョンを選択
5. 「有効にする」をクリック

### ステップ2: セキュリティルールの設定

1. Firebase Console > Firestore Database > 「ルール」タブを開く
2. `firestore.rules` の内容をコピー＆ペースト
3. 「公開」をクリック

### ステップ3: 管理者コレクションの初期設定

1. 管理者になるユーザーでログイン
2. ブラウザの開発者ツール（F12）を開く
3. コンソールタブで以下を実行してUIDを取得:

```javascript
firebase.auth().currentUser.uid
```

4. Firebase Console > Firestore Database > 「データ」タブを開く
5. 「コレクションを開始」をクリック
6. コレクションID: `admins` を入力
7. ドキュメントID: 管理者のUID を入力
8. 以下のフィールドを追加:

| フィールド名 | 型 | 値 |
|------------|------|-----|
| `userId` | string | 管理者のUID |
| `email` | string | 管理者のメールアドレス |
| `displayName` | string | 管理者の表示名 |
| `isAdmin` | boolean | `true` |
| `role` | string | `super_admin` |
| `createdAt` | timestamp | 現在の日時 |
| `createdBy` | string | 管理者のUID |

9. 「保存」をクリック

### ステップ4: HTMLファイルへのFirestore SDK追加

主要なHTMLファイルにFirestore SDKを追加しました:

- ✅ `index.html`
- ⚠️ 他のHTMLファイルにも追加が必要な場合があります

他のHTMLファイルにも追加する場合:

1. HTMLファイルの `<head>` セクションを開く
2. Firebase SDKの後に以下を追加:

```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
```

### ステップ5: admin.jsの読み込み

管理者機能を使用するページで `admin.js` を読み込みます。

```html
<script src="admin.js"></script>
```

---

## 動作確認

### 確認1: Firestore SDKの読み込み確認

1. ブラウザでサイトにアクセス
2. 開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// Firestoreが利用可能か確認
if (typeof firebase !== 'undefined' && firebase.firestore) {
  console.log('✅ Firestore SDKが読み込まれています');
} else {
  console.error('❌ Firestore SDKが読み込まれていません');
}
```

### 確認2: 管理者権限の確認

1. 管理者でログイン
2. 開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// admin.jsが読み込まれていることを確認
if (typeof isAdmin === 'function') {
  isAdmin().then((admin) => {
    console.log('管理者:', admin ? '✅ 管理者です' : '❌ 管理者ではありません');
  });
  
  isSuperAdmin().then((superAdmin) => {
    console.log('スーパー管理者:', superAdmin ? '✅ スーパー管理者です' : '❌ スーパー管理者ではありません');
  });
} else {
  console.error('❌ admin.jsが読み込まれていません');
}
```

### 確認3: セキュリティルールのテスト

#### テスト1: 一般ユーザーでのアクセステスト

1. 一般ユーザーでログイン
2. 開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// 管理者コレクションへのアクセスを試みる（失敗するべき）
firebase.firestore().collection('admins').get()
  .then((snapshot) => {
    console.log('❌ エラー: 一般ユーザーが管理者コレクションにアクセスできました');
    console.log('取得できた管理者数:', snapshot.size);
  })
  .catch((error) => {
    if (error.code === 'permission-denied') {
      console.log('✅ 正常: 一般ユーザーは管理者コレクションにアクセスできません');
    } else {
      console.error('❌ 予期しないエラー:', error);
    }
  });
```

#### テスト2: 管理者でのアクセステスト

1. 管理者でログイン
2. 開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// 管理者コレクションへのアクセスを試みる（成功するべき）
firebase.firestore().collection('admins').get()
  .then((snapshot) => {
    console.log('✅ 正常: 管理者は管理者コレクションにアクセスできます');
    console.log('取得できた管理者数:', snapshot.size);
  })
  .catch((error) => {
    console.error('❌ エラー: 管理者が管理者コレクションにアクセスできません:', error);
  });
```

---

## よくある質問

### Q1: クライアントサイドのチェックは必要ですか？

**A**: クライアントサイドのチェックはUI表示制御用です。データ保護はFirestoreセキュリティルールで行います。

- **クライアントサイド**: UI表示制御（開発者ツールから回避可能）
- **サーバーサイド（セキュリティルール）**: データ保護（回避不可能）

### Q2: セキュリティルールは無料で使えますか？

**A**: はい、Firestoreセキュリティルールは無料プラン（Sparkプラン）で利用できます。

### Q3: 最初の管理者を追加する方法は？

**A**: 詳細な手順は [FIRESTORE_SECURITY_SETUP.md](./FIRESTORE_SECURITY_SETUP.md) の「3. 管理者コレクションの初期設定」を参照してください。

### Q4: 管理者を追加/削除する方法は？

**A**: スーパー管理者でログイン後、管理者ページ（`admin.html`）から追加/削除できます。

### Q5: セキュリティルールが適用されない場合は？

**A**: 以下を確認してください:

1. セキュリティルールが正しく公開されているか
2. 数分待ってから再度試す（反映に時間がかかる場合があります）
3. ブラウザのキャッシュをクリア

---

## 📝 チェックリスト

設定完了後、以下を確認してください:

- [ ] Firestore Databaseが有効化されている
- [ ] セキュリティルールが正しく設定されている
- [ ] Firestore SDKがすべてのHTMLファイルに追加されている
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

## 📚 関連ドキュメント

- [FIRESTORE_SECURITY_SETUP.md](./FIRESTORE_SECURITY_SETUP.md): Firestoreセキュリティルールの詳細な設定手順
- [SECURITY.md](./SECURITY.md): セキュリティと個人情報の取り扱い

---

**重要**: セキュリティルールはサーバーサイドで実行されるため、クライアント側からは回避できません。適切に設定することで、データベースへのアクセスを保護できます。

