
import { initializeApp, getApp, getApps, type App } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App;
let adminDb: Database;
let auth: Auth;

// Este padrão garante que não estamos reinicializando o app em cada hot-reload ou invocação de função serverless.
if (!getApps().length) {
  try {
    console.log("[firebase-admin.ts] Initializing Firebase Admin SDK...");
    adminApp = initializeApp({
      databaseURL: "https://meuseditais-default-rtdb.firebaseio.com/"
    });
    console.log("[firebase-admin.ts] Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("[firebase-admin.ts] CRITICAL: Failed to initialize Firebase Admin SDK.", error);
    // Lança um erro para interromper o processo se a inicialização falhar,
    // pois a aplicação não pode funcionar corretamente sem ela.
    throw new Error("Could not initialize Firebase Admin SDK. See server logs for details.");
  }
} else {
  adminApp = getApp();
  console.log("[firebase-admin.ts] Using existing Firebase Admin SDK instance.");
}

// Obtém os serviços usando a instância do app inicializada.
adminDb = getDatabase(adminApp);
auth = getAuth(adminApp);

export { adminDb, auth };
