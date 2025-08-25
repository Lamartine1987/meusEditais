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
  plano_anual: 3,
};


export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] Requisição de webhook recebida.');
  const stripe = await getStripeClient();
  const signature = headers().get('stripe-signature');
  
  const webhookSecret = await getEnvOrSecret('STRIPE_WEBHOOK_SECRET_PROD');
  console.log(`[handleStripeWebhook] Assinatura: ${signature ? 'presente' : 'AUSENTE'}. Segredo do Webhook: ${webhookSecret ? 'presente' : 'AUSENTE'}`);
  
  if (!signature) {
    return new Response("Erro: Cabeçalho stripe-signature ausente", { status: 400 });
  }
  if (!webhookSecret) {
    return new Response("Erro: Segredo do webhook não configurado no servidor.", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[handleStripeWebhook] Falha na verificação da assinatura: ${err.message}`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }
  
  console.log(`[handleStripeWebhook] Evento processado: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[handleStripeWebhook] checkout.session.completed. Metadados: ${JSON.stringify(session.metadata)}`);
        
        const userId = session.metadata?.userId;
        const planIdFromMetadata = session.metadata?.planId as PlanId | undefined;
        const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
        const selectedEditalId = session.metadata?.selectedEditalId; 
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        const stripeCustomerIdFromSession = session.customer as string;

        if (!userId || !planIdFromMetadata) {
          console.error('[handleStripeWebhook] Erro: Metadados críticos ausentes.', session.metadata);
          return new Response('Erro: Metadados críticos ausentes.', { status: 400 });
        }
        
        const userFirebaseRef = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userFirebaseRef.get();
        const currentUserData = userSnapshot.val() || {};
        
        const now = new Date();
        const startDateISO = formatISO(now);
        const expiryDateISO = formatISO(new Date(new Date().setFullYear(now.getFullYear() + 1)));
        
        const newPlan: PlanDetails = {
          planId: planIdFromMetadata,
          startDate: startDateISO,
          expiryDate: expiryDateISO,
          ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
          ...(selectedEditalId && { selectedEditalId }),
          stripeSubscriptionId: null,
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: stripeCustomerIdFromSession,
          status: 'active',
        };
        
        const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
        let finalActivePlans: PlanDetails[] = [];
        let newPlanHistory = currentUserData.planHistory || [];

        if (newPlan.planId === 'plano_anual') {
            finalActivePlans = [newPlan];
            newPlanHistory = [...newPlanHistory, ...currentActivePlans];
        } else {
            finalActivePlans = [...currentActivePlans, newPlan];
        }
        
        const highestPlan = finalActivePlans.reduce((max, plan) => {
          return planRank[plan.planId] > planRank[max.planId] ? plan : max;
        }, { planId: 'plano_trial' } as PlanDetails);

        const updatePayload: any = {
          activePlan: highestPlan.planId,
          activePlans: finalActivePlans,
          stripeCustomerId: stripeCustomerIdFromSession,
          hasHadFreeTrial: currentUserData.hasHadFreeTrial || true,
          planHistory: newPlanHistory,
        };
        
        if (planIdFromMetadata === 'plano_cargo' && selectedCargoCompositeId) {
            const currentRegistered = currentUserData.registeredCargoIds || [];
            if (!currentRegistered.includes(selectedCargoCompositeId)) {
                updatePayload.registeredCargoIds = [...currentRegistered, selectedCargoCompositeId];
            }
        }

        await userFirebaseRef.update(updatePayload);
        console.log(`[handleStripeWebhook] Dados do usuário ${userId} atualizados com sucesso.`);
        
        break;
      }
      default:
        console.log(`[handleStripeWebhook] Evento não tratado: ${event.type}.`);
    }
  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] Erro ao processar o evento ${event.type}:`, processingError);
      return new Response(`Erro interno ao processar evento.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
