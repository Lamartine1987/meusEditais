
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId, PlanDetails, PaymentRecord } from '@/types';
import { adminDb } from '@/lib/firebase-admin';
import { add, formatISO } from 'date-fns';
import type Stripe from 'stripe';
import { getEnvOrSecret } from '@/lib/secrets';

const planRank: Record<PlanId, number> = {
  plano_trial: 0,
  plano_cargo: 1,
  plano_edital: 2,
  plano_mensal: 3,
};

async function getPlanToPriceMap(): Promise<Record<PlanId, string>> {
  return {
    plano_cargo:  await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_CARGO'),
    plano_edital: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_EDITAL'),
    plano_mensal: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_MENSAL_RECORRENTE'),
    plano_trial:  ''
  };
}

async function mapPriceToPlan(priceId: string | null | undefined): Promise<PlanId | undefined> {
  if (!priceId) return undefined;
  const map = await getPlanToPriceMap();
  const entry = (Object.entries(map) as [PlanId, string][])
    .find(([, id]) => id === priceId);
  return entry?.[0];
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  if (typeof invoice.subscription === 'string') return invoice.subscription;
  if (invoice.subscription && typeof (invoice.subscription as any).id === 'string') return (invoice.subscription as any).id;
  
  const firstLine: any = invoice.lines?.data?.[0] ?? null;
  const fromLine = firstLine?.parent?.subscription_item_details?.subscription ?? null;
  const fromParent: any = (invoice as any).parent ?? null;
  const fromParentSub = fromParent?.subscription_details?.subscription ?? null;

  return fromLine || fromParentSub || null;
}

async function getUserIdFromInvoiceOrSubscription(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  subscription?: Stripe.Subscription | null
): Promise<string | undefined> {
  if (subscription?.metadata?.userId) return subscription.metadata.userId;
  const parent: any = (invoice as any).parent;
  if (parent?.subscription_details?.metadata?.userId) return parent.subscription_details.metadata.userId;
  const firstLine: any = invoice.lines?.data?.[0] ?? null;
  if (firstLine?.metadata?.userId) return firstLine.metadata.userId;

  if (typeof invoice.customer === 'string') {
    try {
      const customer = await stripe.customers.retrieve(invoice.customer);
      if (customer && !customer.deleted && (customer as Stripe.Customer).metadata?.firebaseUID) {
        return (customer as Stripe.Customer).metadata.firebaseUID;
      }
    } catch (e) {}
  }

  const subId = subscription?.id || getSubscriptionIdFromInvoice(invoice);
  if (subId) {
    try {
      const sessions = await stripe.checkout.sessions.list({ subscription: subId, limit: 1 });
      if (sessions.data.length > 0) return sessions.data[0].metadata?.userId;
    } catch (e) {}
  }

  return undefined;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === 'subscription') {
    try {
      const stripe = await getStripeClient();
      if (session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await handleSubscriptionCreatedOrUpdated(subscription, { userId: session.metadata?.userId, planId: session.metadata?.planId as PlanId }, session);
      }
    } catch (error) {
      console.error(`[handleCheckoutSessionCompleted] Erro:`, error);
    }
    return;
  }
    
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanId | undefined;

    if (!userId || !planId) return;

    const userFirebaseRef = adminDb.ref(`users/${userId}`);
    const userSnapshot = await userFirebaseRef.get();
    const currentUserData = userSnapshot.val() || {};
    
    const now = new Date();
    const expiryDate = add(now, { years: 1 });

    const newPlan: PlanDetails = {
      planId,
      startDate: formatISO(now),
      expiryDate: formatISO(expiryDate),
      stripeSubscriptionId: null,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      status: 'active',
      ...(session.metadata?.selectedCargoCompositeId && { selectedCargoCompositeId: session.metadata.selectedCargoCompositeId }),
      ...(session.metadata?.selectedEditalId && { selectedEditalId: session.metadata.selectedEditalId }),
    };

    const newPaymentRecord: PaymentRecord = {
        id: session.id,
        date: formatISO(now),
        amount: session.amount_total || 0,
        planId: planId,
        description: `Compra ${getPlanDisplayName(planId)}`,
    };

    const toArray = <T>(value: any): T[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value as T[];
      return Object.values(value) as T[];
    };

    let finalActivePlans = toArray<PlanDetails>(currentUserData.activePlans);
    let finalPlanHistory = toArray<PlanDetails>(currentUserData.planHistory);

    // --- LÓGICA DE LIMPEZA DE DUPLICIDADE ---
    const plansToArchive = finalActivePlans.filter(p => 
        p.planId === planId && 
        p.status !== 'active' && 
        p.stripePaymentIntentId !== newPlan.stripePaymentIntentId
    );

    if (plansToArchive.length > 0) {
        finalActivePlans = finalActivePlans.filter(p => !plansToArchive.includes(p));
        finalPlanHistory = [...plansToArchive.map(p => ({...p, status: 'canceled' as const})), ...finalPlanHistory];
    }

    finalActivePlans.push(newPlan);

    const highestPlan = [...finalActivePlans]
        .filter(p => p.status === 'active')
        .sort((a, b) => (planRank[b.planId as PlanId] ?? 0) - (planRank[a.planId as PlanId] ?? 0))[0] ?? null;
    
    const finalPaymentHistory = [newPaymentRecord, ...toArray<PaymentRecord>(currentUserData.paymentHistory)];

    const updatePayload: any = {
      activePlan: highestPlan?.planId ?? null,
      activePlans: finalActivePlans,
      planHistory: finalPlanHistory,
      paymentHistory: finalPaymentHistory,
      stripeCustomerId: newPlan.stripeCustomerId,
      hasHadFreeTrial: true,
    };
    
    if (planId === 'plano_cargo' && newPlan.selectedCargoCompositeId) {
      const currentRegistered = toArray<string>(currentUserData.registeredCargoIds);
      if (!currentRegistered.includes(newPlan.selectedCargoCompositeId)) {
        updatePayload.registeredCargoIds = [...currentRegistered, newPlan.selectedCargoCompositeId];
      }
    }

    await userFirebaseRef.update(updatePayload);
}

async function handleSubscriptionCreatedOrUpdated(
  subscription: Stripe.Subscription,
  fallback?: { userId?: string; planId?: PlanId },
  checkoutSession?: Stripe.Checkout.Session | null
) {
  try {
    const stripe = await getStripeClient();
    let userId = subscription.metadata?.userId || fallback?.userId;
    let planId = (subscription.metadata?.planId as PlanId | undefined) || fallback?.planId;

    if (!planId) {
      planId = (await mapPriceToPlan(subscription.items.data[0]?.price?.id)) as PlanId | undefined;
    }

    if (!userId) {
      if (!checkoutSession) {
        const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
        if (sessions.data.length > 0) checkoutSession = sessions.data[0];
      }
      userId = checkoutSession?.metadata?.userId;
    }

    if (!userId || !planId) return;

    const userFirebaseRef = adminDb.ref(`users/${userId}`);
    const userSnapshot = await userFirebaseRef.get();
    const currentUserData = userSnapshot.val() || {};

    const statusMap: Record<Stripe.Subscription.Status, PlanDetails['status']> = {
      active: 'active',
      trialing: 'active',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'unpaid',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete',
      paused: 'paused' as any,
    };

    let effectiveStatus: PlanDetails['status'] = statusMap[subscription.status] ?? 'active';
    if (subscription.cancel_at_period_end && subscription.status !== 'canceled') {
      effectiveStatus = 'canceled';
    }

    const planDetails: PlanDetails = {
      planId,
      startDate: formatISO(new Date(subscription.created * 1000)),
      expiryDate: formatISO(new Date(subscription.current_period_end * 1000)),
      stripeSubscriptionId: subscription.id,
      stripePaymentIntentId: null,
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as any).id,
      status: effectiveStatus,
    };

    const toArray = <T>(value: any): T[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value as T[];
      return Object.values(value) as T[];
    };

    let finalActivePlans = toArray<PlanDetails>(currentUserData.activePlans).filter(p => p.stripeSubscriptionId !== subscription.id);
    let finalPlanHistory = toArray<PlanDetails>(currentUserData.planHistory);

    // --- LÓGICA DE LIMPEZA DE DUPLICIDADE PARA ASSINATURAS ---
    if (effectiveStatus === 'active') {
        const replacedPlans = finalActivePlans.filter(p => 
            p.planId === planId && 
            p.status !== 'active' && 
            p.stripeSubscriptionId !== subscription.id
        );
        if (replacedPlans.length > 0) {
            finalActivePlans = finalActivePlans.filter(p => !replacedPlans.includes(p));
            finalPlanHistory = [...replacedPlans.map(p => ({...p, status: 'canceled' as const})), ...finalPlanHistory];
        }
    }

    const isTrulyInactive = ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status);

    if (isTrulyInactive) {
      finalPlanHistory.unshift(planDetails);
    } else {
      finalActivePlans.push(planDetails);
    }

    const highestPlan = [...finalActivePlans]
        .filter(p => p.status === 'active')
        .sort((a, b) => (planRank[b.planId as PlanId] ?? 0) - (planRank[a.planId as PlanId] ?? 0))[0] ?? null;

    const updatePayload: any = {
      activePlan: highestPlan?.planId ?? null,
      activePlans: finalActivePlans,
      planHistory: finalPlanHistory,
      stripeCustomerId: planDetails.stripeCustomerId,
      hasHadFreeTrial: true,
    };

    await userFirebaseRef.update(updatePayload);
  } catch (err: any) {
    console.error(`[handleSubscriptionUpdate] ERRO ao processar assinatura ${subscription.id}:`, err?.message);
    throw err;
  }
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  let event: Stripe.Event;
  try {
    const stripe = await getStripeClient();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = await getEnvOrSecret('STRIPE_WEBHOOK_SECRET_PROD');
    if (!signature || !webhookSecret) throw new Error("Configuração de webhook incompleta.");
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[handleStripeWebhook] ERRO na verificação: ${err.message}`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }
  
  try {
    const stripe = await getStripeClient();
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await handleSubscriptionCreatedOrUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        let subscriptionId: string | null = null;

        if (typeof invoice.subscription === 'string') {
          subscriptionId = invoice.subscription;
        } else if (
          invoice.subscription &&
          typeof (invoice.subscription as any).id === 'string'
        ) {
          subscriptionId = (invoice.subscription as any).id;
        } else {
          const firstLine: any = invoice.lines?.data?.[0] ?? null;
          const fromLine =
            firstLine?.parent?.subscription_item_details?.subscription ?? null;
          const fromParent: any = (invoice as any).parent ?? null;
          const fromParentSub =
            fromParent?.subscription_details?.subscription ?? null;
          subscriptionId = fromLine || fromParentSub || null;
        }

        let subscription: Stripe.Subscription | null = null;
        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        }

        let userId: string | undefined =
          (subscription?.metadata?.userId as string | undefined) ?? undefined;

        if (!userId) {
          const parent: any = (invoice as any).parent;
          userId = parent?.subscription_details?.metadata?.userId as string | undefined;
          if (!userId) {
            const firstLine: any = invoice.lines?.data?.[0] ?? null;
            userId = firstLine?.metadata?.userId as string | undefined;
          }
        }

        if (!userId && subscriptionId) {
          try {
            const sessions = await stripe.checkout.sessions.list({
              subscription: subscriptionId,
              limit: 1,
            });
            if (sessions.data.length > 0) {
              userId = sessions.data[0].metadata?.userId as string | undefined;
            }
          } catch (e: any) {}
        }

        if (!userId) break;

        let planId: PlanId =
          ((subscription?.metadata?.planId as PlanId | undefined) ??
            ((invoice as any).parent?.subscription_details?.metadata?.planId as
              PlanId | undefined) ??
            ((invoice.lines?.data?.[0] as any)?.metadata?.planId as
              PlanId | undefined) ??
            ((await mapPriceToPlan(
              invoice.lines.data[0]?.price?.id ||
                subscription?.items.data[0]?.price?.id ||
                null
            )) as PlanId | undefined) ??
            'plano_mensal') as PlanId;

        let description: string;
        if (invoice.billing_reason === 'subscription_create') {
          description = `Assinatura ${getPlanDisplayName(planId)}`;
        } else if (invoice.billing_reason === 'subscription_cycle') {
          description = `Renovação Assinatura ${getPlanDisplayName(planId)}`;
        } else {
          description = 'Pagamento de Fatura';
        }

        const newPaymentRecord: PaymentRecord = {
          id: invoice.id,
          date: formatISO(new Date(invoice.created * 1000)),
          amount: invoice.amount_paid,
          planId,
          description,
        };

        const userRef = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.val() || {};

        const toArray = <T>(value: any): T[] => {
          if (!value) return [];
          if (Array.isArray(value)) return value as T[];
          return Object.values(value) as T[];
        };

        const currentPaymentHistory = toArray<PaymentRecord>(userData.paymentHistory);
        if (!currentPaymentHistory.some((p) => p.id === newPaymentRecord.id)) {
          await userRef.update({ paymentHistory: [newPaymentRecord, ...currentPaymentHistory] });
        }

        if (subscription) {
          try {
            await handleSubscriptionCreatedOrUpdated(subscription);
          } catch (err: any) {}
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getSubscriptionIdFromInvoice(invoice);
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = await getUserIdFromInvoiceOrSubscription(stripe, invoice, subscription);
        await handleSubscriptionCreatedOrUpdated(subscription, { userId });
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
      console.error(`[handleStripeWebhook] ERRO CRÍTICO:`, err);
      return new Response(`Erro interno.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

function getPlanDisplayName(planId: any): string {
    switch(planId) {
        case 'plano_mensal': return 'Mensal';
        case 'plano_cargo': return 'Cargo';
        case 'plano_edital': return 'Edital';
        case 'plano_trial': return 'Trial';
        default: return 'Plano';
    }
}
