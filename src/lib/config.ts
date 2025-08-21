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

// Esta função ajuda a logar se a variável foi encontrada no servidor
const getServerEnv = (key: string): string => {
  const value = process.env[key];
  console.log(`[config.ts] Lendo variável de ambiente do servidor: ${key} - ${value ? 'ENCONTRADA' : 'AUSENTE'}`);
  return value || '';
};

export const appConfig: AppConfig = {
  // Lê as variáveis do Stripe diretamente do ambiente
  STRIPE_SECRET_KEY_PROD: getServerEnv('STRIPE_SECRET_KEY_PROD'),
  STRIPE_WEBHOOK_SECRET_PROD: getServerEnv('STRIPE_WEBHOOK_SECRET_PROD'),
  STRIPE_PRICE_ID_PLANO_CARGO: getServerEnv('STRIPE_PRICE_ID_PLANO_CARGO'),
  STRIPE_PRICE_ID_PLANO_EDITAL: getServerEnv('STRIPE_PRICE_ID_PLANO_EDITAL'),
  STRIPE_PRICE_ID_PLANO_ANUAL: getServerEnv('STRIPE_PRICE_ID_PLANO_ANUAL'),
  
  // Lê a variável de ambiente pública do Firebase (passada durante o build)
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  
  // Lê a variável de ambiente pública do Stripe (passada no runtime e build)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};

console.log(`[config.ts] Chave da API do Firebase carregada no config: ${appConfig.NEXT_PUBLIC_FIREBASE_API_KEY ? 'ENCONTRADA' : 'AUSENTE!!!'}`);
console.log(`[config.ts] Chave publicável do Stripe carregada no config: ${appConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'ENCONTRADA' : 'AUSENTE!!!'}`);
