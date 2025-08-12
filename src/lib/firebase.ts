import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { appConfig } from "./config";

// Configuração do Firebase usando a chave de API do appConfig
const firebaseConfig = {
  apiKey: appConfig.NEXT_PUBLIC_FIREBASE_API_KEY,
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

// Inicialização robusta do Firebase
try {
    if (!getApps().length) {
        // Só inicializa se nenhuma app existir E a chave de API for válida
        if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
            app = initializeApp(firebaseConfig);
        } else {
            // Se a chave não for válida, lança um erro para o bloco catch
            throw new Error("A chave de API do Firebase é inválida ou não foi encontrada.");
        }
    } else {
        // Se já existe uma app, apenas a obtém
        app = getApp();
    }

    // Obtém os serviços a partir da app inicializada
    auth = getAuth(app);
    db = getDatabase(app);
    functions = getFunctions(app);

} catch (error: any) {
    // Se a inicialização falhar por qualquer motivo (ex: chave inválida),
    // o erro é registrado, mas a aplicação não quebra.
    // As funcionalidades que dependem do Firebase (login, etc.) falharão graciosamente.
    console.warn(`[firebase.ts] AVISO: A inicialização do Firebase falhou. Motivo: ${error.message}`);
}

// @ts-ignore
export { app, auth, db, functions };
