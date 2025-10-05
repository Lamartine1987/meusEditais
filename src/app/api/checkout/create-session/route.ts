
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { getEnvOrSecret } from '@/lib/secrets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getPlanToPriceMap(): Promise<Record<string, string>> {
    console.log('[API getPlanToPriceMap] Lendo Price IDs...');
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
        // 1. Autenticação e Validação do Usuário
        const authHeader = headers().get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[API create-session] Erro: Token de autorização ausente.');
            return NextResponse.json({ error: 'Token de autorização ausente.' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const { uid: userId, email: userEmail } = decodedToken;
        console.log(`[API create-session] Token verificado. UID: ${userId}`);

        if (!userId || !userEmail) {
            return NextResponse.json({ error: 'Informações do usuário inválidas no token.' }, { status: 401 });
        }

        // 2. Validação do Corpo da Requisição
        const body = await req.json();
        const { planId, selectedCargoCompositeId, selectedEditalId } = body;
        console.log('[API create-session] Corpo da requisição:', body);

        if (!planId || planId === 'plano_trial') {
            return NextResponse.json({ error: 'planId é obrigatório e não pode ser plano_trial.' }, { status: 400 });
        }

        // 3. Configuração do Stripe e Preço
        const stripe = await getStripeClient();
        const planToPriceMap = await getPlanToPriceMap();
        const priceId = planToPriceMap[planId as keyof typeof planToPriceMap];
        
        if (!priceId) {
            const errorMessage = `Erro de configuração: Price ID do Stripe para o plano '${planId}' não encontrado.`;
            console.error(`[API create-session] ${errorMessage}`);
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
        console.log(`[API create-session] Mapeamento: planId='${planId}' -> priceId='${priceId.slice(0, 10)}...'`);

        // 4. Criação/Busca do Cliente Stripe
        const userRefDb = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userRefDb.get();
        let stripeCustomerId = userSnapshot.val()?.stripeCustomerId;
        
        if (!stripeCustomerId) {
            const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });
            if (existingCustomers.data.length > 0) {
                stripeCustomerId = existingCustomers.data[0].id;
                console.log(`[API create-session] Cliente Stripe existente encontrado via API: ${stripeCustomerId}`);
            } else {
                const customer = await stripe.customers.create({ email: userEmail, name: decodedToken.name, metadata: { firebaseUID: userId } });
                stripeCustomerId = customer.id;
                console.log(`[API create-session] Novo cliente Stripe criado: ${stripeCustomerId}`);
            }
            await userRefDb.update({ stripeCustomerId });
        } else {
            console.log(`[API create-session] Cliente Stripe existente no DB: ${stripeCustomerId}`);
        }

        // 5. Construção dos Parâmetros da Sessão
        const isSubscription = planId === 'plano_mensal';
        const appUrl = await getEnvOrSecret('NEXT_PUBLIC_APP_URL').catch(() => 'https://meuseditais.com.br');
        
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            mode: isSubscription ? 'subscription' : 'payment',
            customer: stripeCustomerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/checkout/cancel`,
            metadata: {
                userId, // Sempre incluir userId nos metadados da sessão
                planId,
                ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
                ...(selectedEditalId && { selectedEditalId }),
            },
        };
        
        // **CORREÇÃO CRÍTICA**: Adicionar metadados à assinatura para que o webhook possa acessá-los
        if (isSubscription) {
            sessionParams.subscription_data = {
                metadata: { userId, planId },
            };
        }

        console.log('[API create-session] Parâmetros da sessão de checkout:', JSON.stringify(sessionParams, null, 2));

        // 6. Criação da Sessão
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
        return NextResponse.json({ error: error?.raw?.message || error?.message || 'Falha interna ao criar sessão de pagamento.' }, { status: 500 });
    }
}
