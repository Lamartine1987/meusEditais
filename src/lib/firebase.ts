
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config"; // Importa a configuração unificada

// Configuração do Firebase
// A chave de API agora é lida da configuração unificada,
// que por sua vez obtém o valor de uma variável de ambiente pública.
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

// Validação para garantir que a chave de API está presente.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("__") || firebaseConfig.apiKey === "") {
  console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: A chave de API do Firebase (NEXT_PUBLIC_GOOGLE_API_KEY) não foi encontrada. A aplicação não funcionará corretamente. Verifique o processo de build e deploy.");
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
