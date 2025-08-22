// src/lib/config.ts

// Define a estrutura esperada para as chaves individuais do Stripe.
interface StripeSecrets {
  SECRET_KEY_PROD: string;
  WEBHOOK_SECRET_PROD: string;
  PRICE_ID_PLANO_CARGO: string;
  PRICE_ID_PLANO_EDITAL: string;
  PRICE_ID_PLANO_ANUAL: string;
}

// Define a estrutura da configuração da aplicação.
interface AppConfig extends StripeSecrets {
  // Chave pública do Stripe (segura para ser exposta no cliente).
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
}

let stripeSecrets: StripeSecrets = {
  // Valores de fallback para evitar erros de 'undefined' durante o build.
  // No ambiente de produção, estes valores serão substituídos pelos segredos reais.
  SECRET_KEY_PROD: '',
  WEBHOOK_SECRET_PROD: '',
  PRICE_ID_PLANO_CARGO: 'price_plano_cargo_fallback_placeholder',
  PRICE_ID_PLANO_EDITAL: 'price_plano_edital_fallback_placeholder',
  PRICE_ID_PLANO_ANUAL: 'price_plano_anual_fallback_placeholder',
};

// --- LÓGICA DO LADO DO SERVIDOR ---
// Esta verificação garante que o código abaixo seja executado apenas no ambiente do servidor (Node.js).
if (typeof window === 'undefined') {
  console.log('[config.ts - Lado do Servidor] Iniciando leitura de segredos do ambiente.');
  
  // Lê a variável de ambiente que contém o JSON dos segredos do Stripe.
  const secretsJsonString = process.env.STRIPE_SECRETS_JSON;

  if (secretsJsonString) {
    console.log('[config.ts - Lado do Servidor] Variável STRIPE_SECRETS_JSON encontrada. Tentando analisar...');
    try {
      // Analisa o string JSON para um objeto JavaScript.
      const parsedSecrets: Partial<StripeSecrets> = JSON.parse(secretsJsonString);
      
      // Valida e atribui cada chave do JSON à nossa configuração, com logs detalhados.
      stripeSecrets = {
        SECRET_KEY_PROD: parsedSecrets.SECRET_KEY_PROD || '',
        WEBHOOK_SECRET_PROD: parsedSecrets.WEBHOOK_SECRET_PROD || '',
        PRICE_ID_PLANO_CARGO: parsedSecrets.PRICE_ID_PLANO_CARGO || '',
        PRICE_ID_PLANO_EDITAL: parsedSecrets.PRICE_ID_PLANO_EDITAL || '',
        PRICE_ID_PLANO_ANUAL: parsedSecrets.PRICE_ID_PLANO_ANUAL || '',
      };
      console.log(`[config.ts] SECRET_KEY_PROD: ${stripeSecrets.SECRET_KEY_PROD ? 'Carregada' : 'AUSENTE no JSON'}`);
      console.log(`[config.ts] WEBHOOK_SECRET_PROD: ${stripeSecrets.WEBHOOK_SECRET_PROD ? 'Carregado' : 'AUSENTE no JSON'}`);
      console.log(`[config.ts] PRICE_ID_PLANO_CARGO: ${stripeSecrets.PRICE_ID_PLANO_CARGO ? 'Carregado' : 'AUSENTE no JSON'}`);
      console.log(`[config.ts] PRICE_ID_PLANO_EDITAL: ${stripeSecrets.PRICE_ID_PLANO_EDITAL ? 'Carregado' : 'AUSENTE no JSON'}`);
      console.log(`[config.ts] PRICE_ID_PLANO_ANUAL: ${stripeSecrets.PRICE_ID_PLANO_ANUAL ? 'Carregado' : 'AUSENTE no JSON'}`);
      
      if (!stripeSecrets.SECRET_KEY_PROD || !stripeSecrets.WEBHOOK_SECRET_PROD) {
         console.warn('[config.ts] AVISO: Pelo menos uma chave secreta do Stripe (SECRET_KEY ou WEBHOOK) está faltando no JSON analisado.');
      } else {
         console.log('[config.ts] SUCESSO: Segredos do Stripe analisados e carregados com sucesso.');
      }
      
    } catch (error) {
      console.error('[config.ts] ERRO CRÍTICO: Falha ao analisar o JSON de STRIPE_SECRETS_JSON. Verifique se o segredo é um JSON válido.', error);
    }
  } else {
    console.error('[config.ts] ERRO CRÍTICO: Variável de ambiente STRIPE_SECRETS_JSON não encontrada. Verifique a configuração do apphosting.yaml.');
  }
}

// A configuração final da aplicação, combinando os segredos do servidor com as chaves públicas do cliente.
export const appConfig: AppConfig = {
  ...stripeSecrets,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_51RZvaGHTmnc0kY1c6Fw3xIe6l5kK3WfS8Wq8Vz0iW8iY9X9yL6g5Y7h3xG4nJ2kP1bA0oB9cE8dF7gH00iJ6kL5oI",
};
