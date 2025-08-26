
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
    console.error("[handleStripeWebhook] Erro CRÍTICO: Cabeçalho stripe-signature ausente.");
    return new Response("Erro: Cabeçalho stripe-signature ausente", { status: 400 });
  }
  if (!webhookSecret) {
    console.error("[handleStripeWebhook] Erro CRÍTICO: Segredo do webhook não configurado no servidor.");
    return new Response("Erro: Segredo do webhook não configurado no servidor.", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    console.log('[handleStripeWebhook] Construindo evento do webhook...');
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('[handleStripeWebhook] Evento construído com sucesso.');
  } catch (err: any) {
    console.error(`[handleStripeWebhook] Falha na verificação da assinatura do webhook: ${err.message}`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }
  
  console.log(`[handleStripeWebhook] Evento processado com sucesso: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[handleStripeWebhook] Evento 'checkout.session.completed'. Metadados: ${JSON.stringify(session.metadata)}`);
        
        const userId = session.metadata?.userId;
        const planIdFromMetadata = session.metadata?.planId as PlanId | undefined;
        const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
        const selectedEditalId = session.metadata?.selectedEditalId; 
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        const stripeCustomerIdFromSession = session.customer as string;

        if (!userId || !planIdFromMetadata) {
          console.error('[handleStripeWebhook] ERRO CRÍTICO: Metadados essenciais (userId, planId) ausentes na sessão de checkout.', session.metadata);
          return new Response('Erro: Metadados críticos ausentes.', { status: 400 });
        }
        
        console.log(`[handleStripeWebhook] Atualizando dados para o usuário: ${userId}`);
        const userFirebaseRef = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userFirebaseRef.get();
        const currentUserData = userSnapshot.val() || {};
        console.log(`[handleStripeWebhook] Dados atuais do usuário carregados.`);
        
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
        console.log('[handleStripeWebhook] Novo objeto de plano criado:', newPlan);
        
        const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
        let finalActivePlans: PlanDetails[] = [];
        let newPlanHistory = currentUserData.planHistory || [];

        if (newPlan.planId === 'plano_anual') {
            console.log('[handleStripeWebhook] Plano Anual detectado. Substituindo planos existentes.');
            finalActivePlans = [newPlan];
            newPlanHistory = [...newPlanHistory, ...currentActivePlans];
        } else {
            console.log('[handleStripeWebhook] Plano Cargo/Edital detectado. Adicionando ao array de planos.');
            finalActivePlans = [...currentActivePlans, newPlan];
        }
        
        const highestPlan = finalActivePlans.reduce((max, plan) => {
          return planRank[plan.planId] > planRank[max.planId] ? plan : max;
        }, { planId: 'plano_trial' } as PlanDetails);
        console.log(`[handleStripeWebhook] Plano mais alto calculado: ${highestPlan.planId}`);

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
                console.log(`[handleStripeWebhook] Registrando novo cargo para o usuário: ${selectedCargoCompositeId}`);
                updatePayload.registeredCargoIds = [...currentRegistered, selectedCargoCompositeId];
            }
        }

        console.log('[handleStripeWebhook] Payload final para atualização no DB:', updatePayload);
        await userFirebaseRef.update(updatePayload);
        console.log(`[handleStripeWebhook] SUCESSO: Dados do usuário ${userId} atualizados no Firebase.`);
        
        break;
      }
      default:
        console.log(`[handleStripeWebhook] Evento não tratado recebido: ${event.type}. Ignorando.`);
    }
  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] ERRO CRÍTICO ao processar o evento ${event.type}:`, processingError);
      return new Response(`Erro interno do servidor ao processar o evento.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
