
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getPlanToPriceMap = (): Record<PlanId, string | undefined> => {
    console.log('[API create-session] Lendo Price IDs das variáveis de ambiente do servidor...');
    const priceMap = {
      plano_cargo: process.env.STRIPE_PRICE_ID_PLANO_CARGO,
      plano_edital: process.env.STRIPE_PRICE_ID_PLANO_EDITAL,
      plano_anual: process.env.STRIPE_PRICE_ID_PLANO_ANUAL,
      plano_trial: undefined,
    };
    console.log(`[API create-session] Price IDs carregados: Cargo=${!!priceMap.plano_cargo}, Edital=${!!priceMap.plano_edital}, Anual=${!!priceMap.plano_anual}`);
    return priceMap;
};

export async function POST(req: NextRequest) {
    console.log('[API create-session] Recebida requisição POST.');
    try {
        const authHeader = headers().get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[API create-session] Erro: Token de autorização ausente ou malformado.');
            return NextResponse.json({ error: 'Token de autorização ausente.' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];

        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        if (!userId || !userEmail) {
             console.error(`[API create-session] Erro: UID ou email ausente no token decodificado. UID: ${userId}`);
            return NextResponse.json({ error: 'Informações do usuário inválidas no token.' }, { status: 401 });
        }

        const body = await req.json();
        const { planId, selectedCargoCompositeId, selectedEditalId } = body;

        if (!planId) {
            console.error('[API create-session] Erro: planId ausente no corpo da requisição.');
            return NextResponse.json({ error: 'planId é obrigatório.' }, { status: 400 });
        }

        const stripe = getStripeClient();
        const planToPriceMap = getPlanToPriceMap();
        const priceId = planToPriceMap[planId as PlanId];

        if (!priceId || priceId.trim() === '') {
            const errorMessage = `Erro de configuração: O Price ID do Stripe para o plano '${planId}' não foi carregado do ambiente do servidor.`;
            console.error(`[API create-session] ${errorMessage}`);
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        let stripeCustomerId: string | undefined;
        const userRefDb = adminDb.ref(`users/${userId}`);
        const userSnapshot = await userRefDb.get();
        const userData = userSnapshot.val();
        
        if (userData && userData.stripeCustomerId) {
            stripeCustomerId = userData.stripeCustomerId;
            console.log(`[API create-session] Cliente Stripe existente encontrado no DB: ${stripeCustomerId}`);
        } else {
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
             await userRefDb.update({ stripeCustomerId });
        }

        const metadata = {
            userId,
            planId,
            ...(selectedCargoCompositeId && { selectedCargoCompositeId }),
            ...(selectedEditalId && { selectedEditalId }),
        };

        const origin = headers().get('origin') || 'https://fallback-url.com';
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer: stripeCustomerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/checkout/cancel`,
            metadata: metadata,
        });

        console.log(`[API create-session] Sessão de checkout criada com sucesso. ID: ${session.id}`);
        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('[API create-session] ERRO CRÍTICO TIPO:', error?.type);
        console.error('[API create-session] ERRO CRÍTICO CÓDIGO:', error?.code);
        console.error('[API create-session] ERRO CRÍTICO MENSAGEM:', error?.message || error?.raw?.message || String(error));
        return NextResponse.json({ error: 'Falha interna ao criar sessão de pagamento.', details: error.message }, { status: 500 });
    }
}
