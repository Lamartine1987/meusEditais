import Stripe from 'stripe';
import { getEnvOrSecret } from './secrets';

let stripeClientInstance: Stripe | null = null;

export async function getStripeClient(): Promise<Stripe> {
  if (typeof window !== 'undefined') {
    const errorMessage = '[stripe.ts] ERRO CRÍTICO: Tentativa de criar cliente Stripe no lado do cliente.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!stripeClientInstance) {
    console.log("[stripe.ts] Criando nova instância do cliente Stripe...");
    const secretKey = await getEnvOrSecret('STRIPE_SECRET_KEY_PROD');
    
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    console.log("[stripe.ts] Instância do cliente Stripe criada com sucesso.");
  } else {
    console.log("[stripe.ts] Usando instância existente do cliente Stripe.");
  }
  
  return stripeClientInstance;
}
