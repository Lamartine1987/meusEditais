// src/lib/config.ts
import 'dotenv/config';

interface AppConfig {
  // Chaves de API e Segredos (do Secret)
  GOOGLE_API_KEY: string;
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
  // Carrega segredos do JSON em produção (runtime)
  // Ou carrega do .env em desenvolvimento
  const secretConfig = process.env.APP_CONFIG_JSON
    ? JSON.parse(process.env.APP_CONFIG_JSON)
    : {
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        STRIPE_SECRET_KEY_PROD: process.env.STRIPE_SECRET_KEY_PROD,
        STRIPE_WEBHOOK_SECRET_PROD: process.env.STRIPE_WEBHOOK_SECRET_PROD,
        STRIPE_PRICE_ID_PLANO_CARGO: process.env.STRIPE_PRICE_ID_PLANO_CARGO,
        STRIPE_PRICE_ID_PLANO_EDITAL: process.env.STRIPE_PRICE_ID_PLANO_EDITAL,
        STRIPE_PRICE_ID_PLANO_ANUAL: process.env.STRIPE_PRICE_ID_PLANO_ANUAL,
        FIREBASE_ADMIN_UIDS: process.env.FIREBASE_ADMIN_UIDS,
      };

  // Carrega variáveis públicas diretamente do process.env
  // Elas são definidas no apphosting.yaml ou .env e estão disponíveis no build e runtime
  config = {
    ...secretConfig,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  };

  // Validação para garantir que todas as chaves foram carregadas
  const requiredKeys: (keyof AppConfig)[] = [
    'GOOGLE_API_KEY', 'STRIPE_SECRET_KEY_PROD', 'STRIPE_WEBHOOK_SECRET_PROD',
    'STRIPE_PRICE_ID_PLANO_CARGO', 'STRIPE_PRICE_ID_PLANO_EDITAL', 'STRIPE_PRICE_ID_PLANO_ANUAL',
    'FIREBASE_ADMIN_UIDS', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_APP_URL'
  ];

  for (const key of requiredKeys) {
    if (!config[key]) {
      // Este erro agora só deve ocorrer se uma variável estiver realmente faltando
      throw new Error(`[AppConfig] Variável de configuração ausente: ${key}. Verifique seu segredo APP_CONFIG, .env, ou a seção 'env' do apphosting.yaml.`);
    }
  }

} catch (error) {
  console.error("ERRO CRÍTICO AO CARREGAR A CONFIGURAÇÃO DA APLICAÇÃO:", error);
  // Em caso de falha, definimos um objeto com placeholders para evitar que a aplicação quebre
  // mas os erros serão evidentes nos logs e no comportamento da aplicação.
  config = {
    GOOGLE_API_KEY: '',
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
