
import Stripe from 'stripe';
import { appConfig } from './config';

let stripeClientInstance: Stripe | null = null;

// Esta função deve ser chamada apenas no lado do servidor (ex: em Server Actions ou rotas de API)
export function getStripeClient(): Stripe {
  // Lê a chave secreta diretamente do objeto de configuração, que já processou os segredos do ambiente.
  const secretKey = appConfig.SECRET_KEY_PROD;

  console.log(`[StripeClient] Tentando inicializar. O valor de appConfig.SECRET_KEY_PROD é: '${secretKey ? "****** (presente)" : "VAZIO OU NULO"}'`);

  if (!secretKey || secretKey.trim() === '') {
    const errorMessage = `CRÍTICO: A chave secreta do Stripe (SECRET_KEY_PROD) não foi carregada da configuração. Isso geralmente significa que o segredo 'STRIPE_SECRETS' não foi lido ou analisado corretamente. Verifique os logs de 'config.ts' e a configuração do apphosting.yaml.`;
    console.error(errorMessage);
    throw new Error('A chave secreta do Stripe não está configurada no servidor. Verifique os logs.');
  }

  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    console.log("[StripeClient] Instância do cliente Stripe (MODO PRODUÇÃO) criada com sucesso.");
  }
  return stripeClientInstance;
}
