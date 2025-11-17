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
  'fcidux.dpdns.org',  // テスト用ドメイン
  // 'gmail.com',  // 動作確認用: テストが必要な場合のみコメントアウトを外す（すべてのGmailアカウントが許可されます）
  // 'yahoo.co.jp',  // 動作確認用: 必要に応じて追加
];

// 本番環境で許可する特定のメールアドレス（動作確認用）
// ⚠️ 注意: このリストはGitHubに公開されます。個人情報を含めないように注意してください
// テストが完了したら、このリストを空にするか削除してください
// ローカル環境でのテストは auth.local.js を使用することを推奨します
const PROD_ALLOWED_EMAILS = [
  // テスト用メールアドレス: 必要に応じて追加してください
  // 例: 'test@example.com',
];

// 開発者用: 許可されたGitHubユーザー名のリスト
// ⚠️ 注意: このリストはGitHubに公開されます。ユーザー名のみを記載してください
// 開発者がGitHub認証でログインできるようにするためのリストです
// 例: ['developer1', 'developer2']
const ALLOWED_GITHUB_USERNAMES = [
  'Fuku856',
  'yosh-20',
  // 開発者用: GitHubユーザー名を追加してください
  // 例: 'your-github-username',
];

// 開発者用: 許可されたGitHubアカウントのメールアドレスリスト
// ⚠️ 注意: このリストはGitHubに公開されます。必要に応じてメールアドレスを追加できます
// GitHubユーザー名よりも柔軟な認証が可能ですが、プライバシーに注意してください
const ALLOWED_GITHUB_EMAILS = [
  // 開発者用: GitHubアカウントのメールアドレスを追加してください
  // 例: 'developer@example.com',
];

// Firebase初期化
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
} else {
  console.error('Firebase SDKが読み込まれていません。firebase-app.jsを先に読み込んでください。');
}

