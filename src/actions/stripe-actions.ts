
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId, PlanDetails } from '@/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin'; // Use Admin DB
import { formatISO } from 'date-fns';
import type Stripe from 'stripe';

const planToPriceMap: Record<PlanId, string | undefined> = {
  plano_cargo: process.env.STRIPE_PRICE_ID_PLANO_CARGO,
  plano_edital: process.env.STRIPE_PRICE_ID_PLANO_EDITAL,
  plano_anual: process.env.STRIPE_PRICE_ID_PLANO_ANUAL,
  plano_trial: undefined, // Trial não tem preço Stripe
};

const planRank: Record<PlanId, number> = {
  plano_trial: 0,
  plano_cargo: 1,
  plano_edital: 2,
  plano_anual: 3,
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
  console.log(`[createCheckoutSession] Called for PRODUCTION. PlanID: ${planId}, UserID: ${userId}, UserEmail: ${userEmail}, SpecificDetails: ${JSON.stringify(specificDetails)}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_SECRET_KEY_PROD: ${process.env.STRIPE_SECRET_KEY_PROD === undefined ? "undefined" : (process.env.STRIPE_SECRET_KEY_PROD ? "****** (present)" : "EMPTY_STRING_OR_NULL")}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_PRICE_ID_PLANO_CARGO: ${process.env.STRIPE_PRICE_ID_PLANO_CARGO === undefined ? "undefined" : (process.env.STRIPE_PRICE_ID_PLANO_CARGO || "EMPTY_STRING")}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_PRICE_ID_PLANO_EDITAL: ${process.env.STRIPE_PRICE_ID_PLANO_EDITAL === undefined ? "undefined" : (process.env.STRIPE_PRICE_ID_PLANO_EDITAL || "EMPTY_STRING")}`);
  console.log(`[createCheckoutSession] ENV_STRIPE_PRICE_ID_PLANO_ANUAL: ${process.env.STRIPE_PRICE_ID_PLANO_ANUAL === undefined ? "undefined" : (process.env.STRIPE_PRICE_ID_PLANO_ANUAL || "EMPTY_STRING")}`);
  console.log(`[createCheckoutSession] ENV_NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL === undefined ? "undefined" : (process.env.NEXT_PUBLIC_APP_URL || "EMPTY_STRING")}`);


  if (!userId) {
    const errorMsg = '[createCheckoutSession] Error: User ID is required.';
    console.error(errorMsg);
    throw new Error('User ID is required to create a checkout session.');
  }
  const stripe = getStripeClient();

  const priceId = planToPriceMap[planId];
  const envVarNameForPriceId = `STRIPE_PRICE_ID_${planId.toUpperCase()}`;
  console.log(`[createCheckoutSession] PlanID: '${planId}' maps to PriceID Var: '${envVarNameForPriceId}', resolved PriceID: '${priceId || 'undefined'}'`);


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
  console.log(`[createCheckoutSession] App URL for redirect: ${appUrl}`);
  if (appUrl === 'http://localhost:9002' && process.env.NODE_ENV === 'production') {
    console.warn(`[createCheckoutSession] Warning: NEXT_PUBLIC_APP_URL is not set for production. Using default ${appUrl}. This might cause issues with Stripe redirects. Ensure it's set in apphosting.yaml.`);
  }

  const successUrl = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/checkout/cancel`;
  console.log(`[createCheckoutSession] SuccessURL: ${successUrl}, CancelURL: ${cancelUrl}`);

  let stripeCustomerId: string | undefined;
  const userRefDb = adminDb.ref(`users/${userId}`); // Use adminDb ref
  console.log(`[createCheckoutSession] User Firebase DB Ref: users/${userId}`);

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
            console.log(`[createCheckoutSession] Stripe customer metadata updated for ${stripeCustomerId}.`);
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
      await userRefDb.update({ stripeCustomerId }); // Use admin ref update
      console.log(`[createCheckoutSession] Updated Firebase RTDB for user ${userId} with stripeCustomerId: ${stripeCustomerId}`);
    } catch (dbError: any) {
       console.warn(`[createCheckoutSession] Warning: Could not update Stripe customer ID in Firebase RTDB for user ${userId}. Error: ${dbError.message}. Proceeding with checkout.`);
    }

  } catch (error: any) {
    console.error('[createCheckoutSession] Error retrieving or creating Stripe customer:', error);
    if (!stripeCustomerId && (error.message?.includes('permission_denied') || error.code?.includes('PERMISSION_DENIED'))) {
         throw new Error(`Could not establish Stripe customer ID due to a database permission issue: ${error.message}`);
    } else if (!stripeCustomerId) {
         throw new Error(`Could not retrieve or create Stripe customer: ${error.message}`);
    }
    // If stripeCustomerId was set but DB update failed, we still proceed.
  }

  if (!stripeCustomerId) {
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
  
  console.log('[createCheckoutSession] Metadata to be sent to Stripe session:', metadata);

  let session: Stripe.Checkout.Session;
  try {
    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      payment_method_options: {
        card: {
          installments: {
            enabled: true,
          },
        },
      },
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
      customer_update: {
        address: 'auto'
      },
      billing_address_collection: 'required'
    };

    console.log(`[createCheckoutSession] Creating Stripe checkout session. PriceID: ${priceId}, CustomerID: ${stripeCustomerId}`);
    console.log('[createCheckoutSession] Full session creation payload:', JSON.stringify(sessionPayload, null, 2));

    session = await stripe.checkout.sessions.create(sessionPayload);
    
  } catch (error: any) {
    console.error('[createCheckoutSession] Stripe checkout session creation failed:', error.message, error);
    if (error.code === 'resource_missing' && error.param === 'line_items[0][price]') {
      throw new Error(`O Price ID '${priceId}' não foi encontrado no Stripe. Verifique se ele está correto e ativo.`);
    }
    if (error.message.includes('mode=payment')) {
       throw new Error(`O preço configurado no Stripe não é compatível com pagamento único (one-time). Verifique se o Price ID '${priceId}' é do tipo 'Avulso' no painel do Stripe.`);
    }
    throw new Error(`Erro ao criar sessão de checkout no Stripe: ${error.message}`);
  }
  
  console.log(`[createCheckoutSession] Stripe checkout session created. ID: ${session.id}, URL available: ${!!session.url}`);

  if (session.url) {
    redirect(session.url);
  } else {
    const errorMessage = 'Stripe Checkout session was created, but session.url is null or undefined.';
    console.error(`[createCheckoutSession] ${errorMessage}`, session);
    throw new Error('Could not create Stripe Checkout session or the session URL is missing. Check server logs.');
  }
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] Received PRODUCTION webhook request.');
  const stripe = getStripeClient();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');
  console.log(`[handleStripeWebhook] Stripe Signature from header: ${signature ? 'present' : 'missing (THIS IS A PROBLEM!)'}`);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_PROD;
  console.log(`[handleStripeWebhook] ENV_STRIPE_WEBHOOK_SECRET_PROD: ${webhookSecret === undefined ? "undefined" : (webhookSecret ? "****** (present)" : "EMPTY_STRING_OR_NULL (THIS IS A CRITICAL PROBLEM!)")}`);

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
  let rawBody: string = '';
  try {
    rawBody = await req.text(); // Read body once
    console.log('[handleStripeWebhook] Raw request body received (first 500 chars):', rawBody.substring(0, 500));
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(`[handleStripeWebhook] Stripe event constructed successfully. Event Type: ${event.type}, Event ID: ${event.id}`);
  } catch (err: any) {
    console.error(`[handleStripeWebhook] Webhook signature verification failed: ${err.message}. Raw body was: ${rawBody ? rawBody.substring(0, 500) + '...' : 'COULD NOT READ BODY'}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (!event) {
    const msg = "Webhook Error: Stripe event object not constructed after signature verification. This indicates a serious issue with the Stripe library or event handling logic.";
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response('Webhook Error: Internal server error processing event.', { status: 500 });
  }

  console.log(`[handleStripeWebhook] Processing event type: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[handleStripeWebhook] Event: checkout.session.completed. Session ID: ${session.id}. Full session metadata: ${JSON.stringify(session.metadata)}`);
        
        const userId = session.metadata?.userId;
        const planIdFromMetadata = session.metadata?.planId as PlanId | undefined;
        const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
        const selectedEditalId = session.metadata?.selectedEditalId; 
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        const stripeCustomerIdFromSession = session.customer;
        const userEmail = session.customer_details?.email;
        const userName = session.customer_details?.name;

        console.log(`[handleStripeWebhook] Extracted Metadata - UserID: ${userId}, PlanID: ${planIdFromMetadata}, CargoID: ${selectedCargoCompositeId}, EditalID: ${selectedEditalId}, PaymentIntentID: ${paymentIntentId}, CustomerID: ${stripeCustomerIdFromSession}, Email: ${userEmail}, Name: ${userName}`);

        if (!userId || !planIdFromMetadata) {
          console.error('[handleStripeWebhook] Webhook Error: Missing userId or planIdFromMetadata in checkout session metadata.', session.metadata);
          return new Response('Webhook Error: Missing critical metadata (userId or planIdFromMetadata).', { status: 400 });
        }

        if (planIdFromMetadata === 'plano_trial') {
            console.error(`[handleStripeWebhook] CRITICAL WARNING: Checkout session ${session.id} completed, but planId in metadata is 'plano_trial'. This indicates a potential issue in checkout session creation if a paid plan was expected. UserID: ${userId}.`);
            return new Response('Webhook Error: Invalid planId ("plano_trial") received for a completed checkout session. Configuration error likely.', { status: 400 });
        }
        
        if (!stripeCustomerIdFromSession || typeof stripeCustomerIdFromSession !== 'string') {
          console.error('[handleStripeWebhook] Webhook Error: Missing or invalid customer ID in checkout session.', session);
          return new Response('Webhook Error: Missing or invalid customer ID.', { status: 400 });
        }
        
        console.log(`[handleStripeWebhook] All critical IDs seem present. Proceeding to update user plan.`);
        
        const userFirebaseRef = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userFirebaseRef.get();
        const currentUserData = userSnapshot.val() || {};
        console.log(`[handleStripeWebhook] User ${userId} data BEFORE plan update: activePlan: ${currentUserData.activePlan}, activePlans count: ${(currentUserData.activePlans || []).length}`);

        const now = new Date();
        const startDateISO = formatISO(now);
        const expiryDate = new Date(new Date().setFullYear(now.getFullYear() + 1));
        const expiryDateISO = formatISO(expiryDate);
        console.log(`[handleStripeWebhook] Payment mode: Plan expiry set for 1 year. Start: ${startDateISO}, Expiry: ${expiryDateISO}`);
        
        const newPlan: PlanDetails = {
          planId: planIdFromMetadata,
          startDate: startDateISO,
          expiryDate: expiryDateISO,
          ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
          ...(selectedEditalId && { selectedEditalId }),
          stripeSubscriptionId: null,
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: stripeCustomerIdFromSession,
        };
        
        const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
        let finalActivePlans: PlanDetails[] = [];
        let newPlanHistory = currentUserData.planHistory || [];

        if (newPlan.planId === 'plano_anual') {
            finalActivePlans = [newPlan];
            // Move all previous active plans to history
            newPlanHistory = [...newPlanHistory, ...currentActivePlans];
            console.log(`[handleStripeWebhook] PLANO_ANUAL purchase. Overwriting all other plans. Moved ${currentActivePlans.length} plans to history.`);
        } else {
            // Add the new plan to the existing ones
            finalActivePlans = [...currentActivePlans, newPlan];
            console.log(`[handleStripeWebhook] New plan added. Total active plans now: ${finalActivePlans.length}`);
        }
        
        // Determine the highest tier active plan
        const highestPlan = finalActivePlans.reduce((max, plan) => {
          return planRank[plan.planId] > planRank[max.planId] ? plan : max;
        }, { planId: 'plano_trial' } as PlanDetails);

        const newHasHadFreeTrialValue = currentUserData.hasHadFreeTrial || true;

        const updatePayload: any = {
          activePlan: highestPlan.planId,
          activePlans: finalActivePlans,
          stripeCustomerId: stripeCustomerIdFromSession,
          hasHadFreeTrial: newHasHadFreeTrialValue,
          planHistory: newPlanHistory,
        };
        
        // Handle auto-registration for plano_cargo purchase
        if (planIdFromMetadata === 'plano_cargo' && selectedCargoCompositeId) {
            const currentRegistered = currentUserData.registeredCargoIds || [];
            if (!currentRegistered.includes(selectedCargoCompositeId)) {
                updatePayload.registeredCargoIds = [...currentRegistered, selectedCargoCompositeId];
                console.log(`[handleStripeWebhook] PLANO_CARGO: Auto-registering user ${userId} for cargo: ${selectedCargoCompositeId}.`);
            }
        }

        console.log(`[handleStripeWebhook] FINAL DB UPDATE PAYLOAD for user ${userId}:`, JSON.stringify(updatePayload, null, 2));
        
        try {
          await userFirebaseRef.update(updatePayload);
          console.log(`[handleStripeWebhook] Successfully updated user data for ${userId} in Firebase.`);
        } catch (dbError: any) {
          console.error(`[handleStripeWebhook] Webhook Error: Failed to update user ${userId} in database:`, dbError);
          return new Response('Webhook Error: Database update failed. Check server logs.', { status: 500 });
        }
        
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent;
        console.log(`[handleStripeWebhook] Event: charge.refunded. PaymentIntent ID: ${paymentIntentId}`);

        if (!paymentIntentId || typeof paymentIntentId !== 'string') {
          console.error(`[handleStripeWebhook] Refund event for charge ${charge.id} is missing a valid PaymentIntent ID.`);
          return new Response('Webhook Error: Refund event missing PaymentIntent ID.', { status: 400 });
        }

        const usersRef = adminDb.ref('users');
        const usersSnapshot = await usersRef.orderByChild('stripeCustomerId').equalTo(charge.customer as string).get();

        if (!usersSnapshot.exists()) {
          console.error(`[handleStripeWebhook] No user found with Stripe Customer ID: ${charge.customer}. Cannot process refund.`);
          return new Response('Webhook Error: User not found for refund.', { status: 404 });
        }
        
        const usersData = usersSnapshot.val();
        const userId = Object.keys(usersData)[0];
        const userData = usersData[userId];
        const userFirebaseRef = adminDb.ref(`users/${userId}`);

        console.log(`[handleStripeWebhook] Found user ${userId} for refund processing.`);

        const planToRemoveIndex = (userData.activePlans || []).findIndex((p: PlanDetails) => p.stripePaymentIntentId === paymentIntentId);

        if (planToRemoveIndex === -1) {
           console.warn(`[handleStripeWebhook] User ${userId} received a refund for PaymentIntent ${paymentIntentId}, but no matching active plan was found. No action taken.`);
           return new Response('Plan for refund not found.', { status: 200 }); // Return 200 so Stripe doesn't retry
        }
        
        const planToRemove = userData.activePlans[planToRemoveIndex];
        const updatedActivePlans = userData.activePlans.filter((_: any, index: number) => index !== planToRemoveIndex);

        // Move the refunded plan to history
        const updatedPlanHistory = [...(userData.planHistory || []), { ...planToRemove, planId: `refunded_${planToRemove.planId}` as any }];

        // Recalculate highest active plan
        let highestPlan: PlanDetails | null = null;
        if (updatedActivePlans.length > 0) {
            highestPlan = updatedActivePlans.reduce((max: PlanDetails, plan: PlanDetails) => {
                return planRank[plan.planId] > planRank[max.planId] ? plan : max;
            }, updatedActivePlans[0]);
        }
          
        const updatePayload = {
          activePlans: updatedActivePlans,
          activePlan: highestPlan ? highestPlan.planId : null,
          planHistory: updatedPlanHistory,
        };

        console.log(`[handleStripeWebhook] Refunding plan ${planToRemove.planId} for user ${userId}. DB Update Payload:`, JSON.stringify(updatePayload, null, 2));

        try {
          await userFirebaseRef.update(updatePayload);
          console.log(`[handleStripeWebhook] Successfully processed refund and updated DB for user ${userId}.`);
        } catch (dbError: any) {
          console.error(`[handleStripeWebhook] DB Error during refund processing for user ${userId}:`, dbError);
          return new Response('Webhook Error: Database update failed during refund. Check server logs.', { status: 500 });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[handleStripeWebhook] Event: customer.subscription.deleted. Subscription ID ${subscription.id}`);
        // This logic might need adjustment in a multi-plan scenario if using subscriptions.
        // For now, with one-time payments, this event is less critical.
        // The logic for finding user by stripeCustomerId remains valid.
        const stripeCustomerId = subscription.customer;
         if (typeof stripeCustomerId === 'string') {
           console.log(`[handleStripeWebhook] Finding user by Stripe Customer ID: ${stripeCustomerId}`);
           const usersRef = adminDb.ref('users');
           const usersSnapshot = await usersRef.get();
           if (usersSnapshot.exists()) {
              const usersData = usersSnapshot.val();
              for (const uid in usersData) {
                  const userData = usersData[uid];
                  if (userData.stripeCustomerId === stripeCustomerId || userData.activePlans?.some((p: PlanDetails) => p.stripeCustomerId === stripeCustomerId)) {
                      console.log(`[handleStripeWebhook] Found matching Firebase UID: ${uid} for Stripe Customer ID ${stripeCustomerId}`);
                      // Here, you'd implement logic to remove the specific plan tied to the subscriptionId from the `activePlans` array.
                      // This requires storing stripeSubscriptionId in the PlanDetails object for each plan.
                      // For now, let's log a warning.
                      console.warn(`[handleStripeWebhook] Subscription deletion received, but automatic plan removal for multi-plan setup is not fully implemented. Manual check may be needed for user ${uid}.`);
                      break;
                  }
              }
           }
        }
        break;
      }
      default:
        console.log(`[handleStripeWebhook] Unhandled Stripe webhook event type: ${event.type}. Event ID: ${event.id}`);
    }
  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] Error processing event type ${event.type} (Event ID: ${event.id}):`, processingError);
      return new Response(`Webhook Error: Internal server error processing event ${event.type}. ${processingError.message}`, { status: 500 });
  }

  console.log(`[handleStripeWebhook] Successfully processed event type: ${event.type}. Event ID: ${event.id}. Returning 200 OK to Stripe.`);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
