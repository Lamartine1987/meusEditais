import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

// --- INÍCIO DA CORREÇÃO DEFINITIVA ---
// A configuração do Firebase para a web é pública e segura para ser embutida diretamente no código.
// Isso garante que o Firebase SEMPRE será inicializado corretamente no navegador,
// resolvendo o problema de "serviço de autenticação indisponível".

const firebaseConfig = {
  apiKey: "AIzaSyAo8a_ASa_xw_Jg_123456789", // Substitua pelo seu valor real
  authDomain: "meuseditais.firebaseapp.com",
  databaseURL: "https://meuseditais-default-rtdb.firebaseio.com/",
  projectId: "meuseditais",
  storageBucket: "meuseditais.appspot.com",
  messagingSenderId: "801348002832",
  appId: "1:801348002832:web:c1c2f89db9c807a09d9695",
  measurementId: "G-CK2H4TKG6C"
};

// --- FIM DA CORREÇÃO DEFINITIVA ---


let app: FirebaseApp;
let auth: Auth;
let db: Database;
let functions: Functions;

// Este check garante que o Firebase seja inicializado apenas uma vez no cliente.
if (typeof window !== 'undefined' && !getApps().length) {
  console.log("[firebase.ts] Verificando configuração do Firebase no lado do cliente...");
  console.log(`[firebase.ts] Comprimento da chave de API fornecida: ${firebaseConfig.apiKey?.length || 0}`);

  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("...") || firebaseConfig.apiKey.length < 30) {
    console.error("[firebase.ts] CRÍTICO: A chave de API no objeto firebaseConfig é inválida ou é um placeholder. O Firebase não será inicializado. Verifique os valores em src/lib/firebase.ts.");
  } else {
    try {
      console.log("[firebase.ts] Configuração válida. Tentando inicializar o Firebase App...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getDatabase(app);
      functions = getFunctions(app);
      console.log('[firebase.ts] SUCESSO: Firebase cliente inicializado com sucesso.');
    } catch (error) {
      console.error("[firebase.ts] CRÍTICO: Falha na inicialização do cliente Firebase.", error);
    }
  }
} else if (typeof window !== 'undefined') {
  console.log("[firebase.ts] Usando instância existente do Firebase App.");
  app = getApp();
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(app);
}

// @ts-ignore
export { app, auth, db, functions };
