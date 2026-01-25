
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
    console.log(
      `[handleCheckoutSessionCompleted] LOG: Sessão de assinatura (ID: ${session.id}) detectada. Tentando processar antecipadamente...`
    );

    try {
      const stripe = await getStripeClient();

      if (session.subscription) {
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await handleSubscriptionCreatedOrUpdated(
          subscription,
          {
            userId: session.metadata?.userId,
            planId: session.metadata?.planId as PlanId | undefined,
          },
          session
        );

        console.log(
          `[handleCheckoutSessionCompleted] LOG: Processamento antecipado para ${subscriptionId} concluído.`
        );
      } else {
        console.log(
          `[handleCheckoutSessionCompleted] AVISO: session.subscription está nulo para a sessão ${session.id}. O processamento dependerá do webhook 'customer.subscription.created'.`
        );
      }
    } catch (error) {
      console.error(
        `[handleCheckoutSessionCompleted] ERRO: Falha ao processar assinatura antecipadamente para a sessão ${session.id}:`,
        error
      );
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
  try {
    // --- 1. Recupera userId e planId de forma robusta ---
    let userId = (subscription.metadata?.userId as string | undefined) || fallback?.userId;
    let planId = (subscription.metadata?.planId as PlanId | undefined) || fallback?.planId;

    console.log(
      `[handleSubscriptionUpdate] LOG: Iniciando processamento para Sub ID: ${subscription.id}. Metadata inicial:`,
      { userId, planId, fallback, checkoutSessionExists: !!checkoutSession }
    );

    // Se não tiver planId, tenta mapear pelo price
    if (!planId) {
      const priceId = subscription.items?.data?.[0]?.price?.id;
      console.log(
        `[handleSubscriptionUpdate] LOG: 'planId' ausente. Tentando mapear do Price ID: ${priceId}`
      );
      planId = (await mapPriceToPlan(priceId || null)) as PlanId | undefined;
      console.log(`[handleSubscriptionUpdate] LOG: 'planId' mapeado para: ${planId}`);
    }

    // Se não tiver userId, tenta achar a checkout.session vinculada
    if (!userId) {
      console.log(
        `[handleSubscriptionUpdate] LOG: 'userId' ausente. Buscando checkout.session para a assinatura ${subscription.id}...`
      );
      if (!checkoutSession) {
        try {
          const stripe = await getStripeClient();
          const sessions = await stripe.checkout.sessions.list({
            subscription: subscription.id,
            limit: 1,
          });
          if (sessions.data.length > 0) {
            checkoutSession = sessions.data[0];
            console.log(
              `[handleSubscriptionUpdate] LOG: checkout.session recuperada da API: ${checkoutSession.id}`
            );
          } else {
            console.log(
              `[handleSubscriptionUpdate] AVISO: Nenhuma checkout.session encontrada para a assinatura ${subscription.id}.`
            );
          }
        } catch (e: any) {
          console.error(
            '[handleSubscriptionUpdate] ERRO: Falha ao buscar sessão para recuperar metadados:',
            e.message
          );
        }
      }
      if (checkoutSession) {
        userId = checkoutSession.metadata?.userId as string | undefined;
        console.log(
          `[handleSubscriptionUpdate] LOG: 'userId' recuperado da sessão de checkout: ${userId}`
        );
      }
    }

    if (!userId || !planId) {
      console.error(
        `[handleSubscriptionUpdate] ERRO CRÍTICO: 'userId' ou 'planId' ausentes e não recuperáveis para a assinatura ${subscription.id}. Abortando.`
      );
      return;
    }

    console.log(
      `[handleSubscriptionUpdate] LOG: Processando assinatura ${subscription.id} para o usuário ${userId} com plano ${planId}.`
    );

    const userFirebaseRef = adminDb.ref(`users/${userId}`);
    const userSnapshot = await userFirebaseRef.get();
    const currentUserData = userSnapshot.val() || {};

    // --- 2. Mapeia status da assinatura ---
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

    let effectiveStatus: PlanDetails['status'] =
      statusMap[subscription.status] ?? 'active';

    if (subscription.cancel_at_period_end && subscription.status !== 'canceled') {
      effectiveStatus = 'canceled';
    }

    const stripeCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer && 'id' in subscription.customer
        ? (subscription.customer.id as string)
        : null;

    const planDetails: PlanDetails = {
  planId,
  startDate: formatISO(new Date(subscription.created * 1000)),
  expiryDate: formatISO(new Date(subscription.current_period_end * 1000)),
  stripeSubscriptionId: subscription.id,
  stripePaymentIntentId: null,
  stripeCustomerId: stripeCustomerId,
  status: effectiveStatus,
};

// --- 3. Normaliza arrays vindos do Firebase (caso venham como objeto) ---
const toArray = <T>(value: any): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  return Object.values(value) as T[];
};

let finalActivePlans: PlanDetails[] = toArray<PlanDetails>(currentUserData.activePlans);
let finalPlanHistory: PlanDetails[] = toArray<PlanDetails>(currentUserData.planHistory);

const isTrulyInactive = ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status);

// Remove qualquer registro anterior dessa mesma assinatura
finalActivePlans = finalActivePlans.filter(p => p.stripeSubscriptionId !== subscription.id);
finalPlanHistory = finalPlanHistory.filter(p => p.stripeSubscriptionId !== subscription.id);

if (isTrulyInactive) {
  console.log(`[handleSubscriptionUpdate] LOG: Assinatura ${subscription.id} está inativa. Movendo para o histórico.`);
  finalPlanHistory.unshift(planDetails);
} else {
  console.log(`[handleSubscriptionUpdate] LOG: Assinatura ${subscription.id} está ativa. Adicionando/atualizando nos planos ativos.`);
  finalActivePlans.push(planDetails);
}

const highestPlan =
  [...finalActivePlans]
    .filter(p => p.status === 'active')
    .sort((a, b) => (planRank[b.planId as PlanId] ?? 0) - (planRank[a.planId as PlanId] ?? 0))[0] ?? null;

    const updatePayload: any = {
      activePlan: highestPlan?.planId ?? null,
      activePlans: finalActivePlans,
      planHistory: finalPlanHistory,
      stripeCustomerId: planDetails.stripeCustomerId,
      hasHadFreeTrial: true,
    };

    console.log(
      `[handleSubscriptionUpdate] LOG: Payload final para ${userId}:`,
      JSON.stringify(updatePayload, null, 2)
    );
    await userFirebaseRef.update(updatePayload);
    console.log(
      `[handleSubscriptionUpdate] SUCESSO: Usuário ${userId} atualizado no DB.`
    );
  } catch (err: any) {
    console.error(
      `[handleSubscriptionUpdate] ERRO NÃO TRATADO ao processar assinatura ${subscription.id}:`,
      err?.message,
      err?.stack
    );
    throw err;
  }
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

        // --- 1) Descobrir subscriptionId com todos os fallbacks possíveis ---
        let subscriptionId: string | null = null;

        if (typeof invoice.subscription === 'string') {
          subscriptionId = invoice.subscription;
        } else if (
          invoice.subscription &&
          typeof (invoice.subscription as any).id === 'string'
        ) {
          subscriptionId = (invoice.subscription as any).id;
        } else {
          // Fallbacks usando os campos que aparecem no JSON que você mandou
          const firstLine: any = invoice.lines?.data?.[0] ?? null;
          const fromLine =
            firstLine?.parent?.subscription_item_details?.subscription ?? null;

          const fromParent: any = (invoice as any).parent ?? null;
          const fromParentSub =
            fromParent?.subscription_details?.subscription ?? null;

          subscriptionId = fromLine || fromParentSub || null;
        }

        console.log(
          `[Webhook] LOG: invoice.payment_succeeded. invoice.id=${invoice.id}, subscriptionId=${subscriptionId}, billing_reason=${invoice.billing_reason}, amount_paid=${invoice.amount_paid}`
        );

        const stripe = await getStripeClient();

        // --- 2) Tentar recuperar a subscription (se tivermos ID) ---
        let subscription: Stripe.Subscription | null = null;
        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        }

        // --- 3) Descobrir userId com várias fontes ---
        let userId: string | undefined;

        // Fonte 1: Metadados da própria assinatura (ideal)
        if (subscription?.metadata?.userId) {
          userId = subscription.metadata.userId;
          console.log(`[Webhook] userId encontrado em subscription.metadata: ${userId}`);
        }

        // Fonte 2: Metadados do Cliente Stripe (fallback mais robusto)
        if (!userId && typeof invoice.customer === 'string') {
          try {
            const customer = await stripe.customers.retrieve(invoice.customer);
            if (customer && !customer.deleted) {
              userId = customer.metadata?.firebaseUID;
              if(userId) console.log(`[Webhook] userId encontrado em customer.metadata.firebaseUID: ${userId}`);
            }
          } catch (customerError: any) {
            console.error(`[Webhook] Erro ao buscar cliente Stripe ${invoice.customer}:`, customerError.message);
          }
        }
        
        // Fonte 3: Sessão de Checkout original (fallback final, principalmente para o primeiro pagamento)
        if (!userId && subscriptionId) {
            try {
              console.log(
                `[invoice.payment_succeeded] LOG: userId ausente. Buscando checkout.session para ${subscriptionId}...`
              );
              const sessions = await stripe.checkout.sessions.list({
                subscription: subscriptionId,
                limit: 1,
              });
              if (sessions.data.length > 0) {
                const cs = sessions.data[0];
                userId = cs.metadata?.userId as string | undefined;
                console.log(
                  `[invoice.payment_succeeded] LOG: userId recuperado da checkout.session ${cs.id}: ${userId}`
                );
              }
            } catch (e: any) {
              console.error(
                `[invoice.payment_succeeded] ERRO ao buscar checkout.session para recuperar userId:`,
                e.message
              );
            }
        }

        if (!userId) {
          console.warn(
            `[invoice.payment_succeeded] AVISO: 'userId' não encontrado em lugar nenhum para invoice ${invoice.id}. Histórico de faturamento NÃO será atualizado.`
          );
          break;
        }

        // --- 4) Descobrir planId (subscription.metadata, invoice.parent, line.metadata, price) ---
        let planId: PlanId =
          ((subscription?.metadata?.planId as PlanId | undefined) ??
            ((await mapPriceToPlan(
              invoice.lines.data[0]?.price?.id ||
                subscription?.items.data[0]?.price?.id ||
                null
            )) as PlanId | undefined) ??
            'plano_mensal') as PlanId;

        console.log(
          `[Webhook] LOG: Registrando pagamento para userId=${userId}, planId=${planId}.`
        );

        // --- 5) Monta descrição amigável ---
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

        const rawHistory = userData.paymentHistory || [];
        const currentPaymentHistory: PaymentRecord[] = Array.isArray(rawHistory)
          ? rawHistory
          : Object.values(rawHistory);

        if (!currentPaymentHistory.some((p) => p.id === newPaymentRecord.id)) {
          console.log(
            `[Webhook] LOG: Adicionando novo registro de pagamento ao histórico.`
          );
          const finalPaymentHistory = [newPaymentRecord, ...currentPaymentHistory];
          await userRef.update({ paymentHistory: finalPaymentHistory });
        } else {
          console.log(
            `[Webhook] AVISO: Pagamento com ID ${newPaymentRecord.id} já existe no histórico. Pulando.`
          );
        }

        // --- 6) Atualiza a assinatura (se tivermos subscription) ---
        if (subscription) {
          try {
            await handleSubscriptionCreatedOrUpdated(subscription);
          } catch (err: any) {
            console.error(  
              `[Webhook] ERRO ao atualizar assinatura após invoice.payment_succeeded (${subscriptionId}):`,
              err?.message
            );
          }
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

    

    
