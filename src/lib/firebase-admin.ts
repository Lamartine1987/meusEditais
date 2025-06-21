
import { initializeApp as initializeAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase, Database } from 'firebase-admin/database';

const ADMIN_APP_NAME = 'firebase-admin-app-meuseditais';

let adminDb: Database;

try {
  const adminApps = getAdminApps();
  const existingAdminApp = adminApps.find(app => app?.name === ADMIN_APP_NAME);
  
  // In Firebase App Hosting and other Google Cloud environments,
  // initializeApp() with no arguments automatically uses the service account
  // credentials and the FIREBASE_CONFIG environment variable.
  const adminApp = existingAdminApp || initializeAdminApp(undefined, ADMIN_APP_NAME);

  adminDb = getAdminDatabase(adminApp);

} catch (error: any) {
  console.error("CRITICAL: Failed to initialize Firebase Admin SDK. This will cause database operations to fail.", error);
  // Create a dummy object so the app doesn't crash on startup.
  // Any call to this object's methods will throw a clear error at runtime.
  adminDb = {
    ref: (path: string) => {
      console.error(`Firebase Admin DB not initialized. Attempted to access path: ${path}`);
      throw new Error("Firebase Admin DB not initialized. Check server startup logs for the original error.");
    },
    // Add other methods that might be called if necessary, but ref is the main one.
  } as unknown as Database;
}


export { adminDb };
