
'use server';

import { initializeApp as initializeAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';

// It's important to use a unique name for the admin app to avoid conflicts with the client app
const ADMIN_APP_NAME = 'firebase-admin-app-meuseditais';

// This is the Database URL from your `firebase.ts` client config
const DATABASE_URL = "https://meuseditais-default-rtdb.firebaseio.com/";

function getAdminApp(): AdminApp {
    const adminApps = getAdminApps();
    const existingAdminApp = adminApps.find(app => app.name === ADMIN_APP_NAME);
    if (existingAdminApp) {
        return existingAdminApp;
    }
    
    // In Firebase App Hosting and other Google Cloud environments,
    // initializeApp() with no arguments automatically uses the service account
    // credentials of the environment, which have admin privileges.
    return initializeAdminApp({
        databaseURL: DATABASE_URL,
    }, ADMIN_APP_NAME);
}

const adminApp = getAdminApp();
const adminDb = getAdminDatabase(adminApp);

export { adminDb };
