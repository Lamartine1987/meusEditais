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

let app: FirebaseApp;
let auth: Auth;
let db: Database;
let functions: Functions;

function initializeFirebaseServices() {
    const firebaseConfig = getFirebaseConfig();

    if (!firebaseConfig.apiKey) {
        if (process.env.K_SERVICE) {
            console.error("ERRO CRÍTICO EM PRODUÇÃO: A chave de API do Firebase não foi encontrada. Verifique a configuração de segredos do App Hosting.");
            throw new Error("A inicialização do Firebase em produção foi bloqueada devido a uma chave de API inválida.");
        } else {
            console.warn("🚨 AVISO DE BUILD/DEV: A variável NEXT_PUBLIC_GOOGLE_API_KEY não está definida. Isso é esperado durante o build, mas as funcionalidades do Firebase não estarão disponíveis até a implantação.");
            return; // Interrompe a inicialização se a chave não estiver disponível
        }
    }

    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }

    // Inicializa todos os serviços se a app foi inicializada com sucesso
    auth = getAuth(app);
    db = getDatabase(app);
    functions = getFunctions(app); // Garante que as Functions sejam inicializadas
}

function getFirebaseConfig() {
  const firebaseConfigJson = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (firebaseConfigJson) {
    try {
      console.log("Usando configuração do Firebase injetada pelo App Hosting.");
      return JSON.parse(firebaseConfigJson);
    } catch (e) {
      console.error("Falha ao analisar NEXT_PUBLIC_FIREBASE_CONFIG, usando fallback.", e);
    }
  }
  
  console.log("Usando configuração de fallback do Firebase.");
  return fallbackFirebaseConfig;
}

// Chama a função para inicializar os serviços
try {
    initializeFirebaseServices();
} catch (error) {
    console.error("Falha crítica durante a inicialização do Firebase:", error);
}

// Exporta as variáveis que podem estar indefinidas se a inicialização falhar
export { app, auth, db, functions };
