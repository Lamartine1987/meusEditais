
import Stripe from 'stripe';
import { appConfig } from './config';

let stripeClientInstance: Stripe | null = null;
let secretsLoaded = false;

// Esta função robusta carrega os segredos do ambiente de execução do servidor.
// É chamada pela getStripeClient e garante que os segredos sejam lidos e analisados apenas uma vez.
function loadStripeSecrets() {
    if (secretsLoaded) {
        console.log('[stripe.ts] Segredos já carregados. Usando instância em cache.');
        return;
    }

    // Garante que este código só execute no lado do servidor.
    if (typeof window !== 'undefined') {
        console.error('[stripe.ts] ERRO CRÍTICO: Tentativa de carregar segredos do Stripe no lado do cliente.');
        return;
    }
    
    console.log('[stripe.ts] Lado do servidor detectado. Tentando carregar segredos do Stripe do ambiente de execução.');
    const secretsJsonString = process.env.STRIPE_SECRETS_JSON;

    if (!secretsJsonString || secretsJsonString.trim() === '') {
        console.error('[stripe.ts] ERRO CRÍTICO: Variável de ambiente STRIPE_SECRETS_JSON não encontrada ou está vazia. Verifique a configuração do `apphosting.yaml` e a vinculação do segredo no App Hosting.');
        return; // Retorna para evitar mais erros.
    }
    
    console.log('[stripe.ts] Variável STRIPE_SECRETS_JSON encontrada. Tentando analisar...');
    try {
        const parsedSecrets = JSON.parse(secretsJsonString);
        
        // Atualiza o objeto appConfig com os segredos carregados.
        appConfig.SECRET_KEY_PROD = parsedSecrets.SECRET_KEY_PROD || '';
        appConfig.WEBHOOK_SECRET_PROD = parsedSecrets.WEBHOOK_SECRET_PROD || '';
        
        // Os Price IDs são públicos, mas carregamos daqui para garantir consistência.
        appConfig.PRICE_ID_PLANO_CARGO = parsedSecrets.PRICE_ID_PLANO_CARGO || appConfig.PRICE_ID_PLANO_CARGO;
        appConfig.PRICE_ID_PLANO_EDITAL = parsedSecrets.PRICE_ID_PLANO_EDITAL || appConfig.PRICE_ID_PLANO_EDITAL;
        appConfig.PRICE_ID_PLANO_ANUAL = parsedSecrets.PRICE_ID_PLANO_ANUAL || appConfig.PRICE_ID_PLANO_ANUAL;

        if (!appConfig.SECRET_KEY_PROD) {
            console.warn('[stripe.ts] AVISO: SECRET_KEY_PROD está ausente no JSON do segredo.');
        } else {
            console.log(`[stripe.ts] SUCESSO: Chave secreta do Stripe carregada. Comprimento: ${appConfig.SECRET_KEY_PROD.length}`);
        }
        
        secretsLoaded = true;
    } catch (error) {
        console.error('[stripe.ts] ERRO CRÍTICO: Falha ao analisar o JSON de STRIPE_SECRETS_JSON.', error);
    }
}

// Esta função deve ser chamada apenas no lado do servidor (ex: em Server Actions ou rotas de API)
export function getStripeClient(): Stripe {
  // Garante que os segredos sejam carregados antes de tentar usar a chave secreta.
  loadStripeSecrets();

  const secretKey = appConfig.SECRET_KEY_PROD;

  if (!secretKey || secretKey.trim() === '') {
    const errorMessage = "[stripe.ts] ERRO CRÍTICO: A chave secreta do Stripe (SECRET_KEY_PROD) não está disponível. O segredo 'STRIPE_SECRETS_JSON' pode não ter sido carregado ou analisado corretamente.";
    console.error(errorMessage);
    throw new Error('A chave secreta do Stripe não está configurada no servidor. Verifique os logs do servidor.');
  }

  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    console.log("[stripe.ts] Instância do cliente Stripe (MODO PRODUÇÃO) criada com sucesso em runtime.");
  } else {
    console.log("[stripe.ts] Usando instância existente do cliente Stripe.");
  }
  
  return stripeClientInstance;
}
