
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

// Configuração do Firebase
// A chave de API é injetada diretamente no placeholder __FIREBASE_API_KEY__
// durante o processo de deploy, garantindo que o valor correto esteja sempre disponível.
const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
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

// Validação para garantir que o placeholder foi substituído.
if (firebaseConfig.apiKey.startsWith("__") || firebaseConfig.apiKey === "") {
  console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: A chave de API do Firebase não foi substituída. A aplicação não funcionará corretamente. Verifique o processo de build e deploy.");
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
