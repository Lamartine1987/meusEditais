
import Stripe from 'stripe';
import { appConfig } from './config';

let stripeClientInstance: Stripe | null = null;

// This function should only be called server-side (e.g., in Server Actions or API routes)
export function getStripeClient(): Stripe {
  const secretKey = appConfig.STRIPE_SECRET_KEY_PROD;

  // Verbose logging for debugging
  console.log(`[StripeClient] Attempting to initialize. STRIPE_SECRET_KEY_PROD value from config: '${secretKey ? "****** (present)" : "EMPTY_STRING_OR_NULL"}'`);

  if (!secretKey || secretKey.trim() === '') {
    const errorMessage = `CRITICAL: STRIPE_SECRET_KEY_PROD is not set or is empty in config. This is a server-side configuration issue for the App Hosting backend. Ensure the secret is linked, has a non-empty value, and the backend has permissions to access it.`;
    console.error(errorMessage);
    throw new Error('STRIPE_SECRET_KEY_PROD is not set or is empty. This is a server-side configuration issue. Check server logs.');
  }

  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    console.log("[StripeClient] Stripe client instance (PRODUCTION MODE) created successfully.");
  }
  return stripeClientInstance;
}
