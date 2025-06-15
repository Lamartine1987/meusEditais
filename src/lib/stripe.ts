
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

// This function should only be called server-side (e.g., in Server Actions or API routes)
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    // Use the secret name from Google Secret Manager
    if (!process.env.STRIPE_SECRET_KEY_PROD) {
      console.error('CRITICAL: STRIPE_SECRET_KEY_PROD is not set in environment variables.');
      throw new Error('STRIPE_SECRET_KEY_PROD is not set in environment variables. This is a server-side configuration issue.');
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY_PROD, {
      apiVersion: '2024-06-20', 
      typescript: true,
    });
  }
  return stripeClient;
}

