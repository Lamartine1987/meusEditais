
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, update, get } from 'firebase/database';
import { formatISO } from 'date-fns';
import type Stripe from 'stripe';

const planToPriceMap: Record<PlanId, string | undefined> = { // Ensure undefined is possible
  plano_cargo: process.env.STRIPE_PRICE_ID_PLANO_CARGO,
  plano_edital: process.env.STRIPE_PRICE_ID_PLANO_EDITAL,
  plano_anual: process.env.STRIPE_PRICE_ID_PLANO_ANUAL,
};

// These are not actual fallbacks, but indicators if env var is missing or explicitly set to these placeholder values
const FALLBACK_PRICE_IDS = [
  'price_plano_cargo_fallback_placeholder',
  'price_plano_edital_fallback_placeholder',
  'price_plano_anual_fallback_placeholder',
];

export async function createCheckoutSession(
  planId: PlanId,
  userId: string,
  userEmail: string,
  specificDetails?: { selectedCargoCompositeId?: string; selectedEditalId?: string }
) {
  // Log all relevant environment variables at the start of the function
  console.log('[createCheckoutSession] Initializing checkout session. PlanID:', planId, 'UserID:', userId);
  console.log(`[createCheckoutSession] ENV_STRIPE_SECRET_KEY_PROD: ${process.env.STRIPE_SECRET_KEY_PROD === undefined ? "undefined" : (process.env.STRIPE_SECRET_KEY_PROD ? "****** (present)" : "EMPTY_STRING_OR_NULL")}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_PRICE_ID_PLANO_CARGO: ${process.env.STRIPE_PRICE_ID_PLANO_CARGO === undefined ? "undefined" : (process.env.STRIPE_PRICE_ID_PLANO_CARGO || "EMPTY_STRING")}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_PRICE_ID_PLANO_EDITAL: ${process.env.STRIPE_PRICE_ID_PLANO_EDITAL === undefined ? "undefined" : (process.env.STRIPE_PRICE_ID_PLANO_EDITAL || "EMPTY_STRING")}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_PRICE_ID_PLANO_ANUAL: ${process.env.STRIPE_PRICE_ID_PLANO_ANUAL === undefined ? "undefined" : (process.env.STRIPE_PRICE_ID_PLANO_ANUAL || "EMPTY_STRING")}`);
  console.log(`[createCheckoutSession] ENV_NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL === undefined ? "undefined" : (process.env.NEXT_PUBLIC_APP_URL || "EMPTY_STRING")}`);


  if (!userId) {
    console.error('[createCheckoutSession] Error: User ID is required.');
    throw new Error('User ID is required to create a checkout session.');
  }
  const stripe = getStripeClient(); // This will throw if STRIPE_SECRET_KEY_PROD is missing/empty

  const priceId = planToPriceMap[planId];
  const envVarNameForPriceId = `STRIPE_PRICE_ID_${planId.toUpperCase()}`;


  if (!priceId || priceId.trim() === '' || FALLBACK_PRICE_IDS.includes(priceId)) {
    const valueFromEnvForPriceId = process.env[envVarNameForPriceId];
    const currentPriceIdValue = priceId === undefined ? 'undefined' : (priceId === null ? 'null' : `'${priceId}'`);
    const envValueDisplay = valueFromEnvForPriceId === undefined ? 'undefined' : (valueFromEnvForPriceId === null ? 'null' : `'${valueFromEnvForPriceId}'`);

    const errorMessage = `Configuration error: Stripe Price ID for plan '${planId}' (environment variable '${envVarNameForPriceId}') is missing, empty, or a fallback.
    - Value from process.env.${envVarNameForPriceId}: ${envValueDisplay}
    - Resolved priceId: ${currentPriceIdValue}
    Please ensure the secret in Google Secret Manager has a valid, non-empty Stripe Price ID (e.g., price_xxxxxxxx) and is correctly linked to your App Hosting backend via apphosting.yaml.`;
    console.error(`[createCheckoutSession] ${errorMessage}`);
    throw new Error(`Configuration error: Stripe Price ID for plan '${planId}' ('${envVarNameForPriceId}') is invalid or not configured. Check server logs.`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  if (appUrl === 'http://localhost:9002' && process.env.NODE_ENV === 'production') {
    console.warn(`[createCheckoutSession] Warning: NEXT_PUBLIC_APP_URL is not set for production. Using default ${appUrl}. This might cause issues with Stripe redirects. Ensure it's set in apphosting.yaml.`);
  }

  const successUrl = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/checkout/cancel`;

  let stripeCustomerId: string | undefined;
  const userRefDb = ref(db, `users/${userId}`);

  try {
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      console.log(`[createCheckoutSession] Found existing Stripe customer: ${stripeCustomerId} for email: ${userEmail}`);
      if (existingCustomers.data[0].metadata?.firebaseUID !== userId) {
        console.log(`[createCheckoutSession] Updating Stripe customer ${stripeCustomerId} metadata to include firebaseUID: ${userId}`);
        try {
            await stripe.customers.update(stripeCustomerId, {
                metadata: { ...existingCustomers.data[0].metadata, firebaseUID: userId },
            });
        } catch (stripeUpdateError: any) {
            console.warn(`[createCheckoutSession] Warning: Could not update Stripe customer metadata for ${userEmail}. Error: ${stripeUpdateError.message}. Proceeding with existing customer ID.`);
        }
      }
    } else {
      console.log(`[createCheckoutSession] Creating new Stripe customer for email: ${userEmail} with firebaseUID: ${userId}`);
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      console.log(`[createCheckoutSession] Created new Stripe customer: ${stripeCustomerId}`);
    }

    try {
      await update(userRefDb, { stripeCustomerId });
      console.log(`[createCheckoutSession] Updated Firebase RTDB for user ${userId} with stripeCustomerId: ${stripeCustomerId}`);
    } catch (dbError: any) {
      console.warn(`[createCheckoutSession] Warning: Could not update Stripe customer ID in Firebase RTDB for user ${userId}. Error: ${dbError.message}. Proceeding with checkout.`);
    }

  } catch (error: any) {
    console.error('[createCheckoutSession] Error retrieving or creating Stripe customer:', error);
    // Avoid proceeding if stripeCustomerId couldn't be established due to a critical error
    if (!stripeCustomerId && (error.message?.includes('permission_denied') || error.code?.includes('PERMISSION_DENIED'))) {
         throw new Error(`Could not establish Stripe customer ID due to a database permission issue: ${error.message}`);
    } else if (!stripeCustomerId) {
         throw new Error(`Could not retrieve or create Stripe customer: ${error.message}`);
    }
    // If stripeCustomerId was established but a minor error occurred (like metadata update failed), we might still proceed.
  }

  if (!stripeCustomerId) {
    // This check is a final safeguard.
    const errorMessage = '[createCheckoutSession] Stripe Customer ID could not be established after attempting to retrieve or create. Cannot proceed with checkout.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const metadata = {
    userId,
    planId,
    ...(specificDetails?.selectedCargoCompositeId && { selectedCargoCompositeId: specificDetails.selectedCargoCompositeId }),
    ...(specificDetails?.selectedEditalId && { selectedEditalId: specificDetails.selectedEditalId }),
  };
  console.log('[createCheckoutSession] Metadata for Stripe session:', metadata);

  try {
    console.log(`[createCheckoutSession] Creating Stripe checkout session with priceId: ${priceId}`);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
      subscription_data: {
        metadata: metadata, // Pass metadata to the subscription object as well
      },
    });
    console.log(`[createCheckoutSession] Stripe checkout session created. ID: ${session.id}, URL: ${session.url ? 'present' : 'missing'}`);

    if (session.url) {
      redirect(session.url);
    } else {
      // This case should ideally not happen if session creation was successful.
      const errorMessage = 'Stripe Checkout session was ostensibly created, but session.url is null or undefined. This should not happen if the session was successful.';
      console.error(`[createCheckoutSession] ${errorMessage}`, session);
      throw new Error('Could not create Stripe Checkout session or the session URL is missing. Check server logs.');
    }
  } catch (error) {
    console.error('[createCheckoutSession] Error creating Stripe checkout session:', error);
    // Provide more specific error to the client if possible
    if (error instanceof Error) {
        throw new Error(`Stripe Error during session creation: ${error.message}`);
    }
    throw new Error('An unknown error occurred while creating the Stripe checkout session.');
  }
}

export async function handleStripeWebhook(req: Request) {
  console.log('[handleStripeWebhook] Received webhook request.');
  const stripe = getStripeClient();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');
  console.log(`[handleStripeWebhook] Stripe Signature from header: ${signature ? 'present' : 'missing'}`);


  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_PROD;
  console.log(`[handleStripeWebhook] ENV_STRIPE_WEBHOOK_SECRET_PROD: ${webhookSecret === undefined ? "undefined" : (webhookSecret ? "****** (present)" : "EMPTY_STRING_OR_NULL")}`);


  if (!signature) {
    const msg = "Webhook Error: Missing stripe-signature header";
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response(msg, { status: 400 });
  }
  if (!webhookSecret || webhookSecret.trim() === '') {
    const currentWebhookKeyValue = webhookSecret === undefined ? 'undefined' : (webhookSecret === null ? 'null' : `'${webhookSecret}'`);
    const msg = `CRITICAL: STRIPE_WEBHOOK_SECRET_PROD is not set or is empty in environment variables. This is a server-side configuration issue. Current value: ${currentWebhookKeyValue}. Ensure secret is linked in apphosting.yaml and has a non-empty value.`;
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response('Webhook Error: Webhook secret not configured or is empty. Server configuration issue.', { status: 500 });
  }

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(`[handleStripeWebhook] Stripe event constructed successfully. Event Type: ${event.type}, Event ID: ${event.id}`);
  } catch (err: any) {
    console.error(`[handleStripeWebhook] Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (!event) { // This check should ideally be redundant if constructEvent throws on failure.
    const msg = "Webhook Error: Stripe event object not constructed after signature verification. This indicates a serious issue with the Stripe library or event handling logic.";
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response('Webhook Error: Internal server error processing event.', { status: 500 });
  }

  console.log(`[handleStripeWebhook] Processing event type: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[handleStripeWebhook] checkout.session.completed: Session ID ${session.id}`);
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId as PlanId | undefined;
      const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
      const selectedEditalId = session.metadata?.selectedEditalId;
      const subscriptionId = session.subscription; // This is the Stripe Subscription ID
      const stripeCustomerIdFromSession = session.customer; // This is the Stripe Customer ID


      if (!userId || !planId) {
        console.error('[handleStripeWebhook] Webhook Error: Missing userId or planId in checkout session metadata.', session.metadata);
        return new Response('Webhook Error: Missing metadata.', { status: 400 });
      }

      if (!subscriptionId || typeof subscriptionId !== 'string') {
        console.error('[handleStripeWebhook] Webhook Error: Missing or invalid subscription ID in checkout session.', session);
        return new Response('Webhook Error: Missing subscription ID.', { status: 400 });
      }

      if (!stripeCustomerIdFromSession || typeof stripeCustomerIdFromSession !== 'string') {
        console.error('[handleStripeWebhook] Webhook Error: Missing or invalid customer ID in checkout session.', session);
        return new Response('Webhook Error: Missing customer ID.', { status: 400 });
      }
      console.log(`[handleStripeWebhook] checkout.session.completed: UserID ${userId}, PlanID ${planId}, SubscriptionID ${subscriptionId}, CustomerID ${stripeCustomerIdFromSession}`);

      // Retrieve the subscription to get the current_period_end
      const subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
      const currentPeriodEnd = subscriptionDetails.current_period_end; // This is a Unix timestamp
      console.log(`[handleStripeWebhook] Subscription current_period_end: ${new Date(currentPeriodEnd * 1000).toISOString()}`);


      const now = new Date();
      const planDetails = {
        planId,
        startDate: formatISO(now),
        expiryDate: formatISO(new Date(currentPeriodEnd * 1000)), // Convert Unix timestamp to ISO string
        ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
        ...(selectedEditalId && { selectedEditalId }),
        stripeSubscriptionId: subscriptionId, // Store Stripe subscription ID
        stripeCustomerId: stripeCustomerIdFromSession, // Store Stripe customer ID (consistent with what was used/created)
      };
      console.log(`[handleStripeWebhook] Plan details to save:`, planDetails);


      try {
        const userFirebaseRef = ref(db, `users/${userId}`);
        // Update user's active plan, plan details, and ensure stripeCustomerId is also updated/confirmed here
        await update(userFirebaseRef, {
          activePlan: planId,
          planDetails: planDetails,
          stripeCustomerId: stripeCustomerIdFromSession // Ensure this is saved/updated from the session
        });
        console.log(`[handleStripeWebhook] Successfully updated plan for user ${userId} to ${planId}`);

        // Auto-register for cargo if it's a plano_cargo purchase
        if (planId === 'plano_cargo' && selectedCargoCompositeId) {
            console.log(`[handleStripeWebhook] Plano Cargo: Attempting to auto-register user ${userId} for cargo ${selectedCargoCompositeId}`);
            const userSnapshot = await get(userFirebaseRef);
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const updatedRegisteredCargoIds = Array.from(new Set([...(userData.registeredCargoIds || []), selectedCargoCompositeId]));
                await update(userFirebaseRef, { registeredCargoIds: updatedRegisteredCargoIds });
                console.log(`[handleStripeWebhook] Successfully auto-registered user ${userId} for cargo ${selectedCargoCompositeId}`);
            } else {
                console.warn(`[handleStripeWebhook] Webhook: User ${userId} not found in DB for auto-registration to cargo.`);
            }
        }

      } catch (dbError) {
        console.error(`[handleStripeWebhook] Webhook Error: Failed to update user ${userId} in database:`, dbError);
        return new Response('Webhook Error: Database update failed.', { status: 500 });
      }
      break;
    }
    // Handle subscription updates or cancellations
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[handleStripeWebhook] customer.subscription.deleted: Subscription ID ${subscription.id}`);
      const stripeCustomerId = subscription.customer; // This is Stripe Customer ID
       if (typeof stripeCustomerId === 'string') {
         // Find user by Stripe Customer ID and update their plan
         console.log(`[handleStripeWebhook] Finding user by Stripe Customer ID: ${stripeCustomerId}`);
         // Query Firebase RTDB for a user with this stripeCustomerId
         // This requires an efficient way to query or iterate if not directly indexed
         // For simplicity, assuming you might iterate or have a specific lookup structure
         const usersRef = ref(db, 'users');
         const usersSnapshot = await get(usersRef);
         if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            let userIdToUpdate: string | null = null;
            // Iterate through users to find a match for stripeCustomerId
            for (const uid in usersData) {
                if (usersData[uid].stripeCustomerId === stripeCustomerId ||
                    (usersData[uid].planDetails && usersData[uid].planDetails.stripeCustomerId === stripeCustomerId)) {
                    userIdToUpdate = uid;
                    console.log(`[handleStripeWebhook] Found matching Firebase UID: ${userIdToUpdate} for Stripe Customer ID ${stripeCustomerId}`);
                    break;
                }
            }

            if (userIdToUpdate) {
                try {
                    await update(ref(db, `users/${userIdToUpdate}`), {
                        activePlan: null,
                        planDetails: null, // Or set expiry to now, or mark as cancelled
                    });
                    console.log(`[handleStripeWebhook] Successfully cancelled plan for user with Stripe Customer ID ${stripeCustomerId} (Firebase UID: ${userIdToUpdate})`);
                } catch (dbError) {
                    console.error(`[handleStripeWebhook] Webhook Error: Failed to cancel subscription for user ${userIdToUpdate} in DB:`, dbError);
                    // Don't necessarily return 500 to Stripe, as the event was processed, but log the DB error
                }
            } else {
                 console.warn(`[handleStripeWebhook] Webhook Info: Received subscription.deleted for Stripe Customer ID ${stripeCustomerId}, but no matching user found in DB by stripeCustomerId field.`);
            }
         } else {
            console.warn(`[handleStripeWebhook] Webhook Info: No users found in DB to check for Stripe Customer ID ${stripeCustomerId}.`);
         }
      } else {
          console.error('[handleStripeWebhook] Webhook Error: customer.subscription.deleted event without a valid customer ID.', subscription);
      }
      break;
    }
    // Add other event types like customer.subscription.updated if needed
    default:
      console.log(`[handleStripeWebhook] Unhandled Stripe webhook event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

    
