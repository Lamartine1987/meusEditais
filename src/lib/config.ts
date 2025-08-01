// src/lib/config.ts
import 'dotenv/config';

interface AppConfig {
  // Segredos do Secret Manager
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
  FIREBASE_ADMIN_UIDS: string;

  // Chaves Públicas (do env direto)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
}

// Este objeto exporta as variáveis de ambiente para serem usadas em toda a aplicação.
// Ele lê os valores de `process.env`, que são populados pelo App Hosting em produção
// ou por um arquivo .env durante o desenvolvimento local.
export const appConfig: AppConfig = {
  STRIPE_SECRET_KEY_PROD: process.env.STRIPE_SECRET_KEY_PROD || '',
  STRIPE_WEBHOOK_SECRET_PROD: process.env.STRIPE_WEBHOOK_SECRET_PROD || '',
  STRIPE_PRICE_ID_PLANO_CARGO: process.env.STRIPE_PRICE_ID_PLANO_CARGO || '',
  STRIPE_PRICE_ID_PLANO_EDITAL: process.env.STRIPE_PRICE_ID_PLANO_EDITAL || '',
  STRIPE_PRICE_ID_PLANO_ANUAL: process.env.STRIPE_PRICE_ID_PLANO_ANUAL || '',
  FIREBASE_ADMIN_UIDS: process.env.FIREBASE_ADMIN_UIDS || '',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
};
