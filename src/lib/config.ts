
// src/lib/config.ts
import 'dotenv/config';

interface AppConfig {
  // Chaves de API e Segredos (do Secret)
  STRIPE_SECRET_KEY_PROD: string;
  STRIPE_WEBHOOK_SECRET_PROD: string;
  STRIPE_PRICE_ID_PLANO_CARGO: string;
  STRIPE_PRICE_ID_PLANO_EDITAL: string;
  STRIPE_PRICE_ID_PLANO_ANUAL: string;
  FIREBASE_ADMIN_UIDS: string;

  // Chaves Públicas e URLs (do env direto)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
}

let config: AppConfig;

try {
  // Durante o build do Next.js, os segredos não estão disponíveis.
  // Usamos placeholders para permitir que o build seja concluído com sucesso.
  // Em produção (runtime), o APP_CONFIG_JSON será injetado.
  const isBuildPhase = process.env.npm_lifecycle_script === 'next build';

  let secretConfig;

  if (isBuildPhase) {
    console.log('[AppConfig] Fase de Build detectada. Usando placeholders para segredos.');
    secretConfig = {
      STRIPE_SECRET_KEY_PROD: 'placeholder_stripe_secret_key',
      STRIPE_WEBHOOK_SECRET_PROD: 'placeholder_stripe_webhook_secret',
      STRIPE_PRICE_ID_PLANO_CARGO: 'price_plano_cargo_fallback_placeholder',
      STRIPE_PRICE_ID_PLANO_EDITAL: 'price_plano_edital_fallback_placeholder',
      STRIPE_PRICE_ID_PLANO_ANUAL: 'price_plano_anual_fallback_placeholder',
      FIREBASE_ADMIN_UIDS: '',
    };
  } else if (process.env.APP_CONFIG_JSON) {
    // Em produção (runtime), carrega segredos do JSON
    console.log('[AppConfig] Ambiente de Produção (runtime) detectado. Lendo APP_CONFIG_JSON.');
    secretConfig = JSON.parse(process.env.APP_CONFIG_JSON);
  } else {
    // Em desenvolvimento local, carrega do .env
    console.log('[AppConfig] Ambiente de Desenvolvimento detectado. Lendo do .env.');
    secretConfig = {
      STRIPE_SECRET_KEY_PROD: process.env.STRIPE_SECRET_KEY_PROD,
      STRIPE_WEBHOOK_SECRET_PROD: process.env.STRIPE_WEBHOOK_SECRET_PROD,
      STRIPE_PRICE_ID_PLANO_CARGO: process.env.STRIPE_PRICE_ID_PLANO_CARGO,
      STRIPE_PRICE_ID_PLANO_EDITAL: process.env.STRIPE_PRICE_ID_PLANO_EDITAL,
      STRIPE_PRICE_ID_PLANO_ANUAL: process.env.STRIPE_PRICE_ID_PLANO_ANUAL,
      FIREBASE_ADMIN_UIDS: process.env.FIREBASE_ADMIN_UIDS,
    };
  }
  
  // Carrega variáveis públicas diretamente do process.env
  config = {
    ...secretConfig,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  };

  // Validação para garantir que as chaves públicas foram carregadas
  const requiredPublicKeys: (keyof AppConfig)[] = [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_APP_URL'
  ];

  for (const key of requiredPublicKeys) {
    if (!config[key]) {
      throw new Error(`[AppConfig] Variável de configuração PÚBLICA ausente: ${key}. Verifique seu .env ou a seção 'env' do apphosting.yaml.`);
    }
  }

} catch (error) {
  console.error("ERRO CRÍTICO AO CARREGAR A CONFIGURAÇÃO DA APLICAÇÃO:", error);
  // Fallback em caso de erro
  config = {
    STRIPE_SECRET_KEY_PROD: '',
    STRIPE_WEBHOOK_SECRET_PROD: '',
    STRIPE_PRICE_ID_PLANO_CARGO: '',
    STRIPE_PRICE_ID_PLANO_EDITAL: '',
    STRIPE_PRICE_ID_PLANO_ANUAL: '',
    FIREBASE_ADMIN_UIDS: '',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_APP_URL: '',
  };
}

export const appConfig = config;
