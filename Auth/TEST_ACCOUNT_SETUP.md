# 動作確認用アカウントの設定方法

## 📋 目的

動作確認のために、個人のGoogleアカウントやメールアドレスでログインできるようにする方法を説明します。

## 🔧 方法1: メールドメインを追加（推奨）

### Gmailアカウントを許可する場合

1. **`firebase-config.js` を開く**

2. **`ALLOWED_EMAIL_DOMAINS` を編集**
   ```javascript
   const ALLOWED_EMAIL_DOMAINS = [
     'fcihs-satoyama.ed.jp',  // 学校のメールドメイン
     'gmail.com',  // 動作確認用: Gmailを許可
   ];
   ```

3. **保存してデプロイ**
   - 変更をコミット＆プッシュ
   - デプロイが完了するまで数分待つ

4. **動作確認**
   - サイトにアクセス
   - Gmailアカウントでログインできることを確認

### その他のメールアドレスを許可する場合

1. **`firebase-config.js` を開く**

2. **`ALLOWED_EMAIL_DOMAINS` にドメインを追加**
   ```javascript
   const ALLOWED_EMAIL_DOMAINS = [
     'fcihs-satoyama.ed.jp',  // 学校のメールドメイン
     'gmail.com',  // Gmail
     'yahoo.co.jp',  // Yahooメール
     'outlook.com',  // Outlook
     // その他のドメインも追加可能
   ];
   ```

3. **保存してデプロイ**

## 🔧 方法2: 特定のメールアドレスを追加

特定のメールアドレスのみを許可する場合（ドメイン全体ではなく）

1. **`auth.js` を開く**

2. **`isAllowedEmailDomain` 関数内の `ALLOWED_EMAILS` を編集**
   ```javascript
   const ALLOWED_EMAILS = [
     'your-email@gmail.com',  // 動作確認用: あなたのメールアドレス
     'another-email@yahoo.co.jp',  // 複数追加可能
   ];
   ```

3. **保存してデプロイ**

## ⚠️ 重要な注意事項

### 本番環境では削除する

動作確認が完了したら、**必ず個人のメールアドレスを削除**してください。

1. **`firebase-config.js` を編集**
   ```javascript
   const ALLOWED_EMAIL_DOMAINS = [
     'fcihs-satoyama.ed.jp',  // 学校のメールドメインのみ
     // 'gmail.com',  // 動作確認用: コメントアウト
   ];
   ```

2. **`auth.js` を編集**
   ```javascript
   const ALLOWED_EMAILS = [
     // 'your-email@gmail.com',  // 動作確認用: コメントアウト
   ];
   ```

3. **保存してデプロイ**

### セキュリティについて

- 個人のメールアドレスを許可すると、誰でもアクセスできるようになります
- 動作確認が完了したら、必ず削除してください
- 本番環境では、学校のメールドメイン（`fcihs-satoyama.ed.jp`）のみを許可してください

## 📝 設定例

### 例1: Gmailを許可
```javascript
const ALLOWED_EMAIL_DOMAINS = [
  'fcihs-satoyama.ed.jp',
  'gmail.com',  // Gmailを許可
];
```

### 例2: 複数のドメインを許可
```javascript
const ALLOWED_EMAIL_DOMAINS = [
  'fcihs-satoyama.ed.jp',
  'gmail.com',
  'yahoo.co.jp',
  'outlook.com',
];
```

### 例3: 特定のメールアドレスのみを許可
```javascript
// auth.js の isAllowedEmailDomain 関数内
const ALLOWED_EMAILS = [
  'your-email@gmail.com',
  'test@example.com',
];
```

## ✅ 確認チェックリスト

- [ ] 動作確認用のメールアドレスを追加
- [ ] 保存してデプロイ
- [ ] サイトにアクセスしてログインできることを確認
- [ ] 動作確認が完了したら、個人のメールアドレスを削除
- [ ] 本番環境では学校のメールドメインのみを許可

---

動作確認が完了したら、必ず個人のメールアドレスを削除してください！

