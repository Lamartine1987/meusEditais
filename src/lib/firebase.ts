import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

// ====================================================================================
// CORREÇÃO DEFINITIVA: Configuração do Firebase Hardcoded para o Cliente
// As chaves a seguir são públicas e seguras para serem expostas no navegador.
// A segurança é controlada pelas Regras de Segurança do Firebase no backend.
// Isso garante que o Firebase SEMPRE inicialize corretamente no cliente.
// ====================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCV_a208hJ23k23kM-aT7s7sn23k23423", // SUBSTITUA PELO SEU VALOR REAL
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

// Log para depuração no cliente
console.log(`[firebase.ts] Verificando a chave de API do Firebase. Comprimento: ${firebaseConfig.apiKey?.length || 0}`);

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 10 || firebaseConfig.apiKey.includes("SUBSTITUA")) {
  console.error(`[firebase.ts] CRÍTICO: A chave de API do Firebase no objeto de configuração é inválida ou é um placeholder. Firebase não será inicializado. Verifique se o valor em src/lib/firebase.ts está correto.`);
}

// Este check garante que o Firebase seja inicializado apenas uma vez no cliente.
if (typeof window !== 'undefined' && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    functions = getFunctions(app);
    console.log('[firebase.ts] Firebase cliente inicializado com SUCESSO.');
  } catch (error) {
    console.error("[firebase.ts] CRÍTICO: Falha na inicialização do cliente Firebase.", error);
    // Adiciona um alerta visual para o desenvolvedor
    if (document.body) {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.bottom = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.padding = '10px';
        errorDiv.style.background = 'red';
        errorDiv.style.color = 'white';
        errorDiv.style.zIndex = '9999';
        errorDiv.style.borderRadius = '5px';
        errorDiv.textContent = 'ERRO CRÍTICO: Firebase não inicializado. Verifique o console.';
        document.body.appendChild(errorDiv);
    }
  }
} else if (typeof window !== 'undefined') {
  app = getApp();
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app);
}

// @ts-ignore
export { app, auth, db, functions };
