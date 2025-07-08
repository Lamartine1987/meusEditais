
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database"; // Importar para usar Realtime Database
import { getFunctions, type Functions } from "firebase/functions";
// import { getAnalytics } from "firebase/analytics"; // Se você for usar o Analytics (opcional)

// Configuração do Firebase fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBNsEsDbmtxDGi-V3W--D3CF5mXbhOj5ZM",
  authDomain: "meuseditais.firebaseapp.com",
  projectId: "meuseditais",
  storageBucket: "meuseditais.appspot.com", // Corrigido para o padrão .appspot.com
  messagingSenderId: "801348002832",
  databaseURL: "https://meuseditais-default-rtdb.firebaseio.com/", // Adicionado o URL do Realtime Database
  appId: "1:801348002832:web:c1c2f89db9c807a09d9695",
  measurementId: "G-CK2H4TKG6C" // Opcional
};

let app: FirebaseApp;
let auth: Auth;
let db: Database; // Variável para o Realtime Database
let functions: Functions;
// let analytics; // Para Firebase Analytics

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Se você for usar o Analytics, descomente a linha abaixo
  // analytics = getAnalytics(app);
} else {
  app = getApp();
  // Se você for usar o Analytics e o app já foi inicializado
  // analytics = getAnalytics(app);
}

auth = getAuth(app);
db = getDatabase(app); // Inicializar o Realtime Database
functions = getFunctions(app); // Inicializa o Cloud Functions (sem região específica)

// Para testes locais com o Firebase Emulator Suite, você pode descomentar as linhas abaixo
// import { connectFunctionsEmulator } from "firebase/functions";
// if (process.env.NODE_ENV === 'development') {
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }

export { app, auth, db, functions /*, analytics */ };
