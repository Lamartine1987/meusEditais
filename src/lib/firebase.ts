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

// Validação crucial para garantir que a chave de API esteja presente.
if (!firebaseConfig.apiKey) {
  // A variável K_SERVICE é definida pelo Google Cloud Run (usado pelo App Hosting).
  // Ela só existe no ambiente de execução de produção, não durante o build.
  // Isso garante que o build não falhe, mas a app em produção pare se a chave estiver faltando.
  if (process.env.K_SERVICE) {
    console.error("ERRO CRÍTICO EM PRODUÇÃO: NEXT_PUBLIC_GOOGLE_API_KEY não foi injetada no ambiente de execução. Verifique a configuração de segredos do App Hosting.");
    throw new Error("A inicialização do Firebase em produção foi bloqueada devido a uma chave de API inválida.");
  } else {
    // Em ambientes de build ou desenvolvimento local, apenas avise.
    console.warn("🚨 AVISO DE BUILD/DEV: A variável NEXT_PUBLIC_GOOGLE_API_KEY não está definida. Isso é esperado durante o build, mas as funcionalidades do Firebase não estarão disponíveis até a implantação.");
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
