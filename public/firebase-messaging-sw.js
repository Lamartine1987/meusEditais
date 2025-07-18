// Scripts para o Firebase e Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBNsEsDbmtxDGi-V3W--D3CF5mXbhOj5ZM",
  authDomain: "meuseditais.firebaseapp.com",
  projectId: "meuseditais",
  storageBucket: "meuseditais.appspot.com",
  messagingSenderId: "801348002832",
  appId: "1:801348002832:web:c1c2f89db9c807a09d9695",
  measurementId: "G-CK2H4TKG6C"
};

// Inicializa o Firebase no service worker
firebase.initializeApp(firebaseConfig);

// Obtém uma instância do Firebase Messaging para lidar com mensagens em segundo plano
const messaging = firebase.messaging();

// Este manipulador de background é opcional, mas recomendado para lidar com notificações
// quando o app não está em primeiro plano.
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png' // Opcional: adicione um ícone na pasta public
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
