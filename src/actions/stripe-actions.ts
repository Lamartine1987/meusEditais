
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
const planToPriceMap: Record<PlanId, string | undefined> = {
  plano_cargo: appConfig.PRICE_ID_PLANO_CARGO,
  plano_edital: appConfig.PRICE_ID_PLANO_EDITAL,
  plano_anual: appConfig.PRICE_ID_PLANO_ANUAL,
  plano_trial: undefined, // Trial não tem preço Stripe
};

const planRank: Record<PlanId, number> = {
  plano_trial: 0,
  plano_cargo: 1,
  plano_edital: 2,
  plano_anual: 3,
};

// IDs de fallback para identificar problemas de configuração.
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
  console.log(`[createCheckoutSession] Chamado para PRODUÇÃO. PlanID: ${planId}, UserID: ${userId}, UserEmail: ${userEmail}, SpecificDetails: ${JSON.stringify(specificDetails)}`);
  
  if (!userId) {
    const errorMsg = '[createCheckoutSession] Erro: User ID é obrigatório.';
    console.error(errorMsg);
    throw new Error('User ID é obrigatório para criar uma sessão de checkout.');
  }
  const stripe = getStripeClient();

  const priceId = planToPriceMap[planId];
  console.log(`[createCheckoutSession] PlanID: '${planId}' mapeia para PriceID: '${priceId || 'undefined'}'`);

  if (!priceId || priceId.trim() === '' || FALLBACK_PRICE_IDS.includes(priceId)) {
    const errorMessage = `Erro de configuração: O Price ID do Stripe para o plano '${planId}' está faltando, vazio ou é um fallback. Por favor, verifique se o segredo 'STRIPE_SECRETS' no Google Secret Manager contém um Price ID válido e não vazio, e se está corretamente ligado ao seu backend do App Hosting.`;
    console.error(`[createCheckoutSession] ${errorMessage}`);
    throw new Error(`Erro de configuração: O Price ID do Stripe para o plano '${planId}' é inválido ou não está configurado. Verifique os logs do servidor.`);
  }
  
  const origin = headers().get('origin') || 'https://fallback-url.com';
  const successUrl = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/checkout/cancel`;
  console.log(`[createCheckoutSession] SuccessURL: ${successUrl}, CancelURL: ${cancelUrl}`);

  let stripeCustomerId: string | undefined;
  const userRefDb = adminDb.ref(`users/${userId}`);
  console.log(`[createCheckoutSession] User Firebase DB Ref: users/${userId}`);

  try {
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      console.log(`[createCheckoutSession] Cliente Stripe existente encontrado: ${stripeCustomerId} para o email: ${userEmail}`);
      if (existingCustomers.data[0].metadata?.firebaseUID !== userId) {
        console.log(`[createCheckoutSession] Atualizando metadados do cliente Stripe ${stripeCustomerId} para incluir firebaseUID: ${userId}`);
        try {
            await stripe.customers.update(stripeCustomerId, {
                metadata: { ...existingCustomers.data[0].metadata, firebaseUID: userId },
            });
            console.log(`[createCheckoutSession] Metadados do cliente Stripe atualizados para ${stripeCustomerId}.`);
        } catch (stripeUpdateError: any) {
            console.warn(`[createCheckoutSession] Aviso: Não foi possível atualizar os metadados do cliente Stripe para ${userEmail}. Erro: ${stripeUpdateError.message}. Prosseguindo com o ID do cliente existente.`);
        }
      }
    } else {
      console.log(`[createCheckoutSession] Criando novo cliente Stripe para o email: ${userEmail} com firebaseUID: ${userId}`);
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      console.log(`[createCheckoutSession] Novo cliente Stripe criado: ${stripeCustomerId}`);
    }

    try {
      await userRefDb.update({ stripeCustomerId });
      console.log(`[createCheckoutSession] Firebase RTDB atualizado para o usuário ${userId} com stripeCustomerId: ${stripeCustomerId}`);
    } catch (dbError: any) {
       console.warn(`[createCheckoutSession] Aviso: Não foi possível atualizar o ID do cliente Stripe no Firebase RTDB para o usuário ${userId}. Erro: ${dbError.message}. Prosseguindo com o checkout.`);
    }

  } catch (error: any) {
    console.error('[createCheckoutSession] Erro ao recuperar ou criar cliente Stripe:', error);
    if (!stripeCustomerId && (error.message?.includes('permission_denied') || error.code?.includes('PERMISSION_DENIED'))) {
         throw new Error(`Não foi possível estabelecer o ID do cliente Stripe devido a um problema de permissão do banco de dados: ${error.message}`);
    } else if (!stripeCustomerId) {
         throw new Error(`Não foi possível recuperar ou criar o cliente Stripe: ${error.message}`);
    }
  }

  if (!stripeCustomerId) {
    const errorMessage = '[createCheckoutSession] O ID do cliente Stripe não pôde ser estabelecido após tentativa de recuperação ou criação. Não é possível prosseguir com o checkout.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const metadata = {
    userId,
    planId,
    ...(specificDetails?.selectedCargoCompositeId && { selectedCargoCompositeId: specificDetails.selectedCargoCompositeId }),
    ...(specificDetails?.selectedEditalId && { selectedEditalId: specificDetails.selectedEditalId }),
  };
  
  console.log('[createCheckoutSession] Metadados a serem enviados para a sessão do Stripe:', metadata);

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

    console.log(`[createCheckoutSession] Criando sessão de checkout do Stripe. PriceID: ${priceId}, CustomerID: ${stripeCustomerId}`);
    console.log('[createCheckoutSession] Payload completo de criação da sessão:', JSON.stringify(sessionPayload, null, 2));

    session = await stripe.checkout.sessions.create(sessionPayload);
    
  } catch (error: any) {
    console.error('[createCheckoutSession] Falha na criação da sessão de checkout do Stripe:', error.message, error);
    if (error.code === 'resource_missing' && error.param === 'line_items[0][price]') {
      throw new Error(`O Price ID '${priceId}' não foi encontrado no Stripe. Verifique se ele está correto e ativo.`);
    }
    if (error.message.includes('mode=payment')) {
       throw new Error(`O preço configurado no Stripe não é compatível com pagamento único (one-time). Verifique se o Price ID '${priceId}' é do tipo 'Avulso' no painel do Stripe.`);
    }
    throw new Error(`Erro ao criar sessão de checkout no Stripe: ${error.message}`);
  }
  
  console.log(`[createCheckoutSession] Sessão de checkout do Stripe criada. ID: ${session.id}, URL disponível: ${!!session.url}`);

  if (session.url) {
    redirect(session.url);
  } else {
    const errorMessage = 'A sessão de checkout do Stripe foi criada, mas session.url é nulo ou indefinido.';
    console.error(`[createCheckoutSession] ${errorMessage}`, session);
    throw new Error('Não foi possível criar a sessão de checkout do Stripe ou a URL da sessão está faltando. Verifique os logs do servidor.');
  }
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] Requisição de webhook de PRODUÇÃO recebida.');
  const stripe = getStripeClient();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');
  console.log(`[handleStripeWebhook] Assinatura Stripe do cabeçalho: ${signature ? 'presente' : 'AUSENTE (ISSO É UM PROBLEMA!)'}`);

  // Lê o segredo do webhook diretamente da configuração.
  const webhookSecret = appConfig.WEBHOOK_SECRET_PROD;
  console.log(`[handleStripeWebhook] appConfig.WEBHOOK_SECRET_PROD: ${webhookSecret ? "****** (presente)" : "STRING VAZIA OU NULA (ISSO É UM PROBLEMA CRÍTICO!)"}`);

  if (!signature) {
    const msg = "Erro de Webhook: Cabeçalho stripe-signature ausente";
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response(msg, { status: 400 });
  }
  if (!webhookSecret || webhookSecret.trim() === '') {
    const msg = `CRÍTICO: WEBHOOK_SECRET_PROD não está definido ou está vazio na configuração. Este é um problema de configuração do lado do servidor.`;
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response('Erro de Webhook: Segredo do webhook não configurado ou está vazio. Problema de configuração do servidor.', { status: 500 });
  }

  let event: Stripe.Event;
  let rawBody: string = '';
  try {
    rawBody = await req.text(); // Lê o corpo uma vez
    console.log('[handleStripeWebhook] Corpo bruto da requisição recebido (primeiros 500 caracteres):', rawBody.substring(0, 500));
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(`[handleStripeWebhook] Evento Stripe construído com sucesso. Tipo do Evento: ${event.type}, ID do Evento: ${event.id}`);
  } catch (err: any) {
    console.error(`[handleStripeWebhook] Falha na verificação da assinatura do webhook: ${err.message}. Corpo bruto era: ${rawBody ? rawBody.substring(0, 500) + '...' : 'NÃO FOI POSSÍVEL LER O CORPO'}`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }

  if (!event) {
    const msg = "Erro de Webhook: Objeto de evento Stripe não construído após a verificação da assinatura. Isso indica um problema sério com a biblioteca Stripe ou a lógica de manipulação de eventos.";
    console.error(`[handleStripeWebhook] ${msg}`);
    return new Response('Erro de Webhook: Erro interno do servidor ao processar o evento.', { status: 500 });
  }

  console.log(`[handleStripeWebhook] Processando tipo de evento: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[handleStripeWebhook] Evento: checkout.session.completed. ID da Sessão: ${session.id}. Metadados completos da sessão: ${JSON.stringify(session.metadata)}`);
        
        const userId = session.metadata?.userId;
        const planIdFromMetadata = session.metadata?.planId as PlanId | undefined;
        const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId;
        const selectedEditalId = session.metadata?.selectedEditalId; 
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        const stripeCustomerIdFromSession = session.customer;
        const userEmail = session.customer_details?.email;
        const userName = session.customer_details?.name;

        console.log(`[handleStripeWebhook] Metadados Extraídos - UserID: ${userId}, PlanID: ${planIdFromMetadata}, CargoID: ${selectedCargoCompositeId}, EditalID: ${selectedEditalId}, PaymentIntentID: ${paymentIntentId}, CustomerID: ${stripeCustomerIdFromSession}, Email: ${userEmail}, Nome: ${userName}`);

        if (!userId || !planIdFromMetadata) {
          console.error('[handleStripeWebhook] Erro de Webhook: userId ou planIdFromMetadata ausentes nos metadados da sessão de checkout.', session.metadata);
          return new Response('Erro de Webhook: Metadados críticos ausentes (userId ou planIdFromMetadata).', { status: 400 });
        }

        if (planIdFromMetadata === 'plano_trial') {
            console.error(`[handleStripeWebhook] AVISO CRÍTICO: Sessão de checkout ${session.id} concluída, mas o planId nos metadados é 'plano_trial'. Isso indica um problema potencial na criação da sessão de checkout se um plano pago era esperado. UserID: ${userId}.`);
            return new Response('Erro de Webhook: planId inválido ("plano_trial") recebido para uma sessão de checkout concluída. Provavelmente um erro de configuração.', { status: 400 });
        }
        
        if (!stripeCustomerIdFromSession || typeof stripeCustomerIdFromSession !== 'string') {
          console.error('[handleStripeWebhook] Erro de Webhook: ID do cliente ausente ou inválido na sessão de checkout.', session);
          return new Response('Erro de Webhook: ID do cliente ausente ou inválido.', { status: 400 });
        }
        
        console.log(`[handleStripeWebhook] Todos os IDs críticos parecem estar presentes. Prosseguindo para atualizar o plano do usuário.`);
        
        const userFirebaseRef = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userFirebaseRef.get();
        const currentUserData = userSnapshot.val() || {};
        console.log(`[handleStripeWebhook] Dados do usuário ${userId} ANTES da atualização do plano: activePlan: ${currentUserData.activePlan}, contagem de activePlans: ${(currentUserData.activePlans || []).length}`);

        const now = new Date();
        const startDateISO = formatISO(now);
        const expiryDate = new Date(new Date().setFullYear(now.getFullYear() + 1));
        const expiryDateISO = formatISO(expiryDate);
        console.log(`[handleStripeWebhook] Modo de pagamento: Vencimento do plano definido para 1 ano. Início: ${startDateISO}, Vencimento: ${expiryDateISO}`);
        
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
            // Move todos os planos ativos anteriores para o histórico
            newPlanHistory = [...newPlanHistory, ...currentActivePlans];
            console.log(`[handleStripeWebhook] Compra de PLANO_ANUAL. Sobrescrevendo todos os outros planos. Movidos ${currentActivePlans.length} planos para o histórico.`);
        } else {
            // Adiciona o novo plano aos existentes
            finalActivePlans = [...currentActivePlans, newPlan];
            console.log(`[handleStripeWebhook] Novo plano adicionado. Total de planos ativos agora: ${finalActivePlans.length}`);
        }
        
        // Determina o plano ativo de maior nível
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
        
        // Lida com o auto-registro para compra do plano_cargo
        if (planIdFromMetadata === 'plano_cargo' && selectedCargoCompositeId) {
            const currentRegistered = currentUserData.registeredCargoIds || [];
            if (!currentRegistered.includes(selectedCargoCompositeId)) {
                updatePayload.registeredCargoIds = [...currentRegistered, selectedCargoCompositeId];
                console.log(`[handleStripeWebhook] PLANO_CARGO: Auto-registrando usuário ${userId} para o cargo: ${selectedCargoCompositeId}.`);
            }
        }

        console.log(`[handleStripeWebhook] PAYLOAD FINAL DE ATUALIZAÇÃO DO DB para o usuário ${userId}:`, JSON.stringify(updatePayload, null, 2));
        
        try {
          await userFirebaseRef.update(updatePayload);
          console.log(`[handleStripeWebhook] Dados do usuário ${userId} atualizados com sucesso no Firebase.`);
        } catch (dbError: any) {
          console.error(`[handleStripeWebhook] Erro de Webhook: Falha ao atualizar o usuário ${userId} no banco de dados:`, dbError);
          return new Response('Erro de Webhook: Falha na atualização do banco de dados. Verifique os logs do servidor.', { status: 500 });
        }
        
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent;
        console.log(`[handleStripeWebhook] Evento: charge.refunded. ID do PaymentIntent: ${paymentIntentId}`);

        if (!paymentIntentId || typeof paymentIntentId !== 'string') {
          console.error(`[handleStripeWebhook] Evento de reembolso para a cobrança ${charge.id} está sem um ID de PaymentIntent válido.`);
          return new Response('Erro de Webhook: Evento de reembolso sem ID de PaymentIntent.', { status: 400 });
        }

        const usersRef = adminDb.ref('users');
        const usersSnapshot = await usersRef.orderByChild('stripeCustomerId').equalTo(charge.customer as string).get();

        if (!usersSnapshot.exists()) {
          console.error(`[handleStripeWebhook] Nenhum usuário encontrado com o ID de Cliente Stripe: ${charge.customer}. Não é possível processar o reembolso.`);
          return new Response('Erro de Webhook: Usuário não encontrado para reembolso.', { status: 404 });
        }
        
        const usersData = usersSnapshot.val();
        const userId = Object.keys(usersData)[0];
        const userData = usersData[userId];
        const userFirebaseRef = adminDb.ref(`users/${userId}`);

        console.log(`[handleStripeWebhook] Usuário ${userId} encontrado para processamento de reembolso.`);

        const planToRemoveIndex = (userData.activePlans || []).findIndex((p: PlanDetails) => p.stripePaymentIntentId === paymentIntentId);

        if (planToRemoveIndex === -1) {
           console.warn(`[handleStripeWebhook] Usuário ${userId} recebeu um reembolso para o PaymentIntent ${paymentIntentId}, mas nenhum plano ativo correspondente foi encontrado. Nenhuma ação foi tomada.`);
           return new Response('Plano para reembolso não encontrado.', { status: 200 }); // Retorna 200 para que o Stripe não tente novamente
        }
        
        const planToRemove = userData.activePlans[planToRemoveIndex];
        const updatedActivePlans = userData.activePlans.filter((_: any, index: number) => index !== planToRemoveIndex);

        // Move o plano reembolsado para o histórico
        const updatedPlanHistory = [...(userData.planHistory || []), { ...planToRemove, planId: `refunded_${planToRemove.planId}` as any }];

        // Recalcula o plano ativo mais alto
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

        console.log(`[handleStripeWebhook] Reembolsando plano ${planToRemove.planId} para o usuário ${userId}. Payload de atualização do DB:`, JSON.stringify(updatePayload, null, 2));

        try {
          await userFirebaseRef.update(updatePayload);
          console.log(`[handleStripeWebhook] Reembolso processado com sucesso e DB atualizado para o usuário ${userId}.`);
        } catch (dbError: any) {
          console.error(`[handleStripeWebhook] Erro no DB durante o processamento de reembolso para o usuário ${userId}:`, dbError);
          return new Response('Erro de Webhook: Falha na atualização do banco de dados durante o reembolso. Verifique os logs do servidor.', { status: 500 });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[handleStripeWebhook] Evento: customer.subscription.deleted. ID da Assinatura ${subscription.id}`);
        const stripeCustomerId = subscription.customer;
         if (typeof stripeCustomerId === 'string') {
           console.log(`[handleStripeWebhook] Procurando usuário pelo ID de Cliente Stripe: ${stripeCustomerId}`);
           const usersRef = adminDb.ref('users');
           const usersSnapshot = await usersRef.get();
           if (usersSnapshot.exists()) {
              const usersData = usersSnapshot.val();
              for (const uid in usersData) {
                  const userData = usersData[uid];
                  if (userData.stripeCustomerId === stripeCustomerId || userData.activePlans?.some((p: PlanDetails) => p.stripeCustomerId === stripeCustomerId)) {
                      console.log(`[handleStripeWebhook] UID do Firebase correspondente encontrado: ${uid} para o ID de Cliente Stripe ${stripeCustomerId}`);
                      console.warn(`[handleStripeWebhook] Exclusão de assinatura recebida, mas a remoção automática de plano para configuração de múltiplos planos não está totalmente implementada. Verificação manual pode ser necessária para o usuário ${uid}.`);
                      break;
                  }
              }
           }
        }
        break;
      }
      default:
        console.log(`[handleStripeWebhook] Tipo de evento de webhook Stripe não tratado: ${event.type}. ID do Evento: ${event.id}`);
    }
  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] Erro ao processar o tipo de evento ${event.type} (ID do Evento: ${event.id}):`, processingError);
      return new Response(`Erro de Webhook: Erro interno do servidor ao processar o evento ${event.type}. ${processingError.message}`, { status: 500 });
  }

  console.log(`[handleStripeWebhook] Tipo de evento processado com sucesso: ${event.type}. ID do Evento: ${event.id}. Retornando 200 OK para o Stripe.`);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
