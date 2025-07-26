
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

// Configuração do Firebase
// A chave de API agora é lida diretamente da variável de ambiente pública
// injetada pelo processo de build do Next.js.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
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

// Validação para garantir que a chave de API está presente.
// Em produção, esta chave será substituída pelo valor real do App Hosting.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === '__FIREBASE_API_KEY__') {
  console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: A variável de ambiente NEXT_PUBLIC_GOOGLE_API_KEY não foi encontrada ou não foi substituída. A aplicação não funcionará corretamente. Verifique o processo de build e deploy.");
}

// Inicializa o Firebase apenas uma vez
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
db = getDatabase(app);
functions = getFunctions(app);

export { app, auth, db, functions };
