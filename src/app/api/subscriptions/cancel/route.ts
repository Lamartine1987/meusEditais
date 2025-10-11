
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('[API /subscriptions/cancel] Recebida requisição POST.');
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorização ausente.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { subscriptionId } = await req.json();
    if (!subscriptionId) {
      return NextResponse.json({ error: 'ID da assinatura é obrigatório.' }, { status: 400 });
    }

    const userRef = adminDb.ref(`users/${userId}`);
    const snapshot = await userRef.get();
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }
    const userData = snapshot.val();
    
    const plan = userData.activePlans?.find((p: any) => p.stripeSubscriptionId === subscriptionId);
    if (!plan) {
      return NextResponse.json({ error: 'Assinatura não encontrada para este usuário.' }, { status: 404 });
    }

    const stripe = await getStripeClient();
    
    // O cancelamento é agendado para o fim do período de cobrança.
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    // O webhook 'customer.subscription.updated' irá lidar com a atualização do status no DB.
    // Apenas confirmamos que a solicitação foi enviada.
    console.log(`[API /subscriptions/cancel] Cancelamento agendado para a assinatura ${subscriptionId} do usuário ${userId}.`);

    return NextResponse.json({ success: true, message: 'Cancelamento da assinatura agendado com sucesso.' });

  } catch (error: any) {
    console.error('[API /subscriptions/cancel] ERRO CRÍTICO:', {
      message: error?.message,
      type: error?.type,
      stack: error?.stack?.substring(0, 500),
    });
    return NextResponse.json(
      { error: error?.message || 'Falha interna ao cancelar a assinatura.' },
      { status: 500 }
    );
  }
}
