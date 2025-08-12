// src/lib/config.ts
import 'dotenv/config';

interface StripeSecrets {
  SECRET_KEY_PROD: string;
  WEBHOOK_SECRET_PROD: string;
  PRICE_ID_PLANO_CARGO: string;
  PRICE_ID_PLANO_EDITAL: string;
  PRICE_ID_PLANO_ANUAL: string;
}

// Analisa os segredos do Stripe a partir de uma string JSON
function parseStripeSecrets(): StripeSecrets {
  const defaultSecrets: StripeSecrets = {
    SECRET_KEY_PROD: '',
    WEBHOOK_SECRET_PROD: '',
    // Use fallback placeholder values to allow build to succeed
    PRICE_ID_PLANO_CARGO: 'price_plano_cargo_fallback_placeholder',
    PRICE_ID_PLANO_EDITAL: 'price_plano_edital_fallback_placeholder',
    PRICE_ID_PLANO_ANUAL: 'price_plano_anual_fallback_placeholder',
  };

  try {
    const secretsJson = process.env.STRIPE_SECRETS;
    if (secretsJson) {
      const parsed = JSON.parse(secretsJson);
      // Mescla os segredos analisados com os padrões para garantir que todas as chaves existam
      return { ...defaultSecrets, ...parsed };
    }
    console.warn("Variável de ambiente STRIPE_SECRETS não encontrada ou está vazia. Usando valores padrão/fallback.");
    return defaultSecrets;
  } catch (error) {
    console.error("Falha ao analisar STRIPE_SECRETS JSON. Verifique se o segredo está formatado corretamente.", error);
    return defaultSecrets;
  }
}

const stripeSecrets = parseStripeSecrets();

interface AppConfig {
  // Segredos do Stripe (agora analisados do JSON)
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
  
  // Outras chaves
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_GOOGLE_API_KEY: string;
}

export const appConfig: AppConfig = {
  // Atribui os valores analisados do JSON
  STRIPE_SECRET_KEY_PROD: stripeSecrets.SECRET_KEY_PROD,
  STRIPE_WEBHOOK_SECRET_PROD: stripeSecrets.WEBHOOK_SECRET_PROD,
  STRIPE_PRICE_ID_PLANO_CARGO: stripeSecrets.PRICE_ID_PLANO_CARGO,
  STRIPE_PRICE_ID_PLANO_EDITAL: stripeSecrets.PRICE_ID_PLANO_EDITAL,
  STRIPE_PRICE_ID_PLANO_ANUAL: stripeSecrets.PRICE_ID_PLANO_ANUAL,
  
  // Lê as outras variáveis de ambiente diretamente
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
  NEXT_PUBLIC_GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
};
