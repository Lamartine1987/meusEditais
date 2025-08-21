import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

console.log('[firebase.ts] Lendo appConfig.NEXT_PUBLIC_FIREBASE_API_KEY:', appConfig.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Presente' : 'AUSENTE!!!');

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
if (typeof window !== 'undefined' && !getApps().length) {
  console.log('[firebase.ts] Tentando inicializar Firebase no cliente...');
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getDatabase(app);
      functions = getFunctions(app);
      console.log('[firebase.ts] SUCESSO: Firebase client inicializado com sucesso.');
    } catch (error) {
      console.error("[firebase.ts] CRITICAL: Falha na inicialização do Firebase client.", error);
    }
  } else {
    console.error("[firebase.ts] CRITICAL: A chave de API do Firebase é inválida ou está ausente. Firebase não será inicializado.");
  }
} else if (typeof window !== 'undefined') {
  console.log('[firebase.ts] Usando instância existente do Firebase client.');
  app = getApp();
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app);
}

// @ts-ignore
export { app, auth, db, functions };
