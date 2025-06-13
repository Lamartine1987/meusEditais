
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Para usar Firestore no futuro

// ATENÇÃO: Substitua estas configurações pelas do seu projeto Firebase!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Substitua pelo seu API Key
  authDomain: "YOUR_AUTH_DOMAIN", // Substitua pelo seu Auth Domain
  projectId: "YOUR_PROJECT_ID", // Substitua pelo seu Project ID
  storageBucket: "YOUR_STORAGE_BUCKET", // Substitua pelo seu Storage Bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Substitua pelo seu Messaging Sender ID
  appId: "YOUR_APP_ID", // Substitua pelo seu App ID
  measurementId: "YOUR_MEASUREMENT_ID" // Opcional: Substitua pelo seu Measurement ID
};

let app: FirebaseApp;
let auth: Auth;
// let db; // Para Firestore

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
// db = getFirestore(app); // Para Firestore

export { app, auth /*, db */ };
