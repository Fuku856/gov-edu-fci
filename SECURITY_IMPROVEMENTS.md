# セキュリティ強化の実装内容

## 概要

クライアント側のみの認証チェックを回避可能な問題を解決するため、Firestoreのセキュリティルールを強化し、サーバー側での認証チェックを実装しました。

## 実装内容

### 1. Firestoreセキュリティルールの強化

#### メールドメインチェック
- `isAllowedEmail()`関数を追加
- 許可されたメールドメイン（`fcihs-satoyama.ed.jp`）をチェック
- すべてのFirestoreアクセスで自動的にチェック

#### 許可されたユーザーリスト
- `allowed_users`コレクションを追加
- GitHubユーザー名や特定のメールアドレスで許可されたユーザーを管理
- 管理者のみが追加・削除可能

#### 認証チェック関数
- `isAuthenticatedAndAllowed()`: 認証済みかつ許可されたユーザーかチェック
- メールドメインまたは`allowed_users`コレクションに登録されているユーザーを許可

### 2. 管理者機能の拡張

#### 許可されたユーザー管理
- `getAllowedUsers()`: 許可されたユーザーリストを取得
- `addAllowedUser()`: 許可されたユーザーを追加（GitHubユーザー名対応）
- `removeAllowedUser()`: 許可されたユーザーを削除

### 3. クライアント側認証の改善

#### サーバー側チェックとの連携
- Firestoreの`allowed_users`コレクションにアクセスを試行
- セキュリティルールで保護されているため、許可されていないユーザーはアクセス不可
- クライアント側のチェックを回避しても、Firestoreへのアクセスが拒否される

## セキュリティの向上

### ✅ クライアント側の回避が不可能
- 開発者ツールでJavaScriptを改変しても、Firestoreのセキュリティルールで拒否される
- サーバー側（Firestore）で確実に認証チェック

### ✅ 無料で実装可能
- Firebase Firestore: 無料枠で十分（読み取り: 50,000回/日、書き込み: 20,000回/日）
- 100人以上のユーザーでも無料枠内で利用可能

### ✅ スケーラブル
- ユーザー数が増えても対応可能
- サーバー管理不要

## 使用方法

### 許可されたユーザーの追加

管理者は、以下の方法で許可されたユーザーを追加できます：

```javascript
// GitHubユーザー名で許可
await addAllowedUser(
  user.uid,           // Firebase AuthenticationのUID
  user.email,         // メールアドレス
  user.displayName,   // 表示名
  'github-username'   // GitHubユーザー名（オプション）
);

// メールアドレスのみで許可
await addAllowedUser(
  user.uid,
  user.email,
  user.displayName
);
```

### 許可されたユーザーリストの取得

```javascript
const allowedUsers = await getAllowedUsers();
console.log(allowedUsers);
```

## 注意事項

### Firestoreのセキュリティルールのデプロイ

セキュリティルールを変更した場合は、必ずFirebase Consoleでデプロイしてください：

```bash
firebase deploy --only firestore:rules
```

### 初回セットアップ

1. Firebase Consoleで`allowed_users`コレクションを作成（自動的に作成されます）
2. 管理者が最初の許可されたユーザーを追加
3. 学校のメールドメイン（`@fcihs-satoyama.ed.jp`）のユーザーは自動的に許可される

## 料金について

### Firebase Firestore（無料枠）
- **読み取り**: 50,000回/日まで無料
- **書き込み**: 20,000回/日まで無料
- **ストレージ**: 1GBまで無料

### 100人以上のユーザーでの使用
- 1ユーザーあたり1日10回の読み取り: 1,000回/日
- 1ユーザーあたり1日5回の書き込み: 500回/日
- **無料枠内で十分に利用可能**

## まとめ

この実装により、クライアント側のみの認証チェックを回避する問題を解決し、サーバー側での確実な認証チェックを実現しました。無料で100人以上のユーザーが利用できるようになりました。

