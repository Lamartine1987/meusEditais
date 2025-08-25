
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { PlanId } from '@/types';
import { headers } from 'next/headers';
import { getEnvOrSecret } from '@/lib/secrets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getPlanToPriceMap(): Promise<Record<Exclude<PlanId, 'plano_trial'>, string>> {
    return {
      plano_cargo: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_CARGO'),
      plano_edital: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_EDITAL'),
      plano_anual: await getEnvOrSecret('STRIPE_PRICE_ID_PLANO_ANUAL'),
    };
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

        if (!planId || planId === 'plano_trial') {
            console.error('[API create-session] Erro: planId ausente ou inválido no corpo da requisição.');
            return NextResponse.json({ error: 'planId é obrigatório e não pode ser plano_trial.' }, { status: 400 });
        }

        const stripe = await getStripeClient();
        
        const planToPriceMap = await getPlanToPriceMap();
        const priceId = planToPriceMap[planId as keyof typeof planToPriceMap];
        
        console.log(`[API create-session] Mapeamento para checkout: planId='${planId}', priceId='${priceId ? priceId.slice(0,10) + '...' : 'N/A'}'`);

        const price = await stripe.prices.retrieve(priceId);
        console.log('[API create-session] Price validado:', { id: price.id, livemode: price.livemode });


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

        const appUrl = await getEnvOrSecret('NEXT_PUBLIC_APP_URL').catch(() => 'https://meuseditais.com.br');
        const success_url = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancel_url = `${appUrl}/checkout/cancel`;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer: stripeCustomerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: success_url,
            cancel_url: cancel_url,
            metadata: metadata,
        });

        console.log(`[API create-session] Sessão de checkout criada com sucesso. ID: ${session.id}`);
        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('[API create-session] ERRO CRÍTICO:', {
            message: error?.message,
            type: error?.type,
            code: error?.code,
            raw: error?.raw?.message,
            stack: error?.stack?.substring(0, 300),
        });
        return NextResponse.json({ error: error?.raw?.message || error?.message || 'Falha interna ao criar sessão de pagamento.' }, { status: 500 });
    }
}
