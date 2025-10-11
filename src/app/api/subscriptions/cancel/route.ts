
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { PlanDetails } from '@/types';

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
    
    const currentActivePlans: PlanDetails[] = userData.activePlans || [];
    const planIndex = currentActivePlans.findIndex((p: any) => p.stripeSubscriptionId === subscriptionId);
    
    if (planIndex === -1) {
      return NextResponse.json({ error: 'Assinatura não encontrada para este usuário.' }, { status: 404 });
    }

    const stripe = await getStripeClient();
    
    // 1. Agenda o cancelamento no Stripe
    const cancelledSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    // 2. Atualiza o status no banco de dados IMEDIATAMENTE
    const updatedPlan: PlanDetails = {
      ...currentActivePlans[planIndex],
      status: 'canceled', // Define o status como cancelado
      // O expiryDate já está correto (fim do período atual), então não precisa ser alterado aqui.
    };

    const finalActivePlans = [...currentActivePlans];
    finalActivePlans[planIndex] = updatedPlan;

    await userRef.update({ activePlans: finalActivePlans });

    console.log(`[API /subscriptions/cancel] Cancelamento agendado para a assinatura ${subscriptionId} e status atualizado no DB.`);

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
