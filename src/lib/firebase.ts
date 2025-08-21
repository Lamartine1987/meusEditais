import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

// A chave de API agora é lida da variável de ambiente injetada pelo processo de build.
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

console.log(`[firebase.ts] Lendo a chave de API do Firebase injetada pelo build. Comprimento: ${firebaseApiKey?.length || 0}`);

const firebaseConfig = {
  apiKey: firebaseApiKey,
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

if (!firebaseApiKey || firebaseApiKey.length < 10) {
  console.error(`[firebase.ts] CRÍTICO: A chave de API do Firebase (NEXT_PUBLIC_FIREBASE_API_KEY) é inválida ou está ausente no ambiente. Firebase não será inicializado. Verifique a configuração do apphosting.yaml.`);
}

// Este check garante que o Firebase seja inicializado apenas uma vez no cliente.
if (typeof window !== 'undefined' && !getApps().length) {
  try {
    if (!firebaseApiKey) {
      throw new Error("A chave de API do Firebase é obrigatória para a inicialização.");
    }
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
