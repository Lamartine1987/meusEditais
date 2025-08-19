// src/lib/config.ts

interface AppSecrets {
  GOOGLE_API_KEY: string;
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
}

// Analisa os segredos a partir de uma única string JSON consolidada
function parseAppSecrets(): AppSecrets {
  const defaultSecrets: AppSecrets = {
    GOOGLE_API_KEY: '',
    STRIPE_SECRET_KEY_PROD: '',
    STRIPE_WEBHOOK_SECRET_PROD: '', // Corrigido de WEBHOOK_SECRET_PROD para STRIPE_WEBHOOK_SECRET_PROD
    // Use fallback placeholder values to allow build to succeed
    STRIPE_PRICE_ID_PLANO_CARGO: 'price_plano_cargo_fallback_placeholder',
    STRIPE_PRICE_ID_PLANO_EDITAL: 'price_plano_edital_fallback_placeholder',
    STRIPE_PRICE_ID_PLANO_ANUAL: 'price_plano_anual_fallback_placeholder',
  };

  try {
    const secretsJson = process.env.CONSOLIDATED_SECRETS;
    if (secretsJson) {
      const parsed = JSON.parse(secretsJson);
      // Mescla os segredos analisados com os padrões para garantir que todas as chaves existam
      const finalSecrets = { ...defaultSecrets, ...parsed };
      
      // Mapeia as chaves do seu JSON para as chaves esperadas pela aplicação
      finalSecrets.STRIPE_SECRET_KEY_PROD = parsed.SECRET_KEY_PROD || defaultSecrets.STRIPE_SECRET_KEY_PROD;
      finalSecrets.STRIPE_WEBHOOK_SECRET_PROD = parsed.WEBHOOK_SECRET_PROD || defaultSecrets.STRIPE_WEBHOOK_SECRET_PROD;
      finalSecrets.STRIPE_PRICE_ID_PLANO_CARGO = parsed.PRICE_ID_PLANO_CARGO || defaultSecrets.STRIPE_PRICE_ID_PLANO_CARGO;
      finalSecrets.STRIPE_PRICE_ID_PLANO_EDITAL = parsed.PRICE_ID_PLANO_EDITAL || defaultSecrets.STRIPE_PRICE_ID_PLANO_EDITAL;
      finalSecrets.STRIPE_PRICE_ID_PLANO_ANUAL = parsed.PRICE_ID_PLANO_ANUAL || defaultSecrets.STRIPE_PRICE_ID_PLANO_ANUAL;

      return finalSecrets;
    }
    // Este log é esperado durante o desenvolvimento local se .env.local não estiver configurado
    console.log("[config.ts] CONSOLIDATED_SECRETS env var not found. Using fallback values.");
    return defaultSecrets;
  } catch (error) {
    console.error("[config.ts] Failed to parse CONSOLIDATED_SECRETS JSON. Check if the secret is correctly formatted.", error);
    return defaultSecrets;
  }
}

const appSecrets = parseAppSecrets();

interface AppConfig {
  // Segredos do Stripe (agora analisados do JSON consolidado)
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

// A chave de API do Firebase agora vem do segredo consolidado
const apiKey = appSecrets.GOOGLE_API_KEY;

if (typeof window !== 'undefined') {
  console.log('[config.ts] Firebase API Key loaded from consolidated secret:', apiKey ? `Starts with ${apiKey.substring(0, 4)}...` : 'Not found');
}

export const appConfig: AppConfig = {
  // Atribui os valores analisados do JSON consolidado
  STRIPE_SECRET_KEY_PROD: appSecrets.STRIPE_SECRET_KEY_PROD,
  STRIPE_WEBHOOK_SECRET_PROD: appSecrets.STRIPE_WEBHOOK_SECRET_PROD,
  STRIPE_PRICE_ID_PLANO_CARGO: appSecrets.STRIPE_PRICE_ID_PLANO_CARGO,
  STRIPE_PRICE_ID_PLANO_EDITAL: appSecrets.STRIPE_PRICE_ID_PLANO_EDITAL,
  STRIPE_PRICE_ID_PLANO_ANUAL: appSecrets.STRIPE_PRICE_ID_PLANO_ANUAL,
  
  NEXT_PUBLIC_FIREBASE_API_KEY: apiKey,
  
  // Lê as outras variáveis de ambiente diretamente
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};
