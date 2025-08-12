import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

// Configuração do Firebase usando a chave de API do appConfig
const firebaseConfig = {
  apiKey: appConfig.NEXT_PUBLIC_GOOGLE_API_KEY,
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

// Só inicializa o Firebase se a chave de API estiver presente
if (firebaseConfig.apiKey) {
  if (getApps().length === 0) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Falha ao inicializar o app Firebase:", e);
    }
  } else {
    app = getApp();
  }

  if (app) {
    try {
      auth = getAuth(app);
      db = getDatabase(app);
      functions = getFunctions(app);
    } catch (e) {
        console.error("Falha ao inicializar os serviços do Firebase (Auth, DB, Functions):", e);
    }
  }
} else {
    console.warn("🚨 AVISO: A chave de API do Firebase (NEXT_PUBLIC_GOOGLE_API_KEY) não está definida. As funcionalidades do Firebase ficarão indisponíveis. Isso é esperado durante o build, mas para rodar localmente, você precisa de um arquivo .env.local.");
}

export { app, auth, db, functions };
