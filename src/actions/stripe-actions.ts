
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId, PlanDetails } from '@/types';
import { adminDb } from '@/lib/firebase-admin';
import { formatISO } from 'date-fns';
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
                await handleSubscriptionCreated(subscription, {
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
    const newPlan: PlanDetails = {
      planId,
      startDate: formatISO(now),
      expiryDate: formatISO(new Date(new Date().setFullYear(now.getFullYear() + 1))),
      stripeSubscriptionId: null,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      status: 'active',
      ...(session.metadata?.selectedCargoCompositeId && { selectedCargoCompositeId: session.metadata.selectedCargoCompositeId }),
      ...(session.metadata?.selectedEditalId && { selectedEditalId: session.metadata.selectedEditalId }),
    };

    const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
    const finalActivePlans = [...currentActivePlans, newPlan];

    const highestPlan = [...finalActivePlans].sort((a, b) => planRank[b.planId] - planRank[a.planId])[0] ?? null;

    const updatePayload: any = {
      activePlan: highestPlan.planId,
      activePlans: finalActivePlans,
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

async function handleSubscriptionCreated(
    subscription: Stripe.Subscription,
    fallback?: { userId?: string; planId?: PlanId }
) {
    let userId = subscription.metadata?.userId || fallback?.userId;
    let planId = (subscription.metadata?.planId as PlanId | undefined) || fallback?.planId;

    console.log(`[handleSubscriptionCreated] Iniciando processamento para Sub ID: ${subscription.id}. Metadata inicial:`, { userId, planId });

    if (!planId) {
        const priceId = subscription.items?.data?.[0]?.price?.id;
        console.log(`[handleSubscriptionCreated] planId ausente. Tentando inferir a partir do Price ID: ${priceId}`);
        planId = await mapPriceToPlan(priceId);
        if (planId) console.log(`[handleSubscriptionCreated] planId inferido com sucesso: ${planId}`);
    }

    if (!userId) {
        console.warn(`[handleSubscriptionCreated] userId ainda ausente. Tentando buscar sessão de checkout...`);
        try {
            const stripe = await getStripeClient();
            const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
            const session = sessions.data[0];
            if (session) {
                console.log(`[handleSubscriptionCreated] Sessão de checkout encontrada (ID: ${session.id}). Recuperando metadados...`);
                userId = userId || (session.metadata?.userId as string | undefined);
                if(userId) console.log(`[handleSubscriptionCreated] userId recuperado da sessão: ${userId}`);
            }
        } catch (e: any) {
            console.error('[handleSubscriptionCreated] Falha crítica ao buscar sessão para recuperar metadados:', e.message);
        }
    }

    if (!userId) {
        console.error(`[handleSubscriptionCreated] ERRO CRÍTICO: 'userId' ausente e não recuperável para a assinatura ${subscription.id}`);
        return;
    }
    if (!planId) {
        console.error(`[handleSubscriptionCreated] ERRO CRÍTICO: 'planId' ausente e não recuperável para a assinatura ${subscription.id}`);
        return;
    }

    console.log(`[handleSubscriptionCreated] Processando assinatura ${subscription.id} para o usuário ${userId} com plano ${planId}.`);
    
    let paymentIntentId: string | null = null;
    if (subscription.latest_invoice) {
        const stripe = await getStripeClient();
        const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice.id;
        try {
            const invoice = await stripe.invoices.retrieve(invoiceId);
            paymentIntentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null;
            console.log(`[handleSubscriptionCreated] Payment Intent ID recuperado da fatura ${invoiceId}: ${paymentIntentId}`);
        } catch (invoiceError: any) {
            console.error(`[handleSubscriptionCreated] Erro ao buscar Payment Intent da fatura ${invoiceId}:`, invoiceError.message);
        }
    } else {
        console.warn(`[handleSubscriptionCreated] AVISO: A assinatura ${subscription.id} não possui 'latest_invoice'. O Payment Intent ID não será salvo.`);
    }

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
        paused: 'paused' as any, // Se você usar pause_collection
    };

    const newPlan: PlanDetails = {
      planId,
      startDate: formatISO(new Date(subscription.current_period_start * 1000)),
      expiryDate: formatISO(new Date(subscription.current_period_end * 1000)),
      stripeSubscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      status: statusMap[subscription.status] ?? 'active',
    };
    
    const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
    const otherPlans = currentActivePlans.filter(p => p.stripeSubscriptionId !== subscription.id);
    const finalActivePlans = [...otherPlans, newPlan];

    const highestPlan = [...finalActivePlans].sort((a, b) => {
        const rankA = planRank[a.planId as PlanId] ?? 0;
        const rankB = planRank[b.planId as PlanId] ?? 0;
        return rankB - rankA;
    })[0] ?? null;

    const updatePayload: any = {
      activePlan: highestPlan.planId,
      activePlans: finalActivePlans,
      stripeCustomerId: newPlan.stripeCustomerId,
      hasHadFreeTrial: true,
    };

    console.log(`[handleSubscriptionCreated] Payload final para ${userId}:`, JSON.stringify(updatePayload));
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleSubscriptionCreated] SUCESSO: Usuário ${userId} atualizado com plano de assinatura.`);
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

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Assinatura ${subscription.id} foi criada. Status: ${subscription.status}`);
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Assinatura ${subscription.id} foi atualizada. Novo status: ${subscription.status}`);
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_update') {
            const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
            if (subscriptionId) {
              console.log(`[Webhook] Fatura de renovação/criação paga para assinatura ${subscriptionId}. Atualizando período do plano.`);
              const stripe = await getStripeClient();
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              await handleSubscriptionCreated(subscription);
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
            await handleSubscriptionCreated(subscription);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        if (userId) {
            console.log(`[Webhook] Assinatura ${subscription.id} do usuário ${userId} foi cancelada/expirada. Removendo plano ativo.`);
            const userRef = adminDb.ref(`users/${userId}`);
            const userSnapshot = await userRef.get();
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const updatedActivePlans = (userData.activePlans || []).filter((p: PlanDetails) => p.stripeSubscriptionId !== subscription.id);
                
                const highestPlan = [...updatedActivePlans].sort((a, b) => {
                    const rankA = planRank[a.planId as PlanId] ?? 0;
                    const rankB = planRank[b.planId as PlanId] ?? 0;
                    return rankB - rankA;
                })[0] ?? null;

                const newActivePlanId = highestPlan ? highestPlan.planId : null;
                
                await userRef.update({
                    activePlans: updatedActivePlans,
                    activePlan: newActivePlanId,
                });
            }
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
