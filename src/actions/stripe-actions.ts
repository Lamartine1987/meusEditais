
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
        
        // Se for uma assinatura, o evento 'customer.subscription.created' cuidará da lógica.
        if (session.mode === 'subscription') {
            console.log(`[handleStripeWebhook] Sessão de assinatura detectada. Ignorando 'checkout.session.completed' e aguardando 'customer.subscription.created'.`);
            break;
        }

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
        // Os planos de pagamento único agora duram 365 dias (1 ano)
        const expiryDateISO = formatISO(new Date(new Date().setDate(now.getDate() + 365)));
        
        const newPlan: PlanDetails = {
          planId: planIdFromMetadata,
          startDate: startDateISO,
          expiryDate: expiryDateISO,
          ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
          ...(selectedEditalId && { selectedEditalId }),
          stripeSubscriptionId: null,
          stripePaymentIntentId: paymentIntentId, // GARANTE que o ID do pagamento seja salvo
          stripeCustomerId: stripeCustomerIdFromSession,
          status: 'active',
        };
        console.log('[handleStripeWebhook] Novo objeto de plano criado:', newPlan);
        
        const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
        let finalActivePlans: PlanDetails[] = [...currentActivePlans, newPlan];
        
        const highestPlan = finalActivePlans.reduce((max, plan) => {
          return planRank[plan.planId] > planRank[max.planId] ? plan : max;
        }, { planId: 'plano_trial' } as PlanDetails);
        console.log(`[handleStripeWebhook] Plano mais alto calculado: ${highestPlan.planId}`);

        const updatePayload: any = {
          activePlan: highestPlan.planId,
          activePlans: finalActivePlans,
          stripeCustomerId: stripeCustomerIdFromSession,
          hasHadFreeTrial: currentUserData.hasHadFreeTrial || true,
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
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[handleStripeWebhook] Evento 'customer.subscription.created'. Assinatura ID: ${subscription.id}`);
        
        const stripe = await getStripeClient();
        
        // A metadata relevante está no item da assinatura
        const priceId = subscription.items.data[0]?.price.id;
        const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
        const product = price.product as Stripe.Product;
        
        const planId = product.metadata.planId as PlanId;
        const userId = subscription.metadata.userId;
        const stripeCustomerId = subscription.customer as string;

        if (!userId || !planId) {
            console.error('[handleStripeWebhook] ERRO CRÍTICO: Metadados (userId, planId) ausentes na assinatura.', { subscription: subscription.id, product: product.id });
            return new Response('Erro: Metadados críticos ausentes na assinatura.', { status: 400 });
        }

        // --- CORREÇÃO: Buscar o Payment Intent da primeira fatura ---
        let paymentIntentId: string | null = null;
        if (subscription.latest_invoice) {
          try {
            const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice.id;
            const invoice = await stripe.invoices.retrieve(invoiceId);
            paymentIntentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null;
             console.log(`[handleStripeWebhook] Payment Intent ID da fatura recuperado: ${paymentIntentId}`);
          } catch(invoiceError) {
             console.error('[handleStripeWebhook] Erro ao buscar o Payment Intent da fatura:', invoiceError);
          }
        }
        // --- FIM DA CORREÇÃO ---

        const userFirebaseRef = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userFirebaseRef.get();
        const currentUserData = userSnapshot.val() || {};

        const startDate = new Date(subscription.created * 1000);
        const expiryDate = new Date(subscription.current_period_end * 1000);

        const newPlan: PlanDetails = {
          planId: planId,
          startDate: formatISO(startDate),
          expiryDate: formatISO(expiryDate),
          stripeSubscriptionId: subscription.id,
          stripePaymentIntentId: paymentIntentId, // Salva o ID do pagamento
          stripeCustomerId: stripeCustomerId,
          status: 'active',
        };

        const currentActivePlans: PlanDetails[] = currentUserData.activePlans || [];
        // Lógica de Upgrade: Se o novo plano é o mensal, ele substitui os outros
        let finalActivePlans: PlanDetails[];
        if (planId === 'plano_mensal') {
            const plansToKeepInHistory = currentActivePlans.filter(p => p.planId !== 'plano_trial');
            const newHistory = [...(currentUserData.planHistory || []), ...plansToKeepInHistory];
            finalActivePlans = [newPlan]; // Apenas o novo plano mensal fica ativo
             await userFirebaseRef.update({ planHistory: newHistory }); // Atualiza o histórico primeiro
        } else {
            finalActivePlans = [...currentActivePlans, newPlan];
        }

        const highestPlan = finalActivePlans.reduce((max, plan) => {
          return planRank[plan.planId] > planRank[max.planId] ? plan : max;
        }, { planId: 'plano_trial' } as PlanDetails);


        const updatePayload: any = {
          activePlan: highestPlan.planId,
          activePlans: finalActivePlans,
          stripeCustomerId: stripeCustomerId,
          hasHadFreeTrial: true,
        };

        console.log('[handleStripeWebhook] Payload de assinatura para atualização no DB:', updatePayload);
        await userFirebaseRef.update(updatePayload);
        console.log(`[handleStripeWebhook] SUCESSO: Assinatura para o usuário ${userId} atualizada no Firebase.`);

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
