
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
            console.log(`[handleCheckoutSessionCompleted] LOG: Sessão de assinatura (ID: ${session.id}) detectada com Subscription ID: ${session.subscription}. Tentando processar antecipadamente...`);
            const stripe = await getStripeClient();
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
            try {
                // Passar o objeto 'session' inteiro para a próxima função é crucial
                const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
                await handleSubscriptionCreatedOrUpdated(subscription, undefined, session); 
                console.log(`[handleCheckoutSessionCompleted] LOG: Processamento antecipado para ${subscriptionId} concluído com sucesso.`);
            } catch (error) {
                console.error(`[handleCheckoutSessionCompleted] ERRO: Falha ao processar assinatura antecipadamente para ${subscriptionId}:`, error);
            }
        } else {
             console.log(`[handleCheckoutSessionCompleted] LOG: Sessão de assinatura (ID: ${session.id}) para o usuário ${session.metadata?.userId}. Aguardando evento 'customer.subscription.created' pois 'session.subscription' está nulo.`);
        }
        return;
    }
    
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId as PlanId | undefined;

    if (!userId || !planId) {
        console.error(`[handleCheckoutSessionCompleted] ERRO CRÍTICO: Metadados (userId ou planId) ausentes para pagamento único. Session ID: ${session.id}`, session.metadata);
        return;
    }

    console.log(`[handleCheckoutSessionCompleted] LOG: Processando pagamento único para o usuário ${userId}, plano ${planId}.`);

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
        description: `Compra ${getPlanDisplayName(planId)}`,
    };

    console.log('[handleCheckoutSessionCompleted] LOG: Novo registro de pagamento criado para compra única:', newPaymentRecord);

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
      paymentHistory: finalPaymentHistory,
      stripeCustomerId: newPlan.stripeCustomerId,
      hasHadFreeTrial: currentUserData.hasHadFreeTrial || true,
    };
    
    if (planId === 'plano_cargo' && newPlan.selectedCargoCompositeId) {
      const currentRegistered = currentUserData.registeredCargoIds || [];
      if (!currentRegistered.includes(newPlan.selectedCargoCompositeId)) {
        updatePayload.registeredCargoIds = [...currentRegistered, newPlan.selectedCargoCompositeId];
      }
    }

    console.log(`[handleCheckoutSessionCompleted] LOG: Payload final para ${userId}:`, JSON.stringify(updatePayload));
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleCheckoutSessionCompleted] SUCESSO: Usuário ${userId} atualizado com plano de pagamento único.`);
}

async function handleSubscriptionCreatedOrUpdated(
    subscription: Stripe.Subscription,
    fallback?: { userId?: string; planId?: PlanId },
    checkoutSession?: Stripe.Checkout.Session | null
) {
    let userId = subscription.metadata?.userId || fallback?.userId;
    let planId = (subscription.metadata?.planId as PlanId | undefined) || fallback?.planId;

    console.log(`[handleSubscriptionUpdate] LOG: Iniciando processamento para Sub ID: ${subscription.id}. Metadata inicial:`, { userId, planId, fallback, checkoutSessionExists: !!checkoutSession });

    if (!planId) {
        const priceId = subscription.items?.data?.[0]?.price?.id;
        console.log(`[handleSubscriptionUpdate] LOG: 'planId' ausente. Tentando mapear do Price ID: ${priceId}`);
        planId = await mapPriceToPlan(priceId);
        console.log(`[handleSubscriptionUpdate] LOG: 'planId' mapeado para: ${planId}`);
    }

    if (!userId) {
        console.log(`[handleSubscriptionUpdate] LOG: 'userId' ausente. Buscando checkout.session para a assinatura ${subscription.id}...`);
        // Se a sessão de checkout não foi passada, tente buscá-la.
        if (!checkoutSession) {
            try {
                const stripe = await getStripeClient();
                const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
                if (sessions.data.length > 0) {
                    checkoutSession = sessions.data[0];
                    console.log(`[handleSubscriptionUpdate] LOG: checkout.session recuperada da API: ${checkoutSession.id}`);
                } else {
                     console.log(`[handleSubscriptionUpdate] AVISO: Nenhuma checkout.session encontrada para a assinatura ${subscription.id}.`);
                }
            } catch (e: any) {
                console.error('[handleSubscriptionUpdate] ERRO: Falha ao buscar sessão para recuperar metadados:', e.message);
            }
        }
        // Agora, com a sessão (seja a passada ou a buscada), tente obter o userId
        if (checkoutSession) {
            userId = checkoutSession.metadata?.userId;
            console.log(`[handleSubscriptionUpdate] LOG: 'userId' recuperado da sessão de checkout: ${userId}`);
        }
    }


    if (!userId || !planId) {
        console.error(`[handleSubscriptionUpdate] ERRO CRÍTICO: 'userId' ou 'planId' ausentes e não recuperáveis para a assinatura ${subscription.id}. Abortando.`);
        return;
    }

    console.log(`[handleSubscriptionUpdate] LOG: Processando assinatura ${subscription.id} para o usuário ${userId} com plano ${planId}.`);
    
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
        console.log(`[handleSubscriptionUpdate] LOG: Assinatura ${subscription.id} está inativa. Movendo para o histórico.`);
        finalPlanHistory.unshift(planDetails);
    } else {
        console.log(`[handleSubscriptionUpdate] LOG: Assinatura ${subscription.id} está ativa. Adicionando/atualizando nos planos ativos.`);
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

    // --- CORREÇÃO: ADICIONA REGISTRO DE PAGAMENTO NA CRIAÇÃO DA ASSINATURA ---
    // A condição de ser o primeiro pagamento da assinatura é `created === current_period_start`
    const isInitialPayment = subscription.created === subscription.current_period_start;
    if ((subscription.status === 'active' || subscription.status === 'trialing') && isInitialPayment) {
        console.log(`[handleSubscriptionUpdate] LOG: Detectada criação de assinatura ou início de trial pago. Tentando registrar pagamento inicial para Sub ID: ${subscription.id}`);
        let paymentAmount = 0;
        let paymentId = subscription.id;
        
        // Prioridade 1: Usar dados da sessão de checkout, se disponível. É a fonte mais confiável.
        if (checkoutSession && checkoutSession.amount_total !== null) {
            paymentAmount = checkoutSession.amount_total;
            paymentId = checkoutSession.id;
            console.log(`[handleSubscriptionUpdate] LOG: Usando dados do checkoutSession fornecido. Valor: ${paymentAmount}, ID: ${paymentId}`);
        } 
        // Prioridade 2: Usar a fatura mais recente associada à assinatura.
        else if (subscription.latest_invoice) {
            console.log(`[handleSubscriptionUpdate] LOG: checkoutSession ausente ou sem valor. Usando 'latest_invoice' da assinatura.`);
            const invoice = typeof subscription.latest_invoice === 'string' 
                ? await (await getStripeClient()).invoices.retrieve(subscription.latest_invoice) 
                : subscription.latest_invoice;
            if (invoice && invoice.amount_paid > 0) {
              paymentAmount = invoice.amount_paid;
              paymentId = invoice.id;
              console.log(`[handleSubscriptionUpdate] LOG: Usando dados da fatura. Valor: ${paymentAmount}, ID: ${paymentId}`);
            }
        }
        
        if (paymentAmount > 0) {
            console.log(`[handleSubscriptionUpdate] LOG: Valor do pagamento > 0. Criando registro de pagamento.`);
            const newPaymentRecord: PaymentRecord = {
                id: paymentId,
                date: formatISO(new Date(subscription.created * 1000)),
                amount: paymentAmount,
                planId: planId,
                description: `Assinatura ${getPlanDisplayName(planId)}`,
            };
            
            const currentPaymentHistory: PaymentRecord[] = currentUserData.paymentHistory || [];
            if (!currentPaymentHistory.some(p => p.id === newPaymentRecord.id)) {
                console.log(`[handleSubscriptionUpdate] LOG: Registro de pagamento não existe. Adicionando ao histórico.`);
                // Garante que o payload do paymentHistory seja atualizado
                updatePayload.paymentHistory = [newPaymentRecord, ...(updatePayload.paymentHistory || currentPaymentHistory)];
            } else {
                 console.log(`[handleSubscriptionUpdate] AVISO: Registro de pagamento com ID ${newPaymentRecord.id} já existe no histórico. Pulando.`);
            }
        } else {
            console.log(`[handleSubscriptionUpdate] LOG: Valor do pagamento é 0 (trial sem custo inicial). Nenhum registro de pagamento criado.`);
        }
    } else {
        console.log(`[handleSubscriptionUpdate] LOG: Não é a criação da assinatura (pagamento recorrente ou outra atualização). Pulando lógica de registro de pagamento inicial.`);
    }
    // --- FIM DA CORREÇÃO ---

    console.log(`[handleSubscriptionUpdate] LOG: Payload final para ${userId}:`, JSON.stringify(updatePayload, null, 2));
    await userFirebaseRef.update(updatePayload);
    console.log(`[handleSubscriptionUpdate] SUCESSO: Usuário ${userId} atualizado no DB.`);
}


export async function handleStripeWebhook(req: Request): Promise<Response> {
  console.log('[handleStripeWebhook] LOG: Requisição de webhook recebida.');
  
  let event: Stripe.Event;
  try {
    const stripe = await getStripeClient();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = await getEnvOrSecret('STRIPE_WEBHOOK_SECRET_PROD');

    if (!signature) throw new Error("Cabeçalho stripe-signature ausente.");
    if (!webhookSecret) throw new Error("Segredo do webhook não configurado no servidor.");
    
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log(`[handleStripeWebhook] LOG: Evento verificado e construído: ${event.type} (ID: ${event.id})`);

  } catch (err: any) {
    console.error(`[handleStripeWebhook] ERRO na verificação da assinatura do webhook: ${err.message}`);
    return new Response(`Erro de Webhook: ${err.message}`, { status: 400 });
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[Webhook] LOG: Recebido evento 'checkout.session.completed' para a sessão ${session.id}.`);
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] LOG: Recebido evento '${event.type}' para a assinatura ${subscription.id}. Novo status: ${subscription.status}`);
        await handleSubscriptionCreatedOrUpdated(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] LOG: Recebido evento 'customer.subscription.deleted' para a assinatura ${subscription.id}. Status final: ${subscription.status}`);
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
                console.log(`[Webhook] LOG: Recebido 'invoice.payment_succeeded' para sub ${subscriptionId} do usuário ${userId}. Razão: ${invoice.billing_reason}`);
                
                if (invoice.billing_reason !== 'subscription_create') {
                    console.log(`[Webhook] LOG: Não é a criação da assinatura. Registrando pagamento recorrente.`);
                    const newPaymentRecord: PaymentRecord = {
                        id: invoice.id,
                        date: formatISO(new Date(invoice.created * 1000)),
                        amount: invoice.amount_paid,
                        planId: planId,
                        description: invoice.billing_reason === 'subscription_cycle' ? 'Renovação Mensal' : 'Pagamento de Fatura',
                    };

                    const userRef = adminDb.ref(`users/${userId}`);
                    const userSnapshot = await userRef.get();
                    const userData = userSnapshot.val() || {};
                    const currentPaymentHistory: PaymentRecord[] = userData.paymentHistory || [];

                    if (!currentPaymentHistory.some(p => p.id === newPaymentRecord.id)) {
                      console.log(`[Webhook] LOG: Adicionando novo registro de pagamento recorrente ao histórico.`);
                      const finalPaymentHistory = [newPaymentRecord, ...currentPaymentHistory];
                      await userRef.update({ paymentHistory: finalPaymentHistory });
                    } else {
                      console.log(`[Webhook] AVISO: Pagamento recorrente com ID ${newPaymentRecord.id} já existe. Pulando.`);
                    }
                } else {
                   console.log(`[Webhook] LOG: É a criação da assinatura. O pagamento inicial deve ser tratado por 'handleSubscriptionCreatedOrUpdated'. Pulando.`);
                }
                
                // Sempre atualiza o status da assinatura para refletir o novo período de validade
                await handleSubscriptionCreatedOrUpdated(subscription); 
            } else {
              console.warn(`[Webhook] AVISO: 'userId' não encontrado nos metadados da assinatura ${subscriptionId} para 'invoice.payment_succeeded'.`);
            }
        } else {
           console.log(`[Webhook] LOG: 'invoice.payment_succeeded' recebido sem um ID de assinatura. Ignorando.`);
        }
        break;
      }


      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (subscriptionId) {
            console.warn(`[Webhook] AVISO: Pagamento da fatura falhou para a assinatura ${subscriptionId}. Marcando plano como 'past_due'.`);
            const stripe = await getStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await handleSubscriptionCreatedOrUpdated(subscription);
        }
        break;
      }

      default:
        console.log(`[handleStripeWebhook] LOG: Evento não tratado recebido: ${event.type}.`);
    }

  } catch (processingError: any) {
      console.error(`[handleStripeWebhook] ERRO CRÍTICO ao processar o evento ${event.type}:`, processingError);
      return new Response(`Erro interno do servidor ao processar o evento.`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

function getPlanDisplayName(planId: "plano_mensal" | "plano_cargo" | "plano_edital" | "plano_trial"): string {
    switch(planId) {
        case 'plano_mensal': return 'Mensal';
        case 'plano_cargo': return 'Cargo';
        case 'plano_edital': return 'Edital';
        case 'plano_trial': return 'Trial';
        default: return 'Plano';
    }
}

    