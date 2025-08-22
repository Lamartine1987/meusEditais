// src/lib/config.ts

interface AppConfig {
  // Segredos do Stripe (apenas para o lado do servidor)
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
  
  // Chave publicável do Stripe (para o lado do cliente)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

// Para o código do lado do servidor, as variáveis são lidas do ambiente (injetadas pelo apphosting.yaml)
const getServerEnv = (key: string): string => {
  const value = process.env[key];
  // Log para depuração no servidor
  if (typeof window === 'undefined') {
    console.log(`[config.ts - Server-Side] Reading env var: ${key} -> ${value ? 'FOUND' : 'MISSING!'}`);
  }
  return value || '';
};

// Esta configuração é para o LADO DO SERVIDOR E CLIENTE.
export const appConfig: AppConfig = {
  // Chaves do SERVIDOR
  STRIPE_SECRET_KEY_PROD: getServerEnv('STRIPE_SECRET_KEY_PROD'),
  STRIPE_WEBHOOK_SECRET_PROD: getServerEnv('STRIPE_WEBHOOK_SECRET_PROD'),
  STRIPE_PRICE_ID_PLANO_CARGO: getServerEnv('STRIPE_PRICE_ID_PLANO_CARGO'),
  STRIPE_PRICE_ID_PLANO_EDITAL: getServerEnv('STRIPE_PRICE_ID_PLANO_EDITAL'),
  STRIPE_PRICE_ID_PLANO_ANUAL: getServerEnv('STRIPE_PRICE_ID_PLANO_ANUAL'),

  // Chave do CLIENTE (pública, segura para ser embutida)
  // Substitua 'pk_live_...' pela sua chave publicável real do Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_51RZvaGHTmnc0kY1c6Fw3xIe6l5kK3WfS8Wq8Vz0iW8iY9X9yL6g5Y7h3xG4nJ2kP1bA0oB9cE8dF7gH00iJ6kL5oI",
};
