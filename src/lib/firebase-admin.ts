
import { initializeApp as initializeAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase, Database } from 'firebase-admin/database';

const ADMIN_APP_NAME = 'firebase-admin-app-meuseditais';

let adminDb: Database;

try {
  const adminApps = getAdminApps();
  const existingAdminApp = adminApps.find(app => app?.name === ADMIN_APP_NAME);
  
  const adminApp = existingAdminApp || initializeAdminApp({
    databaseURL: "https://meuseditais-default-rtdb.firebaseio.com/"
  }, ADMIN_APP_NAME);

  adminDb = getAdminDatabase(adminApp);
  
  const adminUids = (process.env.NEXT_PUBLIC_FIREBASE_ADMIN_UIDS || '').split(',');
  adminUids.forEach(uid => {
    if (uid) {
      const userRef = adminDb.ref(`users/${uid}`);
      userRef.child('isAdmin').set(true).catch(err => {
        console.error(`Failed to set admin status for UID ${uid}:`, err);
      });
    }
  });

} catch (error: any) {
  console.error("CRITICAL: Failed to initialize Firebase Admin SDK. This will cause database operations to fail.", error);
  adminDb = {
    ref: (path: string) => {
      console.error(`Firebase Admin DB not initialized. Attempted to access path: ${path}`);
      throw new Error("Firebase Admin DB not initialized. Check server startup logs for the original error.");
    },
  } as unknown as Database;
}


export { adminDb };
