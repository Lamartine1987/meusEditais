
import { initializeApp as initializeAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';

const ADMIN_APP_NAME = 'firebase-admin-app-meuseditais';

function getAdminApp(): AdminApp {
    const adminApps = getAdminApps();
    const existingAdminApp = adminApps.find(app => app.name === ADMIN_APP_NAME);
    if (existingAdminApp) {
        return existingAdminApp;
    }
    
    // In Firebase App Hosting and other Google Cloud environments,
    // initializeApp() with no arguments automatically uses the service account
    // credentials and the FIREBASE_CONFIG environment variable (which includes the databaseURL).
    return initializeAdminApp(undefined, ADMIN_APP_NAME);
}

const adminApp = getAdminApp();
const adminDb = getDatabase(adminApp);

export { adminDb };
