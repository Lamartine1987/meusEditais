// src/lib/config.ts

// NOTA: A lógica de leitura de 'STRIPE_SECRETS_JSON' foi movida para 'stripe.ts'
// para garantir que seja executada apenas no ambiente de execução do servidor (runtime).
// Os Price IDs são públicos e podem ser definidos aqui para uso no cliente.

interface AppConfig {
  SECRET_KEY_PROD: string;
  WEBHOOK_SECRET_PROD: string;
  PRICE_ID_PLANO_CARGO: string;
  PRICE_ID_PLANO_EDITAL: string;
  PRICE_ID_PLANO_ANUAL: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

// Os segredos (SECRET_KEY_PROD, WEBHOOK_SECRET_PROD) serão carregados sob demanda no runtime do servidor.
// As chaves públicas (Publishable Key) e os Price IDs são seguros para serem expostos e são definidos aqui.
export const appConfig: AppConfig = {
  SECRET_KEY_PROD: '',
  WEBHOOK_SECRET_PROD: '',
  PRICE_ID_PLANO_CARGO: "price_1RgswbHTmnc0kY1cgSdqMwBA",
  PRICE_ID_PLANO_EDITAL: "price_1RgsvOHTmnc0kY1cQ3L6jE8r",
  PRICE_ID_PLANO_ANUAL: "price_1RgsXgHTmnc0kY1caVqYpdPv",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_51RZvaGHTmnc0kY1c6Fw3xIe6l5kK3WfS8Wq8Vz0iW8iY9X9yL6g5Y7h3xG4nJ2kP1bA0oB9cE8dF7gH00iJ6kL5oI",
};
