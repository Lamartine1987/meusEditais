
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId, PlanDetails } from '@/types';
import { headers } from 'next/headers';
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


async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanId | undefined;
    
    if (!userId || !planId) {
        console.error(`[handleCheckoutSessionCompleted] ERRO CRÍTICO: Metadados (userId ou planId) ausentes. Session ID: ${session.id}`, session.metadata);
        return;
    }

    // Ignorar sessões de assinatura aqui; elas serão tratadas por 'customer.subscription.created'
    if (session.mode === 'subscription') {
        console.log(`[handleCheckoutSessionCompleted] Sessão de assinatura (ID: ${session.id}) para o usuário ${userId}. Ignorando e aguardando evento de assinatura.`);
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
      expiryDate: formatISO(new Date(new Date().setDate(now.getDate() + 365))), // 1 ano de validade
      stripeSubscriptionId: null,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      status: 'active',
      ...(session.metadata?.selectedCargoCompositeId && { selectedCargoCompositeId: session.metadata.selectedCargoCompositeId }),
      ...(session.metadata?.selectedEditalId && { selectedEditalId: session.metadata.selectedEditalId }),
    };

    const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
    const finalActivePlans = [...currentActivePlans, newPlan];

    const highestPlan = finalActivePlans.reduce((max, p) => (planRank[p.planId] > planRank[max.planId] ? p : max), { planId: 'plano_trial' } as PlanDetails);

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

    console.log(`[handleCheckoutSessionCompleted] Payload final para ${userId}:`, updatePayload);
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleCheckoutSessionCompleted] SUCESSO: Usuário ${userId} atualizado com plano de pagamento único.`);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

    if (!userId) {
        console.error(`[handleSubscriptionCreated] ERRO CRÍTICO: 'userId' ausente nos metadados da assinatura ${subscription.id}`);
        return;
    }

    console.log(`[handleSubscriptionCreated] Processando assinatura ${subscription.id} para o usuário ${userId}.`);

    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
        console.error(`[handleSubscriptionCreated] ERRO CRÍTICO: Price ID não encontrado para a assinatura ${subscription.id}.`);
        return;
    }

    const stripe = await getStripeClient();
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product as Stripe.Product;
    const planId = product.metadata.planId as PlanId | undefined;

    if (!planId) {
        console.error(`[handleSubscriptionCreated] ERRO CRÍTICO: 'planId' ausente nos metadados do produto ${product.id}.`);
        return;
    }
    
    let paymentIntentId: string | null = null;
    if (subscription.latest_invoice) {
        const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice.id;
        try {
            const invoice = await stripe.invoices.retrieve(invoiceId);
            paymentIntentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null;
            console.log(`[handleSubscriptionCreated] Payment Intent ID recuperado da fatura ${invoiceId}: ${paymentIntentId}`);
        } catch (invoiceError) {
            console.error(`[handleSubscriptionCreated] Erro ao buscar Payment Intent da fatura ${invoiceId}:`, invoiceError);
        }
    } else {
        console.warn(`[handleSubscriptionCreated] AVISO: A assinatura ${subscription.id} não possui 'latest_invoice'. O Payment Intent ID não será salvo.`);
    }

    const userFirebaseRef = adminDb.ref(`users/${userId}`);
    const userSnapshot = await userFirebaseRef.get();
    const currentUserData = userSnapshot.val() || {};

    const newPlan: PlanDetails = {
      planId,
      startDate: formatISO(new Date(subscription.current_period_start * 1000)),
      expiryDate: formatISO(new Date(subscription.current_period_end * 1000)),
      stripeSubscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: customerId,
      status: 'active',
    };
    
    const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
    const finalActivePlans = [...currentActivePlans, newPlan];

    const highestPlan = finalActivePlans.reduce((max, p) => (planRank[p.planId] > planRank[max.planId] ? p : max), { planId: 'plano_trial' } as PlanDetails);

    const updatePayload: any = {
      activePlan: highestPlan.planId,
      activePlans: finalActivePlans,
      stripeCustomerId: customerId,
      hasHadFreeTrial: true, // Assinaturas contam como tendo usado o trial
    };

    console.log(`[handleSubscriptionCreated] Payload final para ${userId}:`, updatePayload);
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleSubscriptionCreated] SUCESSO: Usuário ${userId} atualizado com plano de assinatura.`);
}


export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] Requisição de webhook recebida.');
  
  let event: Stripe.Event;
  try {
    const stripe = await getStripeClient();
    const signature = headers().get('stripe-signature');
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
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      // Adicione outros eventos aqui conforme necessário (ex: customer.subscription.updated, invoice.payment_failed)
      default:
        console.log(`[handleStripeWebhook] Evento não tratado recebido: ${event.type}. Ignorando.`);
    }
  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] ERRO CRÍTICO ao processar o evento ${event.type}:`, processingError);
      return new Response(`Erro interno do servidor ao processar o evento.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

