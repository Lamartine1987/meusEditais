// src/lib/config.ts

// NOTA: A lógica de leitura de 'STRIPE_SECRETS_JSON' foi movida para 'stripe.ts'
// para garantir que seja executada apenas no ambiente de execução do servidor (runtime),
// e não durante o processo de build, o que estava causando a falha no build.

interface StripeSecrets {
  SECRET_KEY_PROD: string;
  WEBHOOK_SECRET_PROD: string;
  PRICE_ID_PLANO_CARGO: string;
  PRICE_ID_PLANO_EDITAL: string;
  PRICE_ID_PLANO_ANUAL: string;
}

interface AppConfig extends StripeSecrets {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

// Valores de fallback/padrão. Os segredos do Stripe serão carregados sob demanda no runtime.
export const appConfig: AppConfig = {
  SECRET_KEY_PROD: '',
  WEBHOOK_SECRET_PROD: '',
  PRICE_ID_PLANO_CARGO: '',
  PRICE_ID_PLANO_EDITAL: '',
  PRICE_ID_PLANO_ANUAL: '',
  // A chave pública do Stripe é segura para ser exposta e é definida aqui.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_51RZvaGHTmnc0kY1c6Fw3xIe6l5kK3WfS8Wq8Vz0iW8iY9X9yL6g5Y7h3xG4nJ2kP1bA0oB9cE8dF7gH00iJ6kL5oI",
};
