import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

// Log para depuração no cliente
console.log(`[firebase.ts] Tentando inicializar o Firebase no cliente. Valor de NEXT_PUBLIC_FIREBASE_API_KEY: ${appConfig.NEXT_PUBLIC_FIREBASE_API_KEY ? 'ENCONTRADA' : 'AUSENTE!!!'}`);


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

// Este check garante que o Firebase seja inicializado apenas uma vez no cliente.
if (typeof window !== 'undefined' && !getApps().length) {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getDatabase(app);
      functions = getFunctions(app);
      console.log('[firebase.ts] Firebase cliente inicializado com SUCESSO.');
    } catch (error) {
      console.error("[firebase.ts] CRÍTICO: Falha na inicialização do cliente Firebase.", error);
    }
  } else {
    console.error(`[firebase.ts] CRÍTICO: A chave de API do Firebase é inválida ou está ausente. Firebase não será inicializado. Valor recebido foi: "${firebaseConfig.apiKey}"`);
  }
} else if (typeof window !== 'undefined') {
  app = getApp();
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app);
}

// @ts-ignore
export { app, auth, db, functions };
