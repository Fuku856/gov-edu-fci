# 次のステップ: Cloudflare環境変数の設定

## 📋 現在の状況

✅ Firebaseプロジェクト作成完了
✅ Webアプリ追加完了
✅ `firebase-config.js` に設定情報を入力済み
- Google認証の有効化（確認が必要）

## 🚀 ステップ4: Cloudflare環境変数を設定

### なぜ環境変数が必要？

Cloudflare Pagesのサーバー側（`functions/_middleware.js`）でFirebase認証を検証するために、以下の情報が必要です：
- FirebaseプロジェクトID
- 許可されたメールドメイン

### 設定手順（5分）

#### 1. Cloudflareダッシュボードにログイン

1. **Cloudflareダッシュボードを開く**
   - https://dash.cloudflare.com/ にアクセス
   - アカウントにログイン

#### 2. Pagesプロジェクトを開く

2. **左メニューから「Workers & Pages」をクリック**
   - サイドバーの「Workers & Pages」を探してクリック

3. **「Pages」をクリック**
   - 「Workers & Pages」の下に「Pages」があるのでクリック

4. **プロジェクト名をクリック**
   - プロジェクト一覧から「`gov-edu-fci`」をクリック

#### 3. Settingsタブを開く

5. **上部のタブから「Settings」をクリック**
   - プロジェクトページの上部にタブがあります
   - 「概要」「デプロイ」「設定」などが表示されています
   - 「設定」（Settings）タブをクリック

#### 4. 環境変数を追加

6. **「Environment variables」セクションを探す**
   - Settingsページを下にスクロール
   - 「Environment variables」（環境変数）というセクションがあります

7. **「Add variable」ボタンをクリック**
   - 「Environment variables」セクション内に「Add variable」ボタンがあります
   - これをクリック

#### 5. 環境変数1: FIREBASE_PROJECT_ID を追加

8. **設定値を入力**
   - **Variable name（変数名）**: `FIREBASE_PROJECT_ID`
   - **Value（値）**: `gov-edu-fci`
     - ⚠️ これは `firebase-config.js` の `projectId` の値です
   - **Apply to（適用先）**: 
     - ✅ **Production** にチェック
     - ✅ **Preview** にチェック

9. **「Save」をクリック**
   - 設定を保存

#### 6. 環境変数2: ALLOWED_EMAIL_DOMAINS を追加

10. **再度「Add variable」ボタンをクリック**

11. **設定値を入力**
    - **Variable name（変数名）**: `ALLOWED_EMAIL_DOMAINS`
    - **Value（値）**: `fcihs-satoyama.ed.jp`
      - ⚠️ 複数のドメインがある場合は、カンマ区切りで追加（例: `fcihs-satoyama.ed.jp,example.edu`）
    - **Apply to（適用先）**: 
      - ✅ **Production** にチェック
      - ✅ **Preview** にチェック

12. **「Save」をクリック**
    - 設定を保存

#### 7. 確認

13. **環境変数が正しく設定されたか確認**
    - 環境変数一覧に、以下の2つが表示されていることを確認：
      - `FIREBASE_PROJECT_ID` = `gov-edu-fci`
      - `ALLOWED_EMAIL_DOMAINS` = `fcihs-satoyama.ed.jp`

## ✅ 完了チェックリスト

- [ ] Cloudflareダッシュボードにログイン
- [ ] Pagesプロジェクト（`gov-edu-fci`）を開く
- [ ] Settingsタブを開く
- [ ] Environment variablesセクションを開く
- [ ] `FIREBASE_PROJECT_ID` を追加（値: `gov-edu-fci`）
- [ ] `ALLOWED_EMAIL_DOMAINS` を追加（値: `fcihs-satoyama.ed.jp`）
- [ ] 両方の環境変数がProductionとPreviewに適用されていることを確認

## 🚀 その次のステップ（ステップ5）

環境変数の設定が完了したら、次は：

1. **変更をGitにコミット＆プッシュ**
2. **Cloudflare Pagesでデプロイを確認**
3. **サイトにアクセスして動作確認**

詳細は `FIREBASE_SETUP_STEP_BY_STEP.md` の「ステップ5」を参照してください。

---

## ❓ よくある質問

### Q: 環境変数はどこに設定しますか？
A: Cloudflareダッシュボード → Workers & Pages → Pages → プロジェクト名 → Settings → Environment variables

### Q: ProductionとPreviewの違いは？
A: 
- **Production**: 本番環境（実際のサイト）
- **Preview**: プレビュー環境（プルリクエストなど）

両方にチェックすることで、どちらの環境でも動作します。

### Q: 値はどこから取得しますか？
A: 
- `FIREBASE_PROJECT_ID`: `firebase-config.js` の `projectId` の値（`gov-edu-fci`）
- `ALLOWED_EMAIL_DOMAINS`: 許可したいメールドメイン（`fcihs-satoyama.ed.jp`）

---

わからないことがあれば、お気軽にお尋ねください！

