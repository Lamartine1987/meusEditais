
import Stripe from 'stripe';
import { appConfig } from './config';

let stripeClientInstance: Stripe | null = null;
let loadedSecrets = false;

// Esta função carrega os segredos do ambiente de execução do servidor.
// Ela é chamada pela getStripeClient e garante que os segredos sejam lidos apenas uma vez.
function loadStripeSecrets() {
    // Evita recarregar os segredos se já foram carregados nesta instância.
    if (loadedSecrets) {
        console.log('[Stripe Secrets] Segredos já carregados anteriormente. Usando valores em cache.');
        return;
    }

    // Garante que este código execute apenas no lado do servidor.
    if (typeof window === 'undefined') {
        console.log('[Stripe Secrets] Tentando carregar segredos do Stripe do ambiente de execução.');
        
        const secretsJsonString = process.env.STRIPE_SECRETS_JSON;

        if (secretsJsonString && secretsJsonString.trim() !== '') {
             console.log('[Stripe Secrets] Variável de ambiente STRIPE_SECRETS_JSON encontrada.');
            try {
                const parsedSecrets = JSON.parse(secretsJsonString);
                
                // Atualiza o objeto appConfig com os segredos carregados do runtime.
                appConfig.SECRET_KEY_PROD = parsedSecrets.SECRET_KEY_PROD || '';
                appConfig.WEBHOOK_SECRET_PROD = parsedSecrets.WEBHOOK_SECRET_PROD || '';
                
                // Os Price IDs são públicos, mas podemos carregá-los daqui para garantir consistência.
                appConfig.PRICE_ID_PLANO_CARGO = parsedSecrets.PRICE_ID_PLANO_CARGO || appConfig.PRICE_ID_PLANO_CARGO;
                appConfig.PRICE_ID_PLANO_EDITAL = parsedSecrets.PRICE_ID_PLANO_EDITAL || appConfig.PRICE_ID_PLANO_EDITAL;
                appConfig.PRICE_ID_PLANO_ANUAL = parsedSecrets.PRICE_ID_PLANO_ANUAL || appConfig.PRICE_ID_PLANO_ANUAL;
                
                if (!appConfig.SECRET_KEY_PROD || !appConfig.WEBHOOK_SECRET_PROD) {
                    console.warn('[Stripe Secrets] AVISO: SECRET_KEY_PROD ou WEBHOOK_SECRET_PROD estão ausentes no JSON do segredo.');
                } else {
                    console.log('[Stripe Secrets] SUCESSO: Segredos do Stripe (Secret Key, Webhook Secret, Price IDs) carregados em runtime.');
                }
                loadedSecrets = true;
            } catch (error) {
                console.error('[Stripe Secrets] ERRO CRÍTICO: Falha ao analisar o JSON de STRIPE_SECRETS_JSON.', error);
            }
        } else {
            console.error('[Stripe Secrets] ERRO CRÍTICO: Variável de ambiente STRIPE_SECRETS_JSON não encontrada ou está vazia no ambiente de execução.');
        }
    } else {
        console.log('[Stripe Secrets] Lado do cliente detectado. A carga de segredos foi ignorada.');
    }
}


// Esta função deve ser chamada apenas no lado do servidor (ex: em Server Actions ou rotas de API)
export function getStripeClient(): Stripe {
  // Garante que os segredos sejam carregados antes de tentar usar a chave secreta.
  loadStripeSecrets();

  const secretKey = appConfig.SECRET_KEY_PROD;

  if (!secretKey || secretKey.trim() === '') {
    const errorMessage = `CRÍTICO: A chave secreta do Stripe (SECRET_KEY_PROD) não está disponível. O segredo 'STRIPE_SECRETS_JSON' pode não ter sido carregado ou analisado corretamente.`;
    console.error(errorMessage);
    throw new Error('A chave secreta do Stripe não está configurada no servidor. Verifique os logs.');
  }

  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    console.log("[StripeClient] Instância do cliente Stripe (MODO PRODUÇÃO) criada com sucesso em runtime.");
  }
  return stripeClientInstance;
}
