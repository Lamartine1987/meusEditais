
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Para usar Firestore no futuro
// import { getAnalytics } from "firebase/analytics"; // Se você for usar o Analytics

// Configuração do Firebase fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBNsEsDbmtxDGi-V3W--D3CF5mXbhOj5ZM",
  authDomain: "meuseditais.firebaseapp.com",
  projectId: "meuseditais",
  storageBucket: "meuseditais.firebasestorage.app", // Corrigido de .firebasestorage.app para .appspot.com se for o padrão, mas mantendo o fornecido pelo usuário. Firebase geralmente usa .appspot.com para storageBucket, mas se o console gerou .firebasestorage.app, usaremos isso.
  messagingSenderId: "801348002832",
  appId: "1:801348002832:web:c1c2f89db9c807a09d9695",
  measurementId: "G-CK2H4TKG6C" // Opcional
};

let app: FirebaseApp;
let auth: Auth;
// let db; // Para Firestore
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
// db = getFirestore(app); // Para Firestore

export { app, auth /*, db, analytics */ };
