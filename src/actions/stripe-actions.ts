
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, update, get } from 'firebase/database'; 
import { formatISO } from 'date-fns'; // Removed addDays as it's not used here directly

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
    throw new Error(`Configuration error: Stripe Price ID for plan '${planId}' not found or is a fallback. Check server logs and environment variable '${envVarName}'.`);
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  const successUrl = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/checkout/cancel`;

  let stripeCustomerId: string | undefined;
  const userRef = ref(db, `users/${userId}`);

  try {
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      if (existingCustomers.data[0].metadata?.firebaseUID !== userId) {
        await stripe.customers.update(stripeCustomerId, {
          metadata: { ...existingCustomers.data[0].metadata, firebaseUID: userId },
        });
      }
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
    }

    try {
      await update(userRef, { stripeCustomerId });
    } catch (dbError: any) {
      console.warn(`Warning: Could not update Stripe customer ID in Firebase RTDB for user ${userId}. Error: ${dbError.message}. Proceeding with checkout.`);
    }

  } catch (error: any) {
    console.error('Error retrieving or creating Stripe customer:', error);
    if (!stripeCustomerId && error.message.includes('permission_denied')) {
         throw new Error(`Could not establish Stripe customer ID due to a database permission issue: ${error.message}`);
    } else if (!stripeCustomerId) {
         throw new Error(`Could not retrieve or create Stripe customer: ${error.message}`);
    }
  }

  if (!stripeCustomerId) {
    throw new Error('Stripe Customer ID could not be established.');
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
          stripeCustomerId: stripeCustomerIdFromSession 
        });
        console.log(`Successfully updated plan for user ${userId} to ${planId}`);

        if (planId === 'plano_cargo' && selectedCargoCompositeId) {
            const [editalIdForReg, cargoIdForReg] = selectedCargoCompositeId.split('_');
            if (editalIdForReg && cargoIdForReg) {
                const userSnapshot = await get(userRefDb); 
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    const updatedRegisteredCargoIds = Array.from(new Set([...(userData.registeredCargoIds || []), selectedCargoCompositeId]));
                    await update(userRefDb, { registeredCargoIds: updatedRegisteredCargoIds });
                    console.log(`Successfully auto-registered user ${userId} for cargo ${selectedCargoCompositeId}`);
                } else {
                    console.warn(`Webhook: User ${userId} not found in DB for auto-registration to cargo.`);
                }
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
         const usersRef = ref(db, 'users');
         const usersSnapshot = await get(usersRef); 
         if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            let userIdToUpdate: string | null = null;
            for (const uid in usersData) {
                if (usersData[uid].stripeCustomerId === stripeCustomerId || usersData[uid].planDetails?.stripeCustomerId === stripeCustomerId) {
                    userIdToUpdate = uid;
                    break;
                }
            }
            if (userIdToUpdate) {
                try {
                    await update(ref(db, `users/${userIdToUpdate}`), {
                        activePlan: null,
                        planDetails: null,
                    });
                    console.log(`Successfully cancelled plan for user with Stripe Customer ID ${stripeCustomerId} (Firebase UID: ${userIdToUpdate})`);
                } catch (dbError) {
                    console.error(`Webhook Error: Failed to cancel subscription for user in DB:`, dbError);
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
    default:
      console.log(`Unhandled Stripe webhook event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
