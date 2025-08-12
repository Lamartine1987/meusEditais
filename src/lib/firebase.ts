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

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Database | undefined;
let functions: Functions | undefined;

// DEBUG LOG: Adicionado para verificar a chave de API antes da inicialização
if (typeof window !== 'undefined') { // Log apenas no lado do cliente
    console.log(`[firebase.ts] DEBUG: Attempting to initialize Firebase. Is apiKey valid? ${!!(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10)}`);
}

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
            if (typeof window !== 'undefined') {
                console.log("[firebase.ts] DEBUG: Firebase initialized for the first time.");
            }
        } else {
            app = getApp();
            if (typeof window !== 'undefined') {
                console.log("[firebase.ts] DEBUG: Firebase app already exists. Getting instance.");
            }
        }
        
        // Se a inicialização foi bem-sucedida, obtenha os serviços
        auth = getAuth(app);
        db = getDatabase(app);
        functions = getFunctions(app);
        if (typeof window !== 'undefined') {
             console.log("[firebase.ts] DEBUG: Firebase services (auth, db, functions) were obtained.");
        }
    } else {
        // Se a chave não for válida, lança um erro para o bloco catch
        throw new Error("A chave de API do Firebase é inválida ou não foi encontrada.");
    }

} catch (error: any) {
    // Se a inicialização falhar por qualquer motivo (ex: chave inválida),
    // o erro é registrado, mas a aplicação não quebra.
    // As funcionalidades que dependem do Firebase (login, etc.) falharão graciosamente.
    console.error(`[firebase.ts] CRITICAL DEBUG: A inicialização do Firebase falhou. Motivo: ${error.message}`);
}

// Exporta as variáveis que podem ser undefined se a inicialização falhar
export { app, auth, db, functions };
