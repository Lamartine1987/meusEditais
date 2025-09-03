
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { getEnvOrSecret } from '@/lib/secrets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getPlanToPriceMap(): Promise<Record<Exclude<PlanId, 'plano_trial'>, string>> {
    console.log('[API getPlanToPriceMap] Lendo Price IDs dos segredos...');
    const priceMap = {
      plano_cargo: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_CARGO'),
      plano_edital: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_EDITAL'),
      plano_mensal: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_MENSAL_RECORRENTE'),
    };
    console.log(`[API getPlanToPriceMap] Price IDs carregados: Cargo=${!!priceMap.plano_cargo}, Edital=${!!priceMap.plano_edital}, Mensal=${!!priceMap.plano_mensal}`);
    return priceMap;
};

export async function POST(req: NextRequest) {
    console.log('[API create-session] Recebida requisição POST.');
    try {
        const authHeader = headers().get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[API create-session] Erro de Autenticação: Token de autorização ausente ou malformado.');
            return NextResponse.json({ error: 'Token de autorização ausente.' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];

        console.log('[API create-session] Verificando token do Firebase...');
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;
        console.log(`[API create-session] Token verificado. UID: ${userId}, Email: ${userEmail}`);

        if (!userId || !userEmail) {
             console.error(`[API create-session] Erro Crítico: UID ou email ausente no token decodificado. UID: ${userId}`);
            return NextResponse.json({ error: 'Informações do usuário inválidas no token.' }, { status: 401 });
        }

        const body = await req.json();
        const { planId, selectedCargoCompositeId, selectedEditalId } = body;
        console.log('[API create-session] Corpo da requisição recebido:', body);

        if (!planId || planId === 'plano_trial') {
            console.error('[API create-session] Erro de Validação: planId ausente ou inválido no corpo da requisição.');
            return NextResponse.json({ error: 'planId é obrigatório e não pode ser plano_trial.' }, { status: 400 });
        }

        const stripe = await getStripeClient();
        
        const planToPriceMap = await getPlanToPriceMap();
        const priceId = planToPriceMap[planId as keyof typeof planToPriceMap];
        
        console.log(`[API create-session] Mapeamento para checkout: planId='${planId}', priceId='${priceId ? priceId.slice(0,10) + '...' : 'N/A'}'`);

        if (!priceId) {
             const errorMessage = `Erro de configuração do servidor: O Price ID do Stripe para o plano '${planId}' não foi encontrado.`;
             console.error(`[API create-session] ${errorMessage}`);
             return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        try {
            console.log(`[API create-session] Validando existência e status do Price ID no Stripe: ${priceId}`);
            const price = await stripe.prices.retrieve(priceId);
            console.log('[API create-session] Price validado com sucesso:', { id: price.id, active: price.active, livemode: price.livemode, currency: price.currency, unit_amount: price.unit_amount });
            if (!price.active) {
                console.error(`[API create-session] ERRO CRÍTICO: O preço com ID '${priceId}' está INATIVO no Stripe.`);
                return NextResponse.json({ error: `O plano selecionado não está mais disponível para compra. Por favor, contate o suporte.` }, { status: 400 });
            }
        } catch (priceError: any) {
            console.error(`[API create-session] ERRO CRÍTICO: Falha ao validar o Price ID '${priceId}' com o Stripe.`, priceError);
            return NextResponse.json({ error: `O Price ID '${priceId}' configurado no servidor é inválido ou não existe no Stripe.`, details: priceError.message }, { status: 500 });
        }


        let stripeCustomerId: string | undefined;
        const userRefDb = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userRefDb.get();
        const userData = userSnapshot.val();
        
        if (userData && userData.stripeCustomerId) {
            stripeCustomerId = userData.stripeCustomerId;
            console.log(`[API create-session] Cliente Stripe existente encontrado no DB: ${stripeCustomerId}`);
        } else {
             console.log(`[API create-session] Verificando se já existe cliente Stripe com o email: ${userEmail}`);
             const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });
            if (existingCustomers.data.length > 0) {
                stripeCustomerId = existingCustomers.data[0].id;
                console.log(`[API create-session] Cliente Stripe existente encontrado via API: ${stripeCustomerId}`);
            } else {
                console.log(`[API create-session] Criando novo cliente Stripe para email: ${userEmail}`);
                const customer = await stripe.customers.create({ email: userEmail, metadata: { firebaseUID: userId } });
                stripeCustomerId = customer.id;
                console.log(`[API create-session] Novo cliente Stripe criado: ${stripeCustomerId}`);
            }
             console.log(`[API create-session] Atualizando DB do Firebase com o stripeCustomerId: ${stripeCustomerId}`);
             await userRefDb.update({ stripeCustomerId });
        }

        const isSubscription = planId === 'plano_mensal';
        console.log(`[API create-session] O plano é uma assinatura? ${isSubscription}`);
        
        const metadata = {
            userId,
            planId,
            ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
            ...(selectedEditalId && { selectedEditalId }),
        };
        console.log('[API create-session] Metadados da sessão:', metadata);

        const appUrl = await getEnvOrSecret('NEXT_PUBLIC_APP_URL').catch(() => 'https://meuseditais.com.br');
        const success_url = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancel_url = `${appUrl}/checkout/cancel`;
        console.log(`[API create-session] URLs de redirecionamento: success_url=${success_url}, cancel_url=${cancel_url}`);
        
        const sessionParams: any = {
            payment_method_types: ['card'],
            mode: isSubscription ? 'subscription' : 'payment',
            customer: stripeCustomerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: success_url,
            cancel_url: cancel_url,
            metadata: metadata,
        };

        if (isSubscription) {
            sessionParams.subscription_data = {
                metadata: { userId }, // Passa o userId para o objeto de assinatura também
            };
        }

        console.log('[API create-session] Criando sessão de checkout no Stripe...');
        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`[API create-session] SUCESSO: Sessão de checkout criada. ID: ${session.id}, URL: ${session.url}`);
        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('[API create-session] ERRO CRÍTICO NO HANDLER:', {
            message: error?.message,
            type: error?.type,
            code: error?.code,
            rawMessage: error?.raw?.message,
            stack: error?.stack?.substring(0, 500),
        });
        return NextResponse.json({ error: error?.raw?.message || error?.message || 'Falha interna ao criar sessão de pagamento.' }, { status: 500 });
    }
}
