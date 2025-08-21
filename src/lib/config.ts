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

let parsedStripeSecrets: any = {};
if (process.env.CONSOLIDATED_SECRETS) {
  try {
    parsedStripeSecrets = JSON.parse(process.env.CONSOLIDATED_SECRETS);
    console.log('[config.ts] Stripe secrets parsed successfully from CONSOLIDATED_SECRETS.');
  } catch (e) {
    console.error('[config.ts] CRITICAL: Failed to parse CONSOLIDATED_SECRETS JSON.', e);
  }
} else {
  console.warn('[config.ts] WARNING: CONSOLIDATED_SECRETS env var for Stripe not found. Using fallback values. This is expected during build but is an error in production runtime.');
}

export const appConfig: AppConfig = {
  // Lê as variáveis do segredo Stripe consolidado
  STRIPE_SECRET_KEY_PROD: parsedStripeSecrets.SECRET_KEY_PROD || '',
  STRIPE_WEBHOOK_SECRET_PROD: parsedStripeSecrets.WEBHOOK_SECRET_PROD || '',
  STRIPE_PRICE_ID_PLANO_CARGO: parsedStripeSecrets.PRICE_ID_PLANO_CARGO || '',
  STRIPE_PRICE_ID_PLANO_EDITAL: parsedStripeSecrets.PRICE_ID_PLANO_EDITAL || '',
  STRIPE_PRICE_ID_PLANO_ANUAL: parsedStripeSecrets.PRICE_ID_PLANO_ANUAL || '',
  
  // Lê a variável de ambiente pública do Firebase (passada durante o build)
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  
  // Lê a variável de ambiente pública do Stripe (passada no runtime)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};

console.log(`[config.ts] Final Firebase API Key loaded: ${appConfig.NEXT_PUBLIC_FIREBASE_API_KEY ? 'FOUND' : 'NOT FOUND'}`);
