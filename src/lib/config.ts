// src/lib/config.ts

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
    // This log is expected during local development if .env.local is not set up
    console.log("[config.ts] STRIPE_SECRETS env var not found. Using fallback values.");
    return defaultSecrets;
  } catch (error) {
    console.error("[config.ts] Failed to parse STRIPE_SECRETS JSON. Check if the secret is correctly formatted.", error);
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
  
  // Chave de API do Google/Firebase
  NEXT_PUBLIC_FIREBASE_API_KEY: string;

  // Outras chaves
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

export const appConfig: AppConfig = {
  // Atribui os valores analisados do JSON
  STRIPE_SECRET_KEY_PROD: stripeSecrets.SECRET_KEY_PROD,
  STRIPE_WEBHOOK_SECRET_PROD: stripeSecrets.WEBHOOK_SECRET_PROD,
  STRIPE_PRICE_ID_PLANO_CARGO: stripeSecrets.PRICE_ID_PLANO_CARGO,
  STRIPE_PRICE_ID_PLANO_EDITAL: stripeSecrets.PRICE_ID_PLANO_EDITAL,
  STRIPE_PRICE_ID_PLANO_ANUAL: stripeSecrets.PRICE_ID_PLANO_ANUAL,
  
  // Lê as outras variáveis de ambiente diretamente
  NEXT_PUBLIC_FIREBASE_API_KEY: apiKey,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};
