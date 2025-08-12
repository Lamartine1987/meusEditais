import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

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

let app: FirebaseApp;
let auth: Auth;
let db: Database;
let functions: Functions;

// This check ensures that Firebase is only initialized on the client side.
// It prevents the "Firebase App named '[DEFAULT]' already exists" error in development
// and ensures server-side rendering builds don't fail due to missing API keys.
if (typeof window !== 'undefined' && !getApps().length) {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getDatabase(app);
      functions = getFunctions(app);
    } catch (error) {
      console.error("[firebase.ts] CRITICAL: Firebase client initialization failed.", error);
    }
  } else {
    console.error("[firebase.ts] CRITICAL: Firebase API key is invalid or missing. Firebase will not be initialized.");
  }
} else if (typeof window !== 'undefined') {
  app = getApp();
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app);
}

// We export the initialized services. They will be undefined on the server-side,
// and the application code (like AuthProvider) should handle this gracefully.
// @ts-ignore
export { app, auth, db, functions };
