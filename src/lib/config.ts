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
  NEXT_PUBLIC_GOOGLE_API_KEY: string;
}

let config: AppConfig;

try {
  // Lê cada variável diretamente do ambiente de execução.
  // Em produção, esses valores são injetados pelo apphosting.yaml.
  // Em desenvolvimento, são lidos do arquivo .env (se houver).
  config = {
    STRIPE_SECRET_KEY_PROD: process.env.STRIPE_SECRET_KEY_PROD || '',
    STRIPE_WEBHOOK_SECRET_PROD: process.env.STRIPE_WEBHOOK_SECRET_PROD || '',
    STRIPE_PRICE_ID_PLANO_CARGO: process.env.STRIPE_PRICE_ID_PLANO_CARGO || '',
    STRIPE_PRICE_ID_PLANO_EDITAL: process.env.STRIPE_PRICE_ID_PLANO_EDITAL || '',
    STRIPE_PRICE_ID_PLANO_ANUAL: process.env.STRIPE_PRICE_ID_PLANO_ANUAL || '',
    FIREBASE_ADMIN_UIDS: process.env.FIREBASE_ADMIN_UIDS || '',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
    NEXT_PUBLIC_GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  };

  // Validação para garantir que as chaves mais críticas não estão vazias em produção.
  if (process.env.NODE_ENV === 'production') {
    const requiredKeys: (keyof AppConfig)[] = [
      'STRIPE_SECRET_KEY_PROD',
      'STRIPE_WEBHOOK_SECRET_PROD',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_GOOGLE_API_KEY',
    ];

    for (const key of requiredKeys) {
      if (!config[key] || config[key].startsWith('__')) {
         console.warn(`[AppConfig] AVISO: A variável de configuração '${key}' está ausente ou não foi substituída em produção.`);
      }
    }
  }
} catch (error) {
  console.error("ERRO CRÍTICO AO CARREGAR A CONFIGURAÇÃO DA APLICAÇÃO:", error);
  // Fallback seguro em caso de erro catastrófico
  config = {
    STRIPE_SECRET_KEY_PROD: '',
    STRIPE_WEBHOOK_SECRET_PROD: '',
    STRIPE_PRICE_ID_PLANO_CARGO: '',
    STRIPE_PRICE_ID_PLANO_EDITAL: '',
    STRIPE_PRICE_ID_PLANO_ANUAL: '',
    FIREBASE_ADMIN_UIDS: '',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_APP_URL: '',
    NEXT_PUBLIC_GOOGLE_API_KEY: '',
  };
}

export const appConfig = config;
