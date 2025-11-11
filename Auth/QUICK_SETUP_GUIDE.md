# クイックセットアップガイド

このガイドでは、ログイン認証を強化するための最小限の手順を説明します。

## 🚀 5分でセットアップ

### ステップ1: Firestore Databaseを有効化（2分）

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `gov-edu-fci` を選択
3. 左側メニューから「Firestore Database」を選択
4. 「データベースを作成」をクリック
5. モード: **「本番モード」** を選択
6. ロケーションを選択:
   - **利用可能なリージョンがすべて表示される場合**: **「asia-northeast1 (Tokyo)」** を選択
   - **「米国、シンガポール、ベルギー」の3つのみ表示される場合**: **「シンガポール (asia-southeast1)」** を選択
     - **理由**: 日本から最も近く、無料プランでも利用可能です
   - **注意**: 一度設定したロケーションは後から変更できません
7. 「有効にする」をクリック

### ステップ2: セキュリティルールを設定（1分）

1. Firestore Database画面で「ルール」タブを選択
2. 既存のルールを削除
3. `firestore.rules` ファイルの内容をコピー＆ペースト
4. 「公開」をクリック

### ステップ3: 最初の管理者を追加（2分）

1. 管理者になるユーザーでログイン
2. ブラウザの開発者ツール（F12）を開く
3. コンソールタブで以下を実行:

```javascript
// 自分のUIDを取得
const uid = firebase.auth().currentUser.uid;
const email = firebase.auth().currentUser.email;
const displayName = firebase.auth().currentUser.displayName || email.split('@')[0];

console.log('UID:', uid);
console.log('Email:', email);
console.log('DisplayName:', displayName);
```

4. Firebase Console > Firestore Database > 「データ」タブを開く
5. 「コレクションを開始」をクリック
6. コレクションID: `admins` を入力
7. ドキュメントID: 上記で取得したUIDを入力
8. 以下のフィールドを追加:

| フィールド名 | 型 | 値 |
|------------|------|-----|
| `userId` | string | 上記で取得したUID |
| `email` | string | 上記で取得したメールアドレス |
| `displayName` | string | 上記で取得した表示名 |
| `isAdmin` | boolean | `true` |
| `role` | string | `super_admin` |
| `createdAt` | timestamp | 現在の日時（時計アイコンをクリック） |
| `createdBy` | string | 上記で取得したUID |

9. 「保存」をクリック

### ステップ4: 動作確認（1分）

1. ブラウザの開発者ツール（F12）を開く
2. コンソールタブで以下を実行:

```javascript
// admin.jsが読み込まれていることを確認
if (typeof isAdmin === 'function') {
  isAdmin().then((admin) => {
    console.log('管理者:', admin ? '✅ 管理者です' : '❌ 管理者ではありません');
  });
} else {
  console.error('❌ admin.jsが読み込まれていません。ページをリロードしてください。');
}
```

## ✅ 完了！

これで認証強化のセットアップが完了しました。

## 📚 詳細な手順

より詳細な手順が必要な場合は、以下のドキュメントを参照してください:

- [AUTHENTICATION_ENHANCEMENT_GUIDE.md](./AUTHENTICATION_ENHANCEMENT_GUIDE.md): 詳細な設定手順
- [FIRESTORE_SECURITY_SETUP.md](./FIRESTORE_SECURITY_SETUP.md): Firestoreセキュリティルールの詳細な設定手順

## 🔧 トラブルシューティング

### 問題: セキュリティルールが適用されない

**解決方法**:
1. セキュリティルールを「公開」したことを確認
2. 数分待ってから再度試す（反映に時間がかかる場合があります）
3. ブラウザのキャッシュをクリア

### 問題: 管理者コレクションにアクセスできない

**解決方法**:
1. Firebase Consoleで `admins` コレクションが正しく作成されているか確認
2. ユーザーのUIDが正しく登録されているか確認
3. `isAdmin` フィールドが `true` になっているか確認

### 問題: admin.jsが読み込まれない

**解決方法**:
1. `admin.js` ファイルがプロジェクトのルートディレクトリに存在するか確認
2. HTMLファイルで `admin.js` を読み込んでいるか確認
3. ブラウザのコンソールでエラーがないか確認

## 📝 次のステップ

1. 管理者ページ（`admin.html`）を作成
2. 掲示板機能を実装
3. 投票機能を実装

詳細は [AUTHENTICATION_ENHANCEMENT_GUIDE.md](./AUTHENTICATION_ENHANCEMENT_GUIDE.md) を参照してください。

