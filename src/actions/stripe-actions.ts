
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId } from '@/types';
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

  try {
    console.log(`[createCheckoutSession] Creating Stripe checkout session with PriceID: ${priceId}, CustomerID: ${stripeCustomerId}`);
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
        metadata: metadata, // Also pass metadata to subscription for easier retrieval later if needed
      },
    });
    console.log(`[createCheckoutSession] Stripe checkout session created. ID: ${session.id}, URL available: ${!!session.url}`);

    if (session.url) {
      redirect(session.url);
    } else {
      const errorMessage = 'Stripe Checkout session was ostensibly created, but session.url is null or undefined. This should not happen if the session was successful.';
      console.error(`[createCheckoutSession] ${errorMessage}`, session);
      throw new Error('Could not create Stripe Checkout session or the session URL is missing. Check server logs.');
    }
  } catch (error: any) {
    if (
      (error && typeof error.digest === 'string' && error.digest.toUpperCase().includes('NEXT_REDIRECT')) ||
      (error && typeof error.message === 'string' && error.message.toUpperCase().includes('NEXT_REDIRECT'))
    ) {
      console.log('[createCheckoutSession] Caught NEXT_REDIRECT error, re-throwing.');
      throw error; 
    }

    console.error('[createCheckoutSession] Error creating Stripe checkout session (not a redirect error):', error);
    if (error instanceof Error) {
        const displayMessage = error.message && !error.message.toUpperCase().includes('NEXT_REDIRECT')
            ? error.message
            : 'An issue occurred with the payment provider.';
        throw new Error(`Stripe Error during session creation: ${displayMessage}`);
    }
    throw new Error('An unknown error occurred while creating the Stripe checkout session.');
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
  let rawBody: string;
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
        const subscriptionId = session.subscription;
        const stripeCustomerIdFromSession = session.customer;

        console.log(`[handleStripeWebhook] Extracted Metadata - UserID: ${userId}, PlanID (from metadata): ${planIdFromMetadata}, SelectedCargoCompositeID: ${selectedCargoCompositeId}, SelectedEditalID: ${selectedEditalId}, SubscriptionID: ${subscriptionId}, StripeCustomerID (from session): ${stripeCustomerIdFromSession}`);

        if (!userId || !planIdFromMetadata) {
          console.error('[handleStripeWebhook] Webhook Error: Missing userId or planIdFromMetadata in checkout session metadata.', session.metadata);
          return new Response('Webhook Error: Missing critical metadata (userId or planIdFromMetadata).', { status: 400 });
        }

        if (planIdFromMetadata === 'plano_trial') {
            console.error(`[handleStripeWebhook] CRITICAL WARNING: Checkout session ${session.id} completed, but planId in metadata is 'plano_trial'. This indicates a potential issue in checkout session creation if a paid plan was expected. UserID: ${userId}.`);
            return new Response('Webhook Error: Invalid planId ("plano_trial") received for a completed checkout session. Configuration error likely.', { status: 400 });
        }

        if (!subscriptionId || typeof subscriptionId !== 'string') {
          console.error('[handleStripeWebhook] Webhook Error: Missing or invalid subscription ID in checkout session.', session);
          return new Response('Webhook Error: Missing or invalid subscription ID.', { status: 400 });
        }

        if (!stripeCustomerIdFromSession || typeof stripeCustomerIdFromSession !== 'string') {
          console.error('[handleStripeWebhook] Webhook Error: Missing or invalid customer ID in checkout session.', session);
          return new Response('Webhook Error: Missing or invalid customer ID.', { status: 400 });
        }
        
        console.log(`[handleStripeWebhook] All critical IDs seem present. Proceeding to retrieve subscription details.`);
        
        const userFirebaseRef = adminDb.ref(`users/${userId}`); // Use adminDb ref
        let currentUserDataBeforeUpdate: any = {};
        try {
            const userSnapshotBeforeUpdate = await userFirebaseRef.get(); // Use admin ref get
            if (userSnapshotBeforeUpdate.exists()) {
                currentUserDataBeforeUpdate = userSnapshotBeforeUpdate.val();
                console.log(`[handleStripeWebhook] User ${userId} data BEFORE plan update: activePlan: ${currentUserDataBeforeUpdate.activePlan}, planDetails: ${JSON.stringify(currentUserDataBeforeUpdate.planDetails)}, registeredCargoIds: ${JSON.stringify(currentUserDataBeforeUpdate.registeredCargoIds)}`);
            } else {
                console.warn(`[handleStripeWebhook] User ${userId} not found in DB before plan update. This is unexpected for an existing user completing checkout.`);
            }
        } catch (dbReadError: any) {
            console.error(`[handleStripeWebhook] Webhook Error: Failed to read user ${userId} data from DB before update:`, dbReadError);
            return new Response('Webhook Error: Database read error before update. Check server logs.', { status: 500 });
        }


        let subscriptionDetails: Stripe.Subscription;
        try {
          console.log(`[handleStripeWebhook] Retrieving Stripe subscription with ID: ${subscriptionId}`);
          subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
          console.log(`[handleStripeWebhook] Successfully retrieved subscription details for ${subscriptionId}. Current period end (UTC seconds): ${subscriptionDetails.current_period_end}`);
        } catch (subRetrieveError: any) {
          console.error(`[handleStripeWebhook] Error retrieving subscription ${subscriptionId} from Stripe:`, subRetrieveError);
          return new Response(`Webhook Error: Could not retrieve subscription details from Stripe. ${subRetrieveError.message}`, { status: 500 });
        }
        
        const currentPeriodEnd = subscriptionDetails.current_period_end;
        const expiryDateISO = formatISO(new Date(currentPeriodEnd * 1000));
        console.log(`[handleStripeWebhook] Subscription current_period_end (epoch): ${currentPeriodEnd}, converted to ISO: ${expiryDateISO}`);

        const now = new Date();
        const startDateISO = formatISO(now);
        
        const newHasHadFreeTrialValue = currentUserDataBeforeUpdate.hasHadFreeTrial || true;

        const planDetailsPayload = {
          planId: planIdFromMetadata, 
          startDate: startDateISO,
          expiryDate: expiryDateISO,
          ...(selectedCargoCompositeId && { selectedCargoCompositeId }), 
          ...(selectedEditalId && { selectedEditalId }), 
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: stripeCustomerIdFromSession,
        };
        console.log(`[handleStripeWebhook] Plan details payload to be saved to Firebase:`, planDetailsPayload);
        console.log(`[handleStripeWebhook] User ${userId} - Old activePlan: ${currentUserDataBeforeUpdate.activePlan}, New activePlan: ${planIdFromMetadata}, Old hasHadFreeTrial: ${currentUserDataBeforeUpdate.hasHadFreeTrial}, New hasHadFreeTrial: ${newHasHadFreeTrialValue}`);

        try {
          console.log(`[handleStripeWebhook] Attempting to update Firebase RTDB for user ${userId} at path users/${userId}`);
          const mainUpdatePayload: any = {
            activePlan: planIdFromMetadata,
            planDetails: planDetailsPayload,
            stripeCustomerId: stripeCustomerIdFromSession,
            hasHadFreeTrial: newHasHadFreeTrialValue,
          };
          
          await userFirebaseRef.update(mainUpdatePayload); // Use admin ref update
          console.log(`[handleStripeWebhook] Successfully updated main plan info for user ${userId} to ${planIdFromMetadata} in Firebase.`);

          if (planIdFromMetadata === 'plano_cargo' && selectedCargoCompositeId) {
            console.log(`[handleStripeWebhook] PLANO_CARGO: Attempting to auto-register user ${userId} for cargo ${selectedCargoCompositeId}`);
            try {
                const currentRegisteredCargoIds = currentUserDataBeforeUpdate.registeredCargoIds || [];
                const updatedRegisteredCargoIds = Array.from(new Set([...currentRegisteredCargoIds, selectedCargoCompositeId]));
                
                console.log(`[handleStripeWebhook] PLANO_CARGO: currentRegisteredCargoIds: ${JSON.stringify(currentRegisteredCargoIds)}, updatedRegisteredCargoIds: ${JSON.stringify(updatedRegisteredCargoIds)}`);
                
                await userFirebaseRef.update({ registeredCargoIds: updatedRegisteredCargoIds }); // Use admin ref update
                console.log(`[handleStripeWebhook] PLANO_CARGO: Successfully auto-registered user ${userId} for cargo ${selectedCargoCompositeId} in Firebase.`);
            } catch (autoRegError: any) {
                console.error(`[handleStripeWebhook] PLANO_CARGO: Error during auto-registration for cargo ${selectedCargoCompositeId} for user ${userId}:`, autoRegError);
                // Return 500 but note that main plan was likely set. This is a partial failure.
                return new Response(`Webhook Error: Failed during auto-registration for cargo. Main plan was set, but cargo registration failed. ${autoRegError.message}`, { status: 500 });
            }
          } else {
            if (planIdFromMetadata === 'plano_cargo') {
                 console.warn(`[handleStripeWebhook] PLANO_CARGO: 'planIdFromMetadata' is 'plano_cargo' but 'selectedCargoCompositeId' is missing or empty: '${selectedCargoCompositeId}'. Auto-registration SKIPPED.`);
            }
          }
        } catch (dbError: any) {
          console.error(`[handleStripeWebhook] Webhook Error: Failed to update user ${userId} in database:`, dbError);
          return new Response('Webhook Error: Database update failed. Check server logs.', { status: 500 });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[handleStripeWebhook] Event: customer.subscription.deleted. Subscription ID ${subscription.id}`);
        const stripeCustomerId = subscription.customer;
         if (typeof stripeCustomerId === 'string') {
           console.log(`[handleStripeWebhook] Finding user by Stripe Customer ID: ${stripeCustomerId}`);
           const usersRef = adminDb.ref('users'); // Use adminDb ref
           try {
               const usersSnapshot = await usersRef.get(); // Use admin ref get
               if (usersSnapshot.exists()) {
                  const usersData = usersSnapshot.val();
                  let userIdToUpdate: string | null = null;
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
                          console.log(`[handleStripeWebhook] Attempting to update Firebase for subscription deletion for user: ${userIdToUpdate}`);
                          await adminDb.ref(`users/${userIdToUpdate}`).update({ // Use adminDb ref
                              activePlan: null,
                              planDetails: null,
                          });
                          console.log(`[handleStripeWebhook] Successfully cancelled plan for user with Stripe Customer ID ${stripeCustomerId} (Firebase UID: ${userIdToUpdate})`);
                      } catch (dbUpdateError: any) {
                          console.error(`[handleStripeWebhook] Webhook Error: Failed to cancel subscription for user ${userIdToUpdate} in DB:`, dbUpdateError);
                          return new Response(`Webhook Error: Database update failed during subscription cancellation for user ${userIdToUpdate}. ${dbUpdateError.message}`, { status: 500 });
                      }
                  } else {
                       console.warn(`[handleStripeWebhook] Webhook Info: Received subscription.deleted for Stripe Customer ID ${stripeCustomerId}, but no matching user found in DB by stripeCustomerId field.`);
                  }
               } else {
                  console.warn(`[handleStripeWebhook] Webhook Info: No users found in DB to check for Stripe Customer ID ${stripeCustomerId}.`);
               }
           } catch (dbGetError: any) {
               console.error(`[handleStripeWebhook] Webhook Error: Failed to get users from DB for subscription.deleted event:`, dbGetError);
               return new Response('Webhook Error: Database read failed during subscription deletion.', { status: 500 });
           }
        } else {
            console.error('[handleStripeWebhook] Webhook Error: customer.subscription.deleted event without a valid customer ID.', subscription);
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
