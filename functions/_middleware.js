/**
 * Cloudflare Pages Functions - Firebase Authentication Middleware
 * 
 * 注意: 現在はクライアント側認証のみを使用しています
 * 
 * サーバー側の認証チェックは無効化されています。
 * 理由: クライアント側（auth.js）で認証チェックを行うため、
 * サーバー側でリダイレクトを行うとリダイレクトループが発生します。
 * 
 * クライアント側の認証で、未認証ユーザーにはログインページが表示され、
 * 認証済みユーザーのみがサイトのコンテンツを見ることができます。
 */

export async function onRequest(context) {
  // すべてのリクエストを許可
  // 認証チェックはクライアント側（auth.js）で行われます
  return context.next();
}
