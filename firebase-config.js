/**
 * Firebase設定ファイル
 * Firebase Consoleから取得した設定値をここに記述してください
 */

// Firebase設定オブジェクト
// Firebase Console > プロジェクト設定 > 全般 > アプリ > Webアプリ から取得
const firebaseConfig = {
  apiKey: "AIzaSyCxt-8SECYvJ_8CJumBKrEv1ZAOSSrWqFQ",
  authDomain: "gov-edu-fci.firebaseapp.com",
  projectId: "gov-edu-fci",
  storageBucket: "gov-edu-fci.firebasestorage.app",
  messagingSenderId: "830393909667",
  appId: "1:830393909667:web:d3052045b63b380ccd5a16"
};

// 許可されたメールドメイン（学校のメールアドレスのドメイン）
// 例: ['your-school.edu', 'example.edu']
const ALLOWED_EMAIL_DOMAINS = [
  'fcihs-satoyama.ed.jp',  // 学校のメールドメイン
  // 'gmail.com',  // 動作確認用: テストが必要な場合のみコメントアウトを外す（すべてのGmailアカウントが許可されます）
  // 'yahoo.co.jp',  // 動作確認用: 必要に応じて追加
];

// 本番環境で許可する特定のメールアドレス（動作確認用）
// ⚠️ 注意: このリストはGitHubに公開されます。個人情報を含めないように注意してください
// テストが完了したら、このリストを空にするか削除してください
// ローカル環境でのテストは auth.local.js を使用することを推奨します
const PROD_ALLOWED_EMAILS = [
        'hachi56kiku56@gmail.com',  // テスト用: 本番環境でテストが必要な場合のみコメントアウトを外す
  // テストが完了したら、この行を削除してください
];

// Firebase初期化
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
} else {
  console.error('Firebase SDKが読み込まれていません。firebase-app.jsを先に読み込んでください。');
}

