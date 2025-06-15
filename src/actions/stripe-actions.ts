
'use server';

import { stripe } from '@/lib/stripe';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, update, get } from 'firebase/database';
import { formatISO, addDays } from 'date-fns';

const planToPriceMap: Record<PlanId, string> = {
  plano_cargo: process.env.STRIPE_PRICE_ID_PLANO_CARGO || 'price_plano_cargo_anual_placeholder',
  plano_edital: process.env.STRIPE_PRICE_ID_PLANO_EDITAL || 'price_plano_edital_anual_placeholder',
  plano_anual: process.env.STRIPE_PRICE_ID_PLANO_ANUAL || 'price_plano_anual_ilimitado_placeholder',
};

export async function createCheckoutSession(
  planId: PlanId,
  userId: string,
  userEmail: string,
  specificDetails?: { selectedCargoCompositeId?: string; selectedEditalId?: string }
) {
  if (!userId) {
    throw new Error('User ID is required to create a checkout session.');
  }
  if (!planId || !planToPriceMap[planId]) {
    throw new Error('Invalid plan ID or no corresponding Stripe Price ID found.');
  }

  const priceId = planToPriceMap[planId];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  const successUrl = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/checkout/cancel`;

  let stripeCustomerId: string | undefined;

  // Check if user already has a Stripe customer ID in RTDB
  const userRef = ref(db, `users/${userId}`);
  const userSnapshot = await get(userRef);
  if (userSnapshot.exists()) {
    const userData = userSnapshot.val();
    stripeCustomerId = userData.stripeCustomerId;
  }

  // If no Stripe customer ID, create one
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      // Save Stripe customer ID to Firebase RTDB
      await update(userRef, { stripeCustomerId });
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Could not create Stripe customer.');
    }
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
      mode: 'subscription', // Assuming all plans are subscriptions
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
        metadata: metadata, // Pass metadata to subscription too
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

// Basic Webhook Handler Structure
// IMPORTANT: This needs to be deployed as a secure HTTP endpoint (e.g., Firebase Function or Next.js API Route)
// And the endpoint URL needs to be configured in your Stripe Dashboard.
export async function handleStripeWebhook(req: Request) {
  const signature = headers().get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return new Response('Webhook Error: Missing stripe-signature header', { status: 400 });
  }
  if (!webhookSecret) {
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

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // Retrieve metadata
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId as PlanId | undefined;
      const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
      const selectedEditalId = session.metadata?.selectedEditalId;
      const subscriptionId = session.subscription; // Stripe Subscription ID

      if (!userId || !planId) {
        console.error('Webhook Error: Missing userId or planId in checkout session metadata.', session.metadata);
        return new Response('Webhook Error: Missing metadata.', { status: 400 });
      }
      
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        console.error('Webhook Error: Missing or invalid subscription ID in checkout session.', session);
        return new Response('Webhook Error: Missing subscription ID.', { status: 400 });
      }

      // Fetch the subscription to get current_period_end
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const currentPeriodEnd = subscription.current_period_end; // Unix timestamp

      const now = new Date();
      const planDetails = {
        planId,
        startDate: formatISO(now),
        // All plans are annual
        expiryDate: formatISO(new Date(currentPeriodEnd * 1000)), // Convert Unix timestamp to ISO
        ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
        ...(selectedEditalId && { selectedEditalId }),
        stripeSubscriptionId: subscriptionId, // Store Stripe subscription ID
        stripeCustomerId: session.customer, // Store Stripe customer ID
      };

      try {
        const userRef = ref(db, `users/${userId}`);
        await update(userRef, {
          activePlan: planId,
          planDetails: planDetails,
        });
        console.log(`Successfully updated plan for user ${userId} to ${planId}`);

        // If it's plano_cargo, attempt to register for the cargo
        if (planId === 'plano_cargo' && selectedCargoCompositeId) {
            const [editalIdForReg, cargoIdForReg] = selectedCargoCompositeId.split('_');
            if (editalIdForReg && cargoIdForReg) {
                const userSnapshot = await get(userRef);
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    const updatedRegisteredCargoIds = Array.from(new Set([...(userData.registeredCargoIds || []), selectedCargoCompositeId]));
                    await update(userRef, { registeredCargoIds: updatedRegisteredCargoIds });
                    console.log(`Successfully auto-registered user ${userId} for cargo ${selectedCargoCompositeId}`);
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
        // Find user by stripeCustomerId (you'll need to query your DB or adjust data model)
        // For now, assuming planDetails contains stripeCustomerId
        // This part needs a robust way to map stripeCustomerId back to your Firebase UID.
        // A common way is to query your users where stripeCustomerId matches.
        // Since we stored firebaseUID in customer metadata, we can also use that if needed.
        // For simplicity, we assume we can find the user. A real implementation needs this.
         const usersRef = ref(db, 'users');
         const usersSnapshot = await get(usersRef);
         if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            let userIdToUpdate: string | null = null;
            for (const uid in usersData) {
                if (usersData[uid].planDetails?.stripeCustomerId === stripeCustomerId) {
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
                 console.warn(`Webhook Info: Received subscription.deleted for Stripe Customer ID ${stripeCustomerId}, but no matching user found in DB.`);
            }
         }
      } else {
          console.error('Webhook Error: customer.subscription.deleted event without a valid customer ID.', subscription);
      }
      break;
    }
    // Add other event types as needed (e.g., invoice.payment_failed, customer.subscription.updated)
    default:
      console.log(`Unhandled Stripe webhook event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
