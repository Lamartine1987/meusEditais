import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from './config';

// Configuração do Firebase
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

// Validação crucial para garantir que a chave de API está presente.
if (!firebaseConfig.apiKey) {
  if (process.env.NODE_ENV === "production") {
    // Em produção, a chave de API é obrigatória.
    throw new Error("A inicialização do Firebase foi bloqueada devido a uma chave de API inválida.");
  } else {
    // Em desenvolvimento, avise o desenvolvedor, mas não quebre o build.
    console.warn("🚨 AVISO DE DESENVOLVIMENTO: A variável NEXT_PUBLIC_GOOGLE_API_KEY não está definida. As funcionalidades do Firebase não estarão disponíveis, mas a aplicação continuará a rodar.");
  }
}

// Inicializa o Firebase apenas uma vez e se a chave de API existir
if (firebaseConfig.apiKey) {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
}

// Inicializa os serviços apenas se a app foi inicializada com sucesso
if (app) {
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app); // Habilita o serviço de Functions
}

export { app, auth, db, functions };
