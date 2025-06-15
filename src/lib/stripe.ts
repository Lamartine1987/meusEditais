
import Stripe from 'stripe';

let stripeClientInstance: Stripe | null = null;

// This function should only be called server-side (e.g., in Server Actions or API routes)
export function getStripeClient(): Stripe {
  if (!stripeClientInstance) {
    if (!process.env.STRIPE_SECRET_KEY_PROD) {
      // This log will appear in your Firebase App Hosting backend runtime logs
      console.error('CRITICAL: STRIPE_SECRET_KEY_PROD is not set in environment variables. This is a server-side configuration issue for the App Hosting backend. Ensure the secret is linked and available at runtime.');
      throw new Error('STRIPE_SECRET_KEY_PROD is not set in environment variables. This is a server-side configuration issue.');
    }
    stripeClientInstance = new Stripe(process.env.STRIPE_SECRET_KEY_PROD, {
      apiVersion: '2024-06-20', 
      typescript: true,
    });
  }
  return stripeClientInstance;
}
