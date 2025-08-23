
'use server';

import { getStripeClient } from '@/lib/stripe';
import type { PlanId, PlanDetails } from '@/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin'; // Use Admin DB
import { formatISO } from 'date-fns';
import type Stripe from 'stripe';
import { appConfig } from '@/lib/config';

// Mapeia os IDs de plano da aplicação para os Price IDs do Stripe lidos da configuração.
// A função getStripeClient() garante que os segredos, incluindo os Price IDs, sejam carregados.
const getPlanToPriceMap = (): Record<PlanId, string | undefined> => ({
  plano_cargo: appConfig.PRICE_ID_PLANO_CARGO,
  plano_edital: appConfig.PRICE_ID_PLANO_EDITAL,
  plano_anual: appConfig.PRICE_ID_PLANO_ANUAL,
  plano_trial: undefined, // Trial não tem preço Stripe
});

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
  console.log(`[StripeAction] INICIANDO createCheckoutSession. PlanID: ${planId}, UserID: ${userId}`);
  
  if (!userId) {
    const errorMsg = 'User ID é obrigatório para criar uma sessão de checkout.';
    console.error(`[StripeAction] ERRO: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  const stripe = getStripeClient(); // Esta chamada agora carrega os segredos
  const planToPriceMap = getPlanToPriceMap(); // Obtém o mapa de preços atualizado

  const priceId = planToPriceMap[planId];
  console.log(`[StripeAction] Mapeamento de PlanID '${planId}' para PriceID: '${priceId || 'undefined'}'`);

  if (!priceId || priceId.trim() === '' || FALLBACK_PRICE_IDS.includes(priceId)) {
    const errorMessage = `Erro de configuração: O Price ID do Stripe para o plano '${planId}' é inválido ou não foi carregado. Verifique o segredo 'STRIPE_SECRETS' e os logs do servidor.`;
    console.error(`[StripeAction] ${errorMessage}`);
    throw new Error(errorMessage);
  }
  
  const origin = headers().get('origin') || 'https://fallback-url.com';
  const successUrl = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/checkout/cancel`;
  console.log(`[StripeAction] URLs de redirecionamento: Success=${successUrl}, Cancel=${cancelUrl}`);

  let stripeCustomerId: string | undefined;
  const userRefDb = adminDb.ref(`users/${userId}`);
  
  try {
    const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      console.log(`[StripeAction] Cliente Stripe existente encontrado: ${stripeCustomerId}`);
    } else {
      console.log(`[StripeAction] Criando novo cliente Stripe para email: ${userEmail}`);
      const customer = await stripe.customers.create({ email: userEmail, metadata: { firebaseUID: userId } });
      stripeCustomerId = customer.id;
      console.log(`[StripeAction] Novo cliente Stripe criado: ${stripeCustomerId}`);
    }
    await userRefDb.update({ stripeCustomerId });
  } catch (error: any) {
    console.error('[StripeAction] Erro ao obter/criar cliente Stripe:', error);
    throw new Error(`Não foi possível estabelecer o ID do cliente Stripe: ${error.message}`);
  }

  if (!stripeCustomerId) {
    throw new Error('[StripeAction] O ID do cliente Stripe não pôde ser estabelecido.');
  }

  const metadata = {
    userId,
    planId,
    ...(specificDetails?.selectedCargoCompositeId && { selectedCargoCompositeId: specificDetails.selectedCargoCompositeId }),
    ...(specificDetails?.selectedEditalId && { selectedEditalId: specificDetails.selectedEditalId }),
  };
  
  console.log('[StripeAction] Metadados para a sessão do Stripe:', metadata);

  try {
    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
    };

    console.log('[StripeAction] Payload de criação da sessão:', JSON.stringify(sessionPayload, null, 2));
    const session = await stripe.checkout.sessions.create(sessionPayload);
    
    console.log(`[StripeAction] Sessão de checkout criada com sucesso. ID: ${session.id}`);

    if (session.url) {
      redirect(session.url);
    } else {
      throw new Error('A URL da sessão de checkout do Stripe está faltando.');
    }
  } catch (error: any) {
    console.error('[StripeAction] Falha na criação da sessão de checkout do Stripe:', error);
    throw new Error(`Erro ao criar sessão de checkout no Stripe: ${error.message}`);
  }
}

// O restante do arquivo (handleStripeWebhook) permanece o mesmo
export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] Requisição de webhook de PRODUÇÃO recebida.');
  const stripe = getStripeClient();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');
  console.log(`[handleStripeWebhook] Assinatura Stripe do cabeçalho: ${signature ? 'presente' : 'AUSENTE (ISSO É UM PROBLEMA!)'}`);

  // A função getStripeClient já garante que o segredo foi carregado
  const webhookSecret = appConfig.WEBHOOK_SECRET_PROD;
  console.log(`[handleStripeWebhook] appConfig.WEBHOOK_SECRET_PROD: ${webhookSecret ? "****** (presente)" : "STRING VAZIA OU NULA (ISSO É UM PROBLEMA CRÍTICO!)"}`);

  if (!signature) {
    const msg = "Erro de Webhook: Cabeçalho stripe-signature ausente";
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response(msg, { status: 400 });
  }
  if (!webhookSecret || webhookSecret.trim() === '') {
    const msg = `CRÍTICO: WEBHOOK_SECRET_PROD não está definido ou está vazio. Isso indica um problema de configuração do lado do servidor.`;
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response('Erro de Webhook: Segredo do webhook não configurado ou está vazio.', { status: 500 });
  }

  let event: Stripe.Event;
  let rawBody: string = '';
  try {
    rawBody = await req.text(); // Lê o corpo uma vez
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(`[handleStripeWebhook] Evento Stripe construído. Tipo: ${event.type}, ID: ${event.id}`);
  } catch (err: any) {
    console.error(`[handleStripeWebhook] Falha na verificação da assinatura do webhook: ${err.message}.`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }
  
  console.log(`[handleStripeWebhook] Processando evento: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[handleStripeWebhook] Evento: checkout.session.completed. ID da Sessão: ${session.id}. Metadados: ${JSON.stringify(session.metadata)}`);
        
        const userId = session.metadata?.userId;
        const planIdFromMetadata = session.metadata?.planId as PlanId | undefined;
        const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
        const selectedEditalId = session.metadata?.selectedEditalId; 
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        const stripeCustomerIdFromSession = session.customer;

        if (!userId || !planIdFromMetadata) {
          console.error('[handleStripeWebhook] Erro: userId ou planId ausentes nos metadados.', session.metadata);
          return new Response('Erro de Webhook: Metadados críticos ausentes.', { status: 400 });
        }
        
        if (!stripeCustomerIdFromSession || typeof stripeCustomerIdFromSession !== 'string') {
          console.error('[handleStripeWebhook] Erro: ID do cliente ausente na sessão.', session);
          return new Response('Erro de Webhook: ID do cliente ausente.', { status: 400 });
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
      
      // ... outros casos de webhook ...

      default:
        console.log(`[handleStripeWebhook] Evento não tratado: ${event.type}.`);
    }
  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] Erro ao processar o evento ${event.type}:`, processingError);
      return new Response(`Erro interno ao processar evento ${event.type}.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
