
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { getEnvOrSecret } from '@/lib/secrets';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getPlanToPriceMap(): Promise<Record<string, string>> {
  console.log('[API getPlanToPriceMap] Lendo Price IDs...');
  const priceMap = {
    plano_cargo: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_CARGO'),
    plano_edital: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_EDITAL'),
    plano_mensal: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_MENSAL_RECORRENTE'),
  };
  console.log(
    `[API getPlanToPriceMap] LOG: Price IDs carregados: Cargo=${!!priceMap.plano_cargo}, ` +
      `Edital=${!!priceMap.plano_edital}, Mensal=${!!priceMap.plano_mensal}`
  );
  return priceMap;
}

export async function POST(req: NextRequest) {
  console.log('[API create-session] LOG: Recebida requisição POST.');
  try {
    // 1) Autenticação
    const authHeader = headers().get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[API create-session] ERRO: Token de autorização ausente.');
      return NextResponse.json({ error: 'Token de autorização ausente.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid: userId, email: userEmail, name } = decodedToken as {
      uid: string;
      email: string | null;
      name?: string | null;
    };
    console.log(`[API create-session] LOG: Token verificado. UID: ${userId}`);

    if (!userId || !userEmail) {
      console.error(`[API create-session] ERRO CRÍTICO: UID ou email ausente no token. UID: ${userId}, Email: ${userEmail}`);
      return NextResponse.json({ error: 'Informações do usuário inválidas no token.' }, { status: 401 });
    }

    // 2) Body
    const body = await req.json();
    const { planId, selectedCargoCompositeId, selectedEditalId } = body as {
      planId: PlanId;
      selectedCargoCompositeId?: string;
      selectedEditalId?: string;
    };
    console.log('[API create-session] LOG: Corpo da requisição:', body);

    if (!planId || planId === 'plano_trial') {
      console.error(`[API create-session] ERRO: planId inválido: '${planId}'`);
      return NextResponse.json({ error: 'planId é obrigatório e não pode ser plano_trial.' }, { status: 400 });
    }

    // 3) Stripe e preço
    const stripe = await getStripeClient();
    const planToPriceMap = await getPlanToPriceMap();
    const priceId = planToPriceMap[planId as keyof typeof planToPriceMap];

    console.log(`[API create-session] LOG: Mapeamento para checkout: planId='${planId}', priceId='${priceId ? priceId.slice(0, 10) + '...' : 'N/A'}'`);

    if (!priceId) {
      const errorMessage = `Erro de configuração do servidor: O Price ID do Stripe para o plano '${planId}' não foi encontrado.`;
      console.error(`[API create-session] ERRO: ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // valida existência e status do Price
    try {
      console.log(`[API create-session] LOG: Validando existência e status do Price ID no Stripe: ${priceId}`);
      const price = await stripe.prices.retrieve(priceId);
      console.log('[API create-session] LOG: Price validado com sucesso:', {
        id: price.id,
        active: price.active,
        livemode: price.livemode,
        currency: price.currency,
        unit_amount: price.unit_amount,
      });
      if (!price.active) {
        console.error(`[API create-session] ERRO CRÍTICO: o preço '${priceId}' está INATIVO no Stripe.`);
        return NextResponse.json(
          { error: 'O plano selecionado não está disponível no momento.' },
          { status: 400 }
        );
      }
    } catch (priceError: any) {
      console.error(`[API create-session] ERRO CRÍTICO: Falha ao validar Price '${priceId}':`, priceError);
      return NextResponse.json(
        {
          error: `O Price ID '${priceId}' configurado é inválido ou não existe no Stripe.`,
          details: priceError.message,
        },
        { status: 500 }
      );
    }

    // 4) Cliente Stripe
    const userRefDb = adminDb.ref(`users/${userId}`);
    const userSnapshot = await userRefDb.get();
    let stripeCustomerId: string | undefined = userSnapshot.val()?.stripeCustomerId;

    if (!stripeCustomerId) {
      console.log(`[API create-session] LOG: Cliente Stripe não encontrado no DB. Buscando na API com email: ${userEmail}`);
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
        console.log(`[API create-session] LOG: Cliente Stripe existente encontrado via API: ${stripeCustomerId}`);
      } else {
        console.log(`[API create-session] LOG: Criando novo cliente Stripe...`);
        const customer = await stripe.customers.create({
          email: userEmail,
          name: name || '',
          metadata: { firebaseUID: userId },
        });
        stripeCustomerId = customer.id;
        console.log(`[API create-session] LOG: Novo cliente Stripe criado: ${stripeCustomerId}`);
      }
      await userRefDb.update({ stripeCustomerId });
    } else {
      console.log(`[API create-session] LOG: Cliente Stripe existente encontrado no DB: ${stripeCustomerId}`);
    }

    // 5) Parâmetros da sessão
    const isSubscription = planId === 'plano_mensal';
    console.log(`[API create-session] LOG: O plano é uma assinatura? ${isSubscription}`);
    
    const metadata: Record<string, string> = {
      userId,
      planId,
      ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
      ...(selectedEditalId && { selectedEditalId }),
    };
    console.log('[API create-session] LOG: Metadados da sessão de checkout:', metadata);


    const appUrl = await getEnvOrSecret('NEXT_PUBLIC_APP_URL').catch(
      () => 'https://meuseditais.com.br'
    );
    const success_url = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${appUrl}/checkout/cancel`;
    console.log(`[API create-session] LOG: URLs de redirecionamento: success_url=${success_url}, cancel_url=${cancel_url}`);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: isSubscription ? 'subscription' : 'payment',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      metadata,
    };

    // Metadados também na ASSINATURA (ESSENCIAL p/ webhook)
    if (isSubscription) {
      sessionParams.subscription_data = {
        metadata: { userId, planId },
      };
       console.log('[API create-session] LOG: Adicionando metadados aos dados da assinatura:', sessionParams.subscription_data.metadata);
    }

    console.log('[API create-session] LOG: Criando sessão de checkout no Stripe...');
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[API create-session] SUCESSO: Sessão de checkout criada. ID: ${session.id}`);
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[API create-session] ERRO CRÍTICO NO HANDLER:', {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      rawMessage: error?.raw?.message,
      stack: error?.stack?.substring(0, 500),
    });
    return NextResponse.json(
      { error: error?.raw?.message || error?.message || 'Falha interna ao criar sessão de pagamento.' },
      { status: 500 }
    );
  }
}
