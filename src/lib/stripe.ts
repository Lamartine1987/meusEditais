
import Stripe from 'stripe';
import { getSecret, getEnvOrSecret } from './secrets';

let client: Stripe | null = null;

export async function getStripeClient(): Promise<Stripe> {
  if (client) {
    console.log('[getStripeClient] Retornando instância do cliente Stripe em cache.');
    return client;
  }
  
  console.log('[getStripeClient] Instância do cliente Stripe não encontrada em cache. Criando uma nova...');
  try {
    const key = await getEnvOrSecret('STRIPE_SECRET_KEY_PROD');
    if (!key) {
      console.error('[getStripeClient] ERRO CRÍTICO: A chave secreta do Stripe (STRIPE_SECRET_KEY_PROD) não foi encontrada nos segredos.');
      throw new Error('A chave secreta do Stripe (STRIPE_SECRET_KEY_PROD) não foi encontrada.');
    }
    
    console.log('[getStripeClient] Chave secreta do Stripe carregada. Inicializando cliente Stripe...');
    client = new Stripe(key, { apiVersion: '2024-06-20', typescript: true });
    console.log('[getStripeClient] Cliente Stripe inicializado com sucesso.');
    return client;
  } catch (error) {
    console.error('[getStripeClient] ERRO CRÍTICO ao inicializar o cliente Stripe:', error);
    // Re-lança o erro para que a chamada falhe explicitamente.
    throw new Error('Falha ao inicializar o cliente Stripe. Verifique os logs do servidor.');
  }
}
