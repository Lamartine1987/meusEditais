// src/lib/config.ts

interface AppConfig {
  // Segredos do Stripe
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
  
  // Chave publicável do Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

// Esta função ajuda a logar se a variável foi encontrada no servidor
const getServerEnv = (key: string): string => {
  const value = process.env[key];
  // Este log aparecerá no terminal do servidor/build, não no navegador
  console.log(`[config.ts - Lado do Servidor] Lendo variável de ambiente: ${key} -> ${value ? 'ENCONTRADA' : 'AUSENTE!!!'}`);
  return value || '';
};

// Esta configuração é para o LADO DO SERVIDOR.
// As chaves do cliente (como a do Firebase) não são mais lidas aqui.
export const appConfig: AppConfig = {
  STRIPE_SECRET_KEY_PROD: getServerEnv('STRIPE_SECRET_KEY_PROD'),
  STRIPE_WEBHOOK_SECRET_PROD: getServerEnv('STRIPE_WEBHOOK_SECRET_PROD'),
  STRIPE_PRICE_ID_PLANO_CARGO: getServerEnv('STRIPE_PRICE_ID_PLANO_CARGO'),
  STRIPE_PRICE_ID_PLANO_EDITAL: getServerEnv('STRIPE_PRICE_ID_PLANO_EDITAL'),
  STRIPE_PRICE_ID_PLANO_ANUAL: getServerEnv('STRIPE_PRICE_ID_PLANO_ANUAL'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: getServerEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
};
