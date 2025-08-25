import Stripe from 'stripe';
import { getEnvOrSecret } from './secrets';

let client: Stripe | null = null;

export async function getStripeClient(): Promise<Stripe> {
  if (client) return client;
  
  const key = await getEnvOrSecret('STRIPE_SECRET_KEY_PROD');
  if (!key) {
    throw new Error('A chave secreta do Stripe (STRIPE_SECRET_KEY_PROD) não foi encontrada.');
  }
  
  client = new Stripe(key, { apiVersion: '2024-06-20', typescript: true });
  return client;
}
