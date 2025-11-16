
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
    plano_trial:  '' // Não tem preço
  };
}

async function mapPriceToPlan(priceId: string | null | undefined): Promise<PlanId | undefined> {
  if (!priceId) return undefined;
  const map = await getPlanToPriceMap();
  const entry = (Object.entries(map) as [PlanId, string][])
    .find(([, id]) => id === priceId);
  return entry?.[0];
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === 'subscription') {
        if (session.subscription) {
            console.log(`[handleCheckoutSessionCompleted] Sessão de assinatura (ID: ${session.id}) detectada. Tentando processar antecipadamente...`);
            const stripe = await getStripeClient();
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
            try {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                await handleSubscriptionCreatedOrUpdated(subscription, {
                    userId: session.metadata?.userId,
                    planId: session.metadata?.planId as PlanId | undefined,
                });
            } catch (error) {
                console.error(`[handleCheckoutSessionCompleted] Erro ao processar assinatura antecipadamente para ${subscriptionId}:`, error);
            }
        } else {
             console.log(`[handleCheckoutSessionCompleted] Sessão de assinatura (ID: ${session.id}) para o usuário ${session.metadata?.userId}. Ignorando e aguardando evento 'customer.subscription.created'.`);
        }
        return;
    }
    
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanId | undefined;

    if (!userId || !planId) {
        console.error(`[handleCheckoutSessionCompleted] ERRO CRÍTICO: Metadados (userId ou planId) ausentes para pagamento único. Session ID: ${session.id}`, session.metadata);
        return;
    }

    console.log(`[handleCheckoutSessionCompleted] Processando pagamento único para o usuário ${userId}, plano ${planId}.`);

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
        id: session.id, // Checkout Session ID
        date: formatISO(now),
        amount: session.amount_total || 0,
        planId: planId,
        description: `Compra ${planId}`,
    };

    const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
    const finalActivePlans = [...currentActivePlans, newPlan];

    const highestPlan = [...finalActivePlans].sort((a, b) => {
        const rankA = planRank[a.planId as PlanId] ?? 0;
        const rankB = planRank[b.planId as PlanId] ?? 0;
        return rankB - rankA;
    })[0] ?? null;
    
    const currentPaymentHistory: PaymentRecord[] = currentUserData.paymentHistory || [];
    const finalPaymentHistory = [newPaymentRecord, ...currentPaymentHistory];

    const updatePayload: any = {
      activePlan: highestPlan?.planId,
      activePlans: finalActivePlans,
      paymentHistory: finalPaymentHistory, // Add to payload
      stripeCustomerId: newPlan.stripeCustomerId,
      hasHadFreeTrial: currentUserData.hasHadFreeTrial || true,
    };
    
    if (planId === 'plano_cargo' && newPlan.selectedCargoCompositeId) {
      const currentRegistered = currentUserData.registeredCargoIds || [];
      if (!currentRegistered.includes(newPlan.selectedCargoCompositeId)) {
        updatePayload.registeredCargoIds = [...currentRegistered, newPlan.selectedCargoCompositeId];
      }
    }

    console.log(`[handleCheckoutSessionCompleted] Payload final para ${userId}:`, JSON.stringify(updatePayload));
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleCheckoutSessionCompleted] SUCESSO: Usuário ${userId} atualizado com plano de pagamento único.`);
}

async function handleSubscriptionCreatedOrUpdated(
    subscription: Stripe.Subscription,
    fallback?: { userId?: string; planId?: PlanId }
) {
    let userId = subscription.metadata?.userId || fallback?.userId;
    let planId = (subscription.metadata?.planId as PlanId | undefined) || fallback?.planId;

    console.log(`[handleSubscriptionUpdate] Iniciando processamento para Sub ID: ${subscription.id}. Metadata inicial:`, { userId, planId });

    if (!planId) {
        const priceId = subscription.items?.data?.[0]?.price?.id;
        planId = await mapPriceToPlan(priceId);
    }

    if (!userId) {
        try {
            const stripe = await getStripeClient();
            const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
            userId = sessions.data[0]?.metadata?.userId;
        } catch (e: any) {
            console.error('[handleSubscriptionUpdate] Falha ao buscar sessão para recuperar metadados:', e.message);
        }
    }

    if (!userId || !planId) {
        console.error(`[handleSubscriptionUpdate] ERRO CRÍTICO: 'userId' ou 'planId' ausentes e não recuperáveis para a assinatura ${subscription.id}`);
        return;
    }

    console.log(`[handleSubscriptionUpdate] Processando assinatura ${subscription.id} para o usuário ${userId} com plano ${planId}.`);
    
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
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      status: effectiveStatus,
    };

    let finalActivePlans: PlanDetails[] = [...(currentUserData.activePlans || [])];
    let finalPlanHistory: PlanDetails[] = [...(currentUserData.planHistory || [])];

    const isTrulyInactive = ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status);

    finalActivePlans = finalActivePlans.filter(p => p.stripeSubscriptionId !== subscription.id);
    finalPlanHistory = finalPlanHistory.filter(p => p.stripeSubscriptionId !== subscription.id);

    if (isTrulyInactive) {
        finalPlanHistory.unshift(planDetails);
    } else {
        finalActivePlans.push(planDetails);
    }

    const highestPlan = [...finalActivePlans]
        .filter(p => p.status === 'active')
        .sort((a, b) => (planRank[b.planId] ?? 0) - (planRank[a.planId] ?? 0))[0] ?? null;

    const updatePayload: any = {
      activePlan: highestPlan?.planId ?? null,
      activePlans: finalActivePlans,
      planHistory: finalPlanHistory,
      stripeCustomerId: planDetails.stripeCustomerId,
      hasHadFreeTrial: true,
    };

    console.log(`[handleSubscriptionUpdate] Payload final para ${userId}:`, JSON.stringify(updatePayload));
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleSubscriptionUpdate] SUCESSO: Usuário ${userId} atualizado.`);
}


export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] Requisição de webhook recebida.');
  
  let event: Stripe.Event;
  try {
    const stripe = await getStripeClient();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = await getEnvOrSecret('STRIPE_WEBHOOK_SECRET_PROD');

    if (!signature) throw new Error("Cabeçalho stripe-signature ausente.");
    if (!webhookSecret) throw new Error("Segredo do webhook não configurado no servidor.");
    
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(`[handleStripeWebhook] Evento verificado e construído: ${event.type} (ID: ${event.id})`);

  } catch (err: any) {
    console.error(`[handleStripeWebhook] ERRO na verificação da assinatura do webhook: ${err.message}`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Assinatura ${subscription.id} ${event.type}. Novo status: ${subscription.status}`);
        await handleSubscriptionCreatedOrUpdated(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Assinatura ${subscription.id} foi deletada (deleted). Status: ${subscription.status}`);
        await handleSubscriptionCreatedOrUpdated(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (subscriptionId) {
            const stripe = await getStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            const userId = subscription.metadata.userId;
            const planId = await mapPriceToPlan(invoice.lines.data[0]?.price?.id) || 'plano_mensal';

            if (userId) {
                console.log(`[Webhook] Pagamento de fatura bem-sucedido para ${subscriptionId} do usuário ${userId}.`);

                const newPaymentRecord: PaymentRecord = {
                    id: invoice.id,
                    date: formatISO(new Date(invoice.created * 1000)),
                    amount: invoice.amount_paid,
                    planId: planId,
                    description: invoice.billing_reason === 'subscription_cycle' ? 'Renovação Mensal' : 'Início de Assinatura',
                };

                const userRef = adminDb.ref(`users/${userId}`);
                const userSnapshot = await userRef.get();
                const userData = userSnapshot.val() || {};
                const currentPaymentHistory: PaymentRecord[] = userData.paymentHistory || [];
                const finalPaymentHistory = [newPaymentRecord, ...currentPaymentHistory];
                
                // Update payment history AND plan validity period
                await userRef.update({ paymentHistory: finalPaymentHistory });
                await handleSubscriptionCreatedOrUpdated(subscription); 
            }
        }
        break;
      }


      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (subscriptionId) {
            console.warn(`[Webhook] Pagamento da fatura falhou para a assinatura ${subscriptionId}. Marcando plano como 'past_due'.`);
            const stripe = await getStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await handleSubscriptionCreatedOrUpdated(subscription);
        }
        break;
      }

      default:
        console.log(`[handleStripeWebhook] Evento não tratado: ${event.type}.`);
    }

  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] ERRO CRÍTICO ao processar o evento ${event.type}:`, processingError);
      return new Response(`Erro interno do servidor ao processar o evento.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
