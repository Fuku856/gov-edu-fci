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
// 動作確認用に個人のメールアドレスを追加する場合は、ここにドメインを追加
// 例: Gmailの場合は 'gmail.com' を追加
const ALLOWED_EMAIL_DOMAINS = [
  'fcihs-satoyama.ed.jp',  // 学校のメールドメイン
  // 'gmail.com',  // 動作確認用: コメントアウトを外して有効化
  // 'yahoo.co.jp',  // 動作確認用: 必要に応じて追加
];

// Firebase初期化
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
} else {
  console.error('Firebase SDKが読み込まれていません。firebase-app.jsを先に読み込んでください。');
}

