// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { buffer } from 'node:stream/consumers';
import Stripe from 'stripe';
import { activateUserPlanInDB } from '@/actions/user-plan-actions';
import type { PlanId } from '@/types';

// O segredo do endpoint do webhook (você obterá do Stripe Dashboard)
// Para produção, defina esta variável de ambiente no seu Firebase App Hosting.
// Para testes locais com a Stripe CLI, defina em .env.local
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20', // Certifique-se de que corresponde à sua versão da API Stripe
});

export async function POST(req: Request) {
  const sig = headers().get('stripe-signature');
  const body = await buffer(req.body!);

  let event: Stripe.Event;

  try {
    if (!sig) {
      console.error('⚠️  Nenhum cabeçalho stripe-signature encontrado.');
      return NextResponse.json({ error: 'Nenhum cabeçalho stripe-signature encontrado.' }, { status: 400 });
    }
    if (!endpointSecret) {
      console.error('⚠️  Segredo do webhook não configurado. Defina a variável de ambiente STRIPE_WEBHOOK_SECRET.');
      return NextResponse.json({ error: 'Segredo do webhook não configurado.' }, { status: 500 });
    }
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Erro ao construir evento: ${err.message}`);
    return NextResponse.json({ error: `Erro no Webhook: ${err.message}` }, { status: 400 });
  }

  // Lidar com o evento
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Sessão de checkout concluída:', session.id);

      // Recuperar metadados
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId as PlanId | undefined;

      if (session.payment_status === 'paid') {
        if (userId && planId) {
          console.log(`✅ Pagamento para sessão ${session.id} bem-sucedido. ID do Usuário: ${userId}, ID do Plano: ${planId}`);
          try {
            await activateUserPlanInDB(userId, planId, session);
            console.log(`🚀 Plano ${planId} ativado para o usuário ${userId}.`);
          } catch (dbError: any) {
            console.error(`Falha ao ativar plano para o usuário ${userId}: ${dbError.message}`);
            // Opcionalmente, você pode tentar novamente ou registrar para intervenção manual
            return NextResponse.json({ error: 'Falha na atualização do banco de dados após o pagamento.' }, { status: 500 });
          }
        } else {
          console.error(`⚠️  userId ou planId ausente nos metadados da sessão ${session.id}. Não é possível ativar o plano.`);
        }
      } else {
        console.log(`Sessão de checkout ${session.id} concluída, mas o status do pagamento é ${session.payment_status}.`);
      }
      break;
    // ... lidar com outros tipos de evento, se necessário (ex: payment_intent.succeeded, etc.)
    default:
      console.log(`🤷‍♀️ Tipo de evento não tratado ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
