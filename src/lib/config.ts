// src/lib/config.ts

interface AppSecrets {
  SECRET_KEY_PROD: string;
  WEBHOOK_SECRET_PROD: string;
  PRICE_ID_PLANO_CARGO: string;
  PRICE_ID_PLANO_EDITAL: string;
  PRICE_ID_PLANO_ANUAL: string;
}

// Analisa os segredos do Stripe a partir de uma única string JSON consolidada
function parseStripeSecrets(): AppSecrets {
  const defaultSecrets: AppSecrets = {
    SECRET_KEY_PROD: '',
    WEBHOOK_SECRET_PROD: '',
    PRICE_ID_PLANO_CARGO: 'price_plano_cargo_fallback_placeholder',
    PRICE_ID_PLANO_EDITAL: 'price_plano_edital_fallback_placeholder',
    PRICE_ID_PLANO_ANUAL: 'price_plano_anual_fallback_placeholder',
  };

  try {
    const secretsJson = process.env.CONSOLIDATED_SECRETS;
    if (secretsJson) {
      const parsed = JSON.parse(secretsJson);
      // Mescla os padrões com o que foi encontrado, garantindo que todas as chaves existam
      const finalSecrets = { ...defaultSecrets, ...parsed };
      console.log("[config.ts] Successfully parsed CONSOLIDATED_SECRETS from env var.");
      return finalSecrets;
    }
    console.warn("[config.ts] WARNING: CONSOLIDATED_SECRETS env var for Stripe not found. Using fallback values. This is expected during build but is an error in production runtime.");
    return defaultSecrets;
  } catch (error) {
    console.error("[config.ts] CRITICAL: Failed to parse CONSOLIDATED_SECRETS JSON for Stripe.", error);
    return defaultSecrets;
  }
}

const stripeSecrets = parseStripeSecrets();

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

export const appConfig: AppConfig = {
  // Atribui os valores do Stripe usando as chaves exatas do seu JSON
  STRIPE_SECRET_KEY_PROD: stripeSecrets.SECRET_KEY_PROD,
  STRIPE_WEBHOOK_SECRET_PROD: stripeSecrets.WEBHOOK_SECRET_PROD,
  STRIPE_PRICE_ID_PLANO_CARGO: stripeSecrets.PRICE_ID_PLANO_CARGO,
  STRIPE_PRICE_ID_PLANO_EDITAL: stripeSecrets.PRICE_ID_PLANO_EDITAL,
  STRIPE_PRICE_ID_PLANO_ANUAL: stripeSecrets.PRICE_ID_PLANO_ANUAL,
  
  // Lê a variável de ambiente pública do Firebase
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  
  // Lê a variável de ambiente pública do Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};
