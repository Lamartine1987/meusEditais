
import { initializeApp as initializeAdminApp, getApps as getAdminApps, App as AdminApp, credential } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase, Database } from 'firebase-admin/database';
import { auth as adminAuth } from 'firebase-admin';

let adminDb: Database;
let auth: adminAuth.Auth;

// This pattern ensures we're not re-initializing the app on every hot-reload or serverless function invocation.
if (!getAdminApps().length) {
  try {
    // When deployed to Google Cloud environments, the SDK can automatically discover credentials.
    // No need to pass a service account key file.
    console.log("[firebase-admin.ts] Initializing Firebase Admin SDK...");
    const adminApp = initializeAdminApp({
      databaseURL: "https://meuseditais-default-rtdb.firebaseio.com/"
    });
    
    adminDb = getAdminDatabase(adminApp);
    auth = adminAuth(adminApp);
    console.log("[firebase-admin.ts] Firebase Admin SDK initialized successfully.");

  } catch (error: any) {
    console.error("[firebase-admin.ts] CRITICAL: Failed to initialize Firebase Admin SDK.", error);
    // Create a dummy object to prevent the app from crashing, while logging the error.
    adminDb = { ref: () => { throw new Error("Firebase Admin DB not initialized."); } } as unknown as Database;
    auth = { verifyIdToken: () => { throw new Error("Firebase Admin Auth not initialized."); } } as unknown as adminAuth.Auth;
  }
} else {
    const adminApp = getAdminApps()[0];
    adminDb = getAdminDatabase(adminApp);
    auth = adminAuth(adminApp);
    console.log("[firebase-admin.ts] Using existing Firebase Admin SDK instance.");
}

export { adminDb, auth };
