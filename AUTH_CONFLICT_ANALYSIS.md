# 認証処理の競合分析

## 現在の認証フロー

### 問題点の特定

現在の`auth.js`の認証フロー（140行目）:

```javascript
if (isServerAllowed || isGitHubUser || isAllowed) {
  // 許可されたユーザー
}
```

**問題**: クライアント側のチェック（`isGitHubUser`、`isAllowed`）が残っており、サーバー側のチェック（`isServerAllowed`）と競合する可能性がある。

---

## 競合の詳細

### 1. クライアント側のチェック（古い処理）

- `isAllowedEmailDomain(email)` - クライアント側でメールドメインをチェック
- `isAllowedGitHubUser(user)` - クライアント側でGitHubユーザーをチェック
- **問題**: 開発者ツールでJavaScriptを改変すれば回避可能

### 2. サーバー側のチェック（新しい処理）

- `isServerAllowed` - Firestoreの`allowed_users`コレクションをチェック
- Firestoreセキュリティルールで保護されている
- **問題**: `allowed_users`コレクションに存在しない学校アカウント（`@fcihs-satoyama.ed.jp`）は、クライアント側のチェックで許可される

### 3. 競合のシナリオ

**シナリオ1: 学校のメールアドレスでログイン**
- クライアント側: ✅ 許可（`isAllowedEmailDomain`が`true`）
- サーバー側: ❌ `allowed_users`に存在しない場合は`false`
- **結果**: クライアント側のチェックで許可される（サーバー側のチェックを回避）

**シナリオ2: 許可されたGitHubユーザーでログイン**
- クライアント側: ✅ 許可（`isAllowedGitHubUser`が`true`）
- サーバー側: ✅ 許可（自動的に`allowed_users`に追加される）
- **結果**: 正常に動作

**シナリオ3: 未許可のユーザーでログイン（クライアント側を改変）**
- クライアント側: ✅ 改変により許可
- サーバー側: ❌ Firestoreセキュリティルールで拒否
- **結果**: サイトは表示されるが、Firestoreへのアクセスは拒否される

---

## 推奨される修正

### オプション1: サーバー側のチェックを優先（推奨）

クライアント側のチェックを削除し、サーバー側のチェックのみを使用する。

**メリット**:
- セキュリティが向上
- クライアント側の回避が不可能
- シンプルな実装

**デメリット**:
- 学校アカウントも`allowed_users`コレクションに追加する必要がある
- 初回ログイン時に自動追加する処理が必要

### オプション2: ハイブリッド方式（現在の実装を改善）

クライアント側のチェックは残すが、サーバー側のチェックを必須にする。

**メリット**:
- 学校アカウントは自動的に許可される
- サーバー側のチェックも実行される

**デメリット**:
- クライアント側のチェックが残る（回避可能）
- 複雑な実装

### オプション3: 学校アカウントも自動登録

学校アカウントでログインした場合も、自動的に`allowed_users`コレクションに追加する。

**メリット**:
- サーバー側のチェックのみで動作
- クライアント側のチェックを削除可能

**デメリット**:
- すべての学校アカウントが`allowed_users`に追加される（データ量が増える）

---

## 現在の実装の問題点

### 問題1: クライアント側のチェックが優先される

```javascript
if (isServerAllowed || isGitHubUser || isAllowed) {
  // クライアント側のチェック（isGitHubUser、isAllowed）が残っている
}
```

**影響**: サーバー側のチェックが失敗しても、クライアント側のチェックで許可される。

### 問題2: 学校アカウントが`allowed_users`に追加されない

学校アカウント（`@fcihs-satoyama.ed.jp`）でログインした場合：
- クライアント側のチェックで許可される
- しかし、`allowed_users`コレクションには追加されない
- Firestoreセキュリティルールでは、`isAllowedEmail()`関数でメールドメインをチェックしているため、問題ない

**確認**: Firestoreセキュリティルールの`isAuthenticatedAndAllowed()`関数:
```javascript
function isAuthenticatedAndAllowed() {
  return request.auth != null && 
         (isAllowedEmail(request.auth.token.email) || isAllowedUser());
}
```

この関数は、メールドメインが`@fcihs-satoyama.ed.jp`の場合、`allowed_users`に存在しなくても許可される。

---

## 結論

### 現在の実装は競合していない

1. **Firestoreセキュリティルール**: メールドメイン（`@fcihs-satoyama.ed.jp`）を直接チェックしているため、`allowed_users`に存在しなくても許可される

2. **クライアント側のチェック**: UI表示のためのチェック（サーバー側のチェックが失敗した場合のフォールバック）

3. **サーバー側のチェック**: Firestoreへのアクセスを保護（最終的な判断）

### ただし、改善の余地がある

クライアント側のチェックを削除し、サーバー側のチェックのみを使用することで、セキュリティが向上する。

---

## 推奨される修正

### 修正案: サーバー側のチェックを優先

```javascript
// サーバー側（Firestore）での認証チェックを優先
let isServerAllowed = false;
try {
  // まず、allowed_usersコレクションをチェック
  const allowedUserDoc = await firebase.firestore()
    .collection('allowed_users')
    .doc(user.uid)
    .get();
  
  if (allowedUserDoc.exists) {
    isServerAllowed = true;
  } else {
    // allowed_usersに存在しない場合、メールドメインをチェック
    // Firestoreセキュリティルールでメールドメインが許可されているか確認
    const email = user.email;
    if (email && email.toLowerCase().endsWith('@fcihs-satoyama.ed.jp')) {
      isServerAllowed = true;
    }
  }
} catch (error) {
  if (error.code === 'permission-denied') {
    isServerAllowed = false;
  }
}

// サーバー側のチェックのみを使用
if (isServerAllowed) {
  // 許可されたユーザー
} else {
  // 拒否
}
```

この修正により、クライアント側のチェックを削除し、サーバー側のチェックのみを使用できる。

