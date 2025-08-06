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

let app: FirebaseApp;
let auth: Auth;
let db: Database;
let functions: Functions;

// Validação crucial para garantir que a chave de API está presente.
if (!firebaseConfig.apiKey) {
  const errorMessage = "ERRO CRÍTICO DE CONFIGURAÇÃO: NEXT_PUBLIC_GOOGLE_API_KEY não foi encontrada. A aplicação não funcionará. Verifique o apphosting.yaml e as configurações do backend.";
  console.error(errorMessage);
  // Apenas lança o erro em produção, permitindo que o build local/de desenvolvimento continue com um aviso.
  if (process.env.NODE_ENV === 'production') {
    throw new Error("A inicialização do Firebase foi bloqueada devido a uma chave de API inválida.");
  }
}

// Inicializa o Firebase apenas uma vez
if (getApps().length === 0) {
  // Apenas inicialize se a chave de API for válida
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
  } else {
    // Em ambientes de não produção, a app pode continuar sem inicializar o Firebase,
    // embora as funcionalidades dependentes dele não funcionem.
    console.warn("Firebase não inicializado no ambiente de desenvolvimento devido à chave de API ausente.");
  }
} else {
  app = getApp();
}

// Inicializa os serviços apenas se a app foi inicializada
if (app!) {
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app);
}


export { app, auth, db, functions };
