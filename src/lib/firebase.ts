import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

// Configuração de fallback do Firebase para desenvolvimento local e build
const fallbackFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
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

function getFirebaseConfig() {
  // O App Hosting injeta a configuração via NEXT_PUBLIC_FIREBASE_CONFIG
  const firebaseConfigJson = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (firebaseConfigJson) {
    try {
      console.log("Usando configuração do Firebase injetada pelo App Hosting.");
      return JSON.parse(firebaseConfigJson);
    } catch (e) {
      console.error("Falha ao analisar NEXT_PUBLIC_FIREBASE_CONFIG, usando fallback.", e);
    }
  }
  
  // Se não estiver no App Hosting ou a variável falhar, use o fallback
  console.log("Usando configuração de fallback do Firebase.");
  return fallbackFirebaseConfig;
}

const firebaseConfig = getFirebaseConfig();

// Validação crucial para garantir que a chave de API esteja presente.
if (!firebaseConfig.apiKey) {
  // A variável K_SERVICE é definida pelo Google Cloud Run (usado pelo App Hosting).
  // Ela só existe no ambiente de execução de produção, não durante o build.
  // Isso garante que o build não falhe, mas a app em produção pare se a chave estiver faltando.
  if (process.env.K_SERVICE) {
    console.error("ERRO CRÍTICO EM PRODUÇÃO: A chave de API do Firebase não foi encontrada. Verifique a configuração de segredos do App Hosting.");
    throw new Error("A inicialização do Firebase em produção foi bloqueada devido a uma chave de API inválida.");
  } else {
    // Em ambientes de build ou desenvolvimento local, apenas avise.
    console.warn("🚨 AVISO DE BUILD/DEV: A chave de API do Firebase não está definida. Isso é esperado, mas as funcionalidades do Firebase não estarão disponíveis até a implantação.");
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
