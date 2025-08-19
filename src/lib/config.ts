// src/lib/config.ts

interface AppSecrets {
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
}

// Analisa os segredos do Stripe a partir de uma única string JSON consolidada
function parseStripeSecrets(): AppSecrets {
  const defaultSecrets: AppSecrets = {
    STRIPE_SECRET_KEY_PROD: '',
    STRIPE_WEBHOOK_SECRET_PROD: '',
    // Use fallback placeholder values to allow build to succeed
    STRIPE_PRICE_ID_PLANO_CARGO: 'price_plano_cargo_fallback_placeholder',
    STRIPE_PRICE_ID_PLANO_EDITAL: 'price_plano_edital_fallback_placeholder',
    STRIPE_PRICE_ID_PLANO_ANUAL: 'price_plano_anual_fallback_placeholder',
  };

  try {
    const secretsJson = process.env.CONSOLIDATED_SECRETS;
    if (secretsJson) {
      const parsed = JSON.parse(secretsJson);
      const finalSecrets = { ...defaultSecrets, ...parsed };
      
      // Mapeia as chaves do seu JSON para as chaves esperadas pela aplicação
      finalSecrets.STRIPE_SECRET_KEY_PROD = parsed.SECRET_KEY_PROD || defaultSecrets.STRIPE_SECRET_KEY_PROD;
      finalSecrets.STRIPE_WEBHOOK_SECRET_PROD = parsed.WEBHOOK_SECRET_PROD || defaultSecrets.STRIPE_WEBHOOK_SECRET_PROD;
      finalSecrets.STRIPE_PRICE_ID_PLANO_CARGO = parsed.PRICE_ID_PLANO_CARGO || defaultSecrets.STRIPE_PRICE_ID_PLANO_CARGO;
      finalSecrets.STRIPE_PRICE_ID_PLANO_EDITAL = parsed.PRICE_ID_PLANO_EDITAL || defaultSecrets.STRIPE_PRICE_ID_PLANO_EDITAL;
      finalSecrets.STRIPE_PRICE_ID_PLANO_ANUAL = parsed.PRICE_ID_PLANO_ANUAL || defaultSecrets.STRIPE_PRICE_ID_PLANO_ANUAL;

      return finalSecrets;
    }
    console.log("[config.ts] CONSOLIDATED_SECRETS env var for Stripe not found. Using fallback values.");
    return defaultSecrets;
  } catch (error) {
    console.error("[config.ts] Failed to parse CONSOLIDATED_SECRETS JSON for Stripe.", error);
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
  
  // Chave de API do Google/Firebase (lida diretamente)
  NEXT_PUBLIC_FIREBASE_API_KEY: string;

  // Chave pública do Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';

if (typeof window !== 'undefined') {
  console.log('[config.ts] Firebase API Key loaded:', apiKey ? `Starts with ${apiKey.substring(0, 4)}...` : 'Not found');
}

export const appConfig: AppConfig = {
  // Atribui os valores do Stripe
  STRIPE_SECRET_KEY_PROD: stripeSecrets.STRIPE_SECRET_KEY_PROD,
  STRIPE_WEBHOOK_SECRET_PROD: stripeSecrets.STRIPE_WEBHOOK_SECRET_PROD,
  STRIPE_PRICE_ID_PLANO_CARGO: stripeSecrets.STRIPE_PRICE_ID_PLANO_CARGO,
  STRIPE_PRICE_ID_PLANO_EDITAL: stripeSecrets.STRIPE_PRICE_ID_PLANO_EDITAL,
  STRIPE_PRICE_ID_PLANO_ANUAL: stripeSecrets.STRIPE_PRICE_ID_PLANO_ANUAL,
  
  // Lê as outras variáveis de ambiente diretamente
  NEXT_PUBLIC_FIREBASE_API_KEY: apiKey,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};
