import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

// Configuração do Firebase usando a chave de API do appConfig
const firebaseConfig = {
  apiKey: appConfig.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "meuseditais.firebaseapp.com",
  databaseURL: "https://meuseditais-default-rtdb.firebaseio.com/",
  projectId: "meuseditais",
  storageBucket: "meuseditais.appspot.com",
  messagingSenderId: "801348002832",
  appId: "1:801348002832:web:c1c2f89db9c807a09d9695",
  measurementId: "G-CK2H4TKG6C"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Database | undefined;
let functions: Functions | undefined;

console.log(`[firebase.ts] Starting initialization. apiKey available: ${!!firebaseConfig.apiKey}`);

// Só inicializa o Firebase se a chave de API estiver presente
if (firebaseConfig.apiKey) {
  if (getApps().length === 0) {
    try {
      console.log("[firebase.ts] No Firebase app found. Initializing a new one.");
      app = initializeApp(firebaseConfig);
      console.log("[firebase.ts] New Firebase app initialized successfully.");
    } catch (e: any) {
      console.error("[firebase.ts] CRITICAL: Failed to initialize new Firebase app. Error:", e.message);
    }
  } else {
    console.log("[firebase.ts] Existing Firebase app found. Getting app instance.");
    app = getApp();
    console.log("[firebase.ts] Got existing Firebase app instance.");
  }

  if (app) {
    try {
      console.log("[firebase.ts] App instance exists. Getting Auth, DB, and Functions services.");
      auth = getAuth(app);
      db = getDatabase(app);
      functions = getFunctions(app);
      console.log("[firebase.ts] Successfully got Auth, DB, and Functions services.");
    } catch (e: any) {
        console.error("[firebase.ts] CRITICAL: Failed to initialize Firebase services (Auth, DB, Functions). Error:", e.message);
    }
  } else {
      console.error("[firebase.ts] CRITICAL: Firebase app instance is not available after initialization attempt.");
  }
} else {
    // No ambiente de build, K_SERVICE não existe. Em produção, ele DEVE existir.
    if (process.env.K_SERVICE) {
        console.error("CRITICAL [Production ENV]: NEXT_PUBLIC_FIREBASE_API_KEY is not defined. Firebase features will fail.");
    } else {
        console.warn("WARNING [Build/Dev ENV]: NEXT_PUBLIC_FIREBASE_API_KEY is not defined. This is expected during build, but Firebase features will be unavailable until deployed with the secret.");
    }
}

export { app, auth, db, functions };
