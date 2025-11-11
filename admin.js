/**
 * 管理者権限管理
 * Firestoreのadminsコレクションを使用して管理者権限を管理
 */

/**
 * 現在のユーザーが管理者かどうかをチェック
 * Firestoreのadminsコレクションから確認（サーバーサイドで検証される）
 * @returns {Promise<boolean>} 管理者かどうか
 */
async function isAdmin() {
  const user = firebase.auth().currentUser;
  if (!user) {
    return false;
  }
  
  try {
    // Firestoreのadminsコレクションから管理者情報を取得
    // セキュリティルールで保護されているため、管理者でない場合はアクセスできない
    const adminDoc = await firebase.firestore()
      .collection('admins')
      .doc(user.uid)  // ユーザーID（UID）で確認
      .get();
    
    return adminDoc.exists && adminDoc.data().isAdmin === true;
  } catch (error) {
    console.error('管理者チェックエラー:', error);
    // 権限エラーの場合もfalseを返す
    if (error.code === 'permission-denied') {
      return false;
    }
    return false;
  }
}

/**
 * 現在のユーザーがスーパー管理者かどうかをチェック
 * @returns {Promise<boolean>} スーパー管理者かどうか
 */
async function isSuperAdmin() {
  const user = firebase.auth().currentUser;
  if (!user) {
    return false;
  }
  
  try {
    const adminDoc = await firebase.firestore()
      .collection('admins')
      .doc(user.uid)
      .get();
    
    if (!adminDoc.exists) {
      return false;
    }
    
    const adminData = adminDoc.data();
    return adminData.isAdmin === true && adminData.role === 'super_admin';
  } catch (error) {
    console.error('スーパー管理者チェックエラー:', error);
    if (error.code === 'permission-denied') {
      return false;
    }
    return false;
  }
}

/**
 * 管理者情報を取得
 * @returns {Promise<Object|null>} 管理者情報（管理者でない場合はnull）
 */
async function getAdminInfo() {
  const user = firebase.auth().currentUser;
  if (!user) {
    return null;
  }
  
  try {
    const adminDoc = await firebase.firestore()
      .collection('admins')
      .doc(user.uid)
      .get();
    
    if (!adminDoc.exists) {
      return null;
    }
    
    return {
      userId: adminDoc.id,
      ...adminDoc.data()
    };
  } catch (error) {
    console.error('管理者情報取得エラー:', error);
    return null;
  }
}

/**
 * 管理者リストを取得（スーパー管理者のみ）
 * @returns {Promise<Array>} 管理者リスト
 */
async function getAdminList() {
  const user = firebase.auth().currentUser;
  if (!user) {
    return [];
  }
  
  try {
    // スーパー管理者かどうかをチェック
    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
      throw new Error('スーパー管理者権限が必要です。');
    }
    
    const snapshot = await firebase.firestore()
      .collection('admins')
      .get();
    
    return snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('管理者リスト取得エラー:', error);
    if (error.code === 'permission-denied') {
      throw new Error('管理者権限が必要です。');
    }
    throw error;
  }
}

/**
 * 管理者を追加（スーパー管理者のみ）
 * @param {string} uid - ユーザーID
 * @param {string} email - メールアドレス
 * @param {string} displayName - 表示名
 * @param {string} role - 役割（'admin' または 'super_admin'）
 * @returns {Promise<void>}
 */
async function addAdmin(uid, email, displayName, role = 'admin') {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error('ログインが必要です。');
  }
  
  // スーパー管理者かどうかをチェック
  const superAdmin = await isSuperAdmin();
  if (!superAdmin) {
    throw new Error('スーパー管理者権限が必要です。');
  }
  
  try {
    await firebase.firestore()
      .collection('admins')
      .doc(uid)
      .set({
        userId: uid,
        email: email,
        displayName: displayName || email.split('@')[0],
        isAdmin: true,
        role: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user.uid
      });
  } catch (error) {
    console.error('管理者追加エラー:', error);
    if (error.code === 'permission-denied') {
      throw new Error('管理者権限が必要です。');
    }
    throw error;
  }
}

/**
 * 管理者を削除（スーパー管理者のみ）
 * @param {string} adminId - 管理者のユーザーID
 * @returns {Promise<void>}
 */
async function removeAdmin(adminId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error('ログインが必要です。');
  }
  
  // 自分自身は削除できない
  if (adminId === user.uid) {
    throw new Error('自分自身を管理者から削除することはできません。');
  }
  
  // スーパー管理者かどうかをチェック
  const superAdmin = await isSuperAdmin();
  if (!superAdmin) {
    throw new Error('スーパー管理者権限が必要です。');
  }
  
  try {
    await firebase.firestore()
      .collection('admins')
      .doc(adminId)
      .delete();
  } catch (error) {
    console.error('管理者削除エラー:', error);
    if (error.code === 'permission-denied') {
      throw new Error('管理者権限が必要です。');
    }
    throw error;
  }
}

// グローバルに公開
window.isAdmin = isAdmin;
window.isSuperAdmin = isSuperAdmin;
window.getAdminInfo = getAdminInfo;
window.getAdminList = getAdminList;
window.addAdmin = addAdmin;
window.removeAdmin = removeAdmin;
