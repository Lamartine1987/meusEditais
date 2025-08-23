
// src/lib/config.ts

// NOTA: Os segredos (chaves secretas, webhook) são agora carregados exclusivamente
// em runtime no servidor através de `src/lib/stripe.ts`.

interface AppConfig {
  // Segredos que serão populados em runtime no servidor
  SECRET_KEY_PROD: string;
  WEBHOOK_SECRET_PROD: string;
  
  // Price IDs são públicos e podem ser definidos aqui para uso no cliente.
  // Eles também são recarregados do segredo no servidor para garantir consistência.
  PRICE_ID_PLANO_CARGO: string;
  PRICE_ID_PLANO_EDITAL: string;
  PRICE_ID_PLANO_ANUAL: string;
  
  // Chave publicável do Stripe, segura para ser exposta no cliente.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

// Valores padrão/públicos. Os segredos serão vazios até serem carregados em runtime.
export const appConfig: AppConfig = {
  SECRET_KEY_PROD: '', 
  WEBHOOK_SECRET_PROD: '',
  PRICE_ID_PLANO_CARGO: "price_1RgswbHTmnc0kY1cgSdqMwBA",
  PRICE_ID_PLANO_EDITAL: "price_1RgsvOHTmnc0kY1cQ3L6jE8r",
  PRICE_ID_PLANO_ANUAL: "price_1RgsXgHTmnc0kY1caVqYpdPv",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_51RZvaGHTmnc0kY1c6Fw3xIe6l5kK3WfS8Wq8Vz0iW8iY9X9yL6g5Y7h3xG4nJ2kP1bA0oB9cE8dF7gH00iJ6kL5oI",
};
