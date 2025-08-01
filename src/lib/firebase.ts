import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

// Configuração do Firebase
// Lendo a chave de API pública diretamente do objeto de configuração, que por sua vez
// lê da variável de ambiente injetada pelo App Hosting.
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

// Validação crucial para garantir que a chave de API está presente durante o build e no runtime.
// O valor '__FIREBASE_API_KEY__' indica que a substituição pelo App Hosting não ocorreu.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('__')) {
  console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: NEXT_PUBLIC_GOOGLE_API_KEY não foi encontrada ou não foi substituída. A aplicação não funcionará. Verifique o apphosting.yaml e as configurações do backend.");
}

// Inicializa o Firebase apenas uma vez
if (getApps().length === 0) {
  // Apenas inicialize se a chave de API for válida
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('__')) {
    app = initializeApp(firebaseConfig);
  } else {
    // Se a chave não for válida, lançar um erro mais claro impede que a app tente rodar em um estado quebrado.
    throw new Error("A inicialização do Firebase foi bloqueada devido a uma chave de API inválida.");
  }
} else {
  app = getApp();
}

auth = getAuth(app);
db = getDatabase(app);
functions = getFunctions(app);

export { app, auth, db, functions };
