
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, update, get } from 'firebase/database'; 
import { formatISO } from 'date-fns';
import type Stripe from 'stripe';

const planToPriceMap: Record<PlanId, string> = {
  plano_cargo: process.env.STRIPE_PRICE_ID_PLANO_CARGO || 'price_plano_cargo_fallback_placeholder',
  plano_edital: process.env.STRIPE_PRICE_ID_PLANO_EDITAL || 'price_plano_edital_fallback_placeholder',
  plano_anual: process.env.STRIPE_PRICE_ID_PLANO_ANUAL || 'price_plano_anual_fallback_placeholder',
};

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
  if (!userId) {
    throw new Error('User ID is required to create a checkout session.');
  }
  const stripe = getStripeClient();

  const priceId = planToPriceMap[planId];

  if (!priceId || FALLBACK_PRICE_IDS.includes(priceId)) {
    const envVarName = `STRIPE_PRICE_ID_${planId.toUpperCase()}`;
    const errorMessage = `Configuration error: Stripe Price ID for plan '${planId}' is not correctly set. The application is attempting to use a fallback ID ('${priceId}'). Please ensure the environment variable '${envVarName}' is correctly set in your Firebase App Hosting backend with a valid Price ID from your Stripe dashboard. Also, verify that the backend has permissions to access this secret and that it's properly linked.`;
    console.error(errorMessage);
    // Throwing an error here will result in a 500 on the client, which is appropriate for config errors.
    throw new Error(`Configuration error: Stripe Price ID for plan '${planId}' not found or is a fallback. Check server logs and environment variable '${envVarName}'.`);
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  const successUrl = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/checkout/cancel`;

  let stripeCustomerId: string | undefined;
  const userRef = ref(db, `users/${userId}`);

  try {
    // Attempt to retrieve existing Stripe customer by email
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      // Optionally, ensure Firebase UID is linked if metadata exists and is different
      if (existingCustomers.data[0].metadata?.firebaseUID !== userId) {
        // This update is best-effort; if it fails, we still proceed with the existing customer ID
        try {
            await stripe.customers.update(stripeCustomerId, {
                metadata: { ...existingCustomers.data[0].metadata, firebaseUID: userId },
            });
        } catch (stripeUpdateError: any) {
            console.warn(`Warning: Could not update Stripe customer metadata for ${userEmail}. Error: ${stripeUpdateError.message}. Proceeding with existing customer ID.`);
        }
      }
    } else {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId, // Link Firebase UID to Stripe Customer metadata
        },
      });
      stripeCustomerId = customer.id;
    }

    // Attempt to save/update the Stripe customer ID in Firebase RTDB
    // This is best-effort. If it fails due to DB permissions, we still proceed with checkout.
    // The webhook can also attempt to save this later.
    try {
      await update(userRef, { stripeCustomerId });
    } catch (dbError: any) {
      console.warn(`Warning: Could not update Stripe customer ID in Firebase RTDB for user ${userId}. Error: ${dbError.message}. Proceeding with checkout.`);
    }

  } catch (error: any) {
    console.error('Error retrieving or creating Stripe customer:', error);
    // If stripeCustomerId is still not set after all attempts, then it's a critical failure.
    if (!stripeCustomerId && error.message.includes('permission_denied')) {
         // This implies a fundamental issue with DB access if initial read was attempted and failed for permissions.
         // However, with the new logic, this specific path is less likely unless the write fails.
         throw new Error(`Could not establish Stripe customer ID due to a database permission issue: ${error.message}`);
    } else if (!stripeCustomerId) {
         // Generic failure if customer ID could not be established for other Stripe API reasons
         throw new Error(`Could not retrieve or create Stripe customer: ${error.message}`);
    }
    // If stripeCustomerId *is* set but some part of the DB update failed, we log a warning but can proceed.
  }

  // Final check for stripeCustomerId before creating checkout session
  if (!stripeCustomerId) {
    // This error indicates a failure in the logic above to set stripeCustomerId
    throw new Error('Stripe Customer ID could not be established. Cannot proceed with checkout.');
  }


  const metadata = {
    userId,
    planId,
    ...(specificDetails?.selectedCargoCompositeId && { selectedCargoCompositeId: specificDetails.selectedCargoCompositeId }),
    ...(specificDetails?.selectedEditalId && { selectedEditalId: specificDetails.selectedEditalId }),
  };

  try {
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
        metadata: metadata, 
      },
    });

    if (session.url) {
      redirect(session.url);
    } else {
      throw new Error('Could not create Stripe Checkout session.');
    }
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    if (error instanceof Error) {
        throw new Error(`Stripe Error: ${error.message}`);
    }
    throw new Error('An unknown error occurred while creating the checkout session.');
  }
}

export async function handleStripeWebhook(req: Request) {
  const stripe = getStripeClient();
  const signature = headers().get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return new Response('Webhook Error: Missing stripe-signature header', { status: 400 });
  }
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set in environment variables.");
    return new Response('Webhook Error: Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Explicitly check if event is defined. This should always be true if the catch block above didn't return.
  // This helps satisfy TypeScript's strict checks.
  if (!event) {
    console.error("Webhook Error: Event not constructed after try/catch block. This should not happen.");
    return new Response('Webhook Error: Internal server error processing event.', { status: 500 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId as PlanId | undefined;
      const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
      const selectedEditalId = session.metadata?.selectedEditalId;
      const subscriptionId = session.subscription; 
      const stripeCustomerIdFromSession = session.customer;


      if (!userId || !planId) {
        console.error('Webhook Error: Missing userId or planId in checkout session metadata.', session.metadata);
        return new Response('Webhook Error: Missing metadata.', { status: 400 });
      }
      
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        console.error('Webhook Error: Missing or invalid subscription ID in checkout session.', session);
        return new Response('Webhook Error: Missing subscription ID.', { status: 400 });
      }
      
      if (!stripeCustomerIdFromSession || typeof stripeCustomerIdFromSession !== 'string') {
        console.error('Webhook Error: Missing or invalid customer ID in checkout session.', session);
        return new Response('Webhook Error: Missing customer ID.', { status: 400 });
      }

      const subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
      const currentPeriodEnd = subscriptionDetails.current_period_end; 

      const now = new Date();
      const planDetails = {
        planId,
        startDate: formatISO(now),
        expiryDate: formatISO(new Date(currentPeriodEnd * 1000)), 
        ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
        ...(selectedEditalId && { selectedEditalId }),
        stripeSubscriptionId: subscriptionId, 
        stripeCustomerId: stripeCustomerIdFromSession, 
      };

      try {
        const userRefDb = ref(db, `users/${userId}`);
        await update(userRefDb, {
          activePlan: planId,
          planDetails: planDetails,
          stripeCustomerId: stripeCustomerIdFromSession // Ensure this is also updated here
        });
        console.log(`Successfully updated plan for user ${userId} to ${planId}`);

        // Auto-register for cargo if it's a 'plano_cargo' purchase
        if (planId === 'plano_cargo' && selectedCargoCompositeId) {
            // No need to split selectedCargoCompositeId, it's already the full ID needed
            const userSnapshot = await get(userRefDb); // Re-fetch user data to get current registeredCargoIds
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                // Ensure registeredCargoIds is treated as an array and avoid duplicates
                const updatedRegisteredCargoIds = Array.from(new Set([...(userData.registeredCargoIds || []), selectedCargoCompositeId]));
                await update(userRefDb, { registeredCargoIds: updatedRegisteredCargoIds });
                console.log(`Successfully auto-registered user ${userId} for cargo ${selectedCargoCompositeId}`);
            } else {
                console.warn(`Webhook: User ${userId} not found in DB for auto-registration to cargo.`);
            }
        }

      } catch (dbError) {
        console.error(`Webhook Error: Failed to update user ${userId} in database:`, dbError);
        return new Response('Webhook Error: Database update failed.', { status: 500 });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer;
       if (typeof stripeCustomerId === 'string') {
         // Need to find the user by Stripe Customer ID
         // This requires querying or iterating if you don't have a direct index.
         // For RTDB, you might need to fetch all users and filter, which is not ideal for large datasets.
         // A better approach would be to store a mapping or query by child.
         // For simplicity here, we'll assume a direct lookup or small user base.
         const usersRef = ref(db, 'users');
         const usersSnapshot = await get(usersRef); // This can be inefficient.
         if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            let userIdToUpdate: string | null = null;
            // Find user by stripeCustomerId or planDetails.stripeCustomerId
            for (const uid in usersData) {
                if (usersData[uid].stripeCustomerId === stripeCustomerId || 
                    (usersData[uid].planDetails && usersData[uid].planDetails.stripeCustomerId === stripeCustomerId)) {
                    userIdToUpdate = uid;
                    break;
                }
            }

            if (userIdToUpdate) {
                try {
                    await update(ref(db, `users/${userIdToUpdate}`), {
                        activePlan: null,
                        planDetails: null,
                        // Optionally, you might want to keep stripeSubscriptionId for history or clear it
                        // 'planDetails/stripeSubscriptionId': null 
                    });
                    console.log(`Successfully cancelled plan for user with Stripe Customer ID ${stripeCustomerId} (Firebase UID: ${userIdToUpdate})`);
                } catch (dbError) {
                    console.error(`Webhook Error: Failed to cancel subscription for user in DB:`, dbError);
                    // Don't return 500 to Stripe if DB update fails, as Stripe will retry.
                    // Log the error and potentially handle reconciliation later.
                }
            } else {
                 console.warn(`Webhook Info: Received subscription.deleted for Stripe Customer ID ${stripeCustomerId}, but no matching user found in DB by stripeCustomerId field.`);
            }
         }
      } else {
          console.error('Webhook Error: customer.subscription.deleted event without a valid customer ID.', subscription);
      }
      break;
    }
    // TODO: Handle other events like 'invoice.payment_failed', 'customer.subscription.updated'
    default:
      console.log(`Unhandled Stripe webhook event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

