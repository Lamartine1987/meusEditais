// src/lib/config.ts

interface AppConfig {
  // Segredos do Stripe
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
  
  // Chave de API do Google/Firebase
  NEXT_PUBLIC_FIREBASE_API_KEY: string;

  // Chave publicável do Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

export const appConfig: AppConfig = {
  // Lê as variáveis de ambiente individuais para o Stripe
  STRIPE_SECRET_KEY_PROD: process.env.STRIPE_SECRET_KEY_PROD || '',
  STRIPE_WEBHOOK_SECRET_PROD: process.env.STRIPE_WEBHOOK_SECRET_PROD || '',
  STRIPE_PRICE_ID_PLANO_CARGO: process.env.STRIPE_PRICE_ID_PLANO_CARGO || '',
  STRIPE_PRICE_ID_PLANO_EDITAL: process.env.STRIPE_PRICE_ID_PLANO_EDITAL || '',
  STRIPE_PRICE_ID_PLANO_ANUAL: process.env.STRIPE_PRICE_ID_PLANO_ANUAL || '',
  
  // Lê a variável de ambiente pública do Firebase (passada durante o build)
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  
  // Lê a variável de ambiente pública do Stripe (passada no runtime)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};
