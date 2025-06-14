
'use server';

import type { PlanId } from '@/types';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20', 
});

interface CreateCheckoutSessionArgs {
  planId: PlanId;
  planName: string;
  priceInCents: number;
  userEmail: string;
  userId: string;
}

interface CreateCheckoutSessionResult {
  success: boolean;
  checkoutUrl?: string | null; 
  sessionId?: string; 
  error?: string;
  message?: string; 
}

export async function createCheckoutSession(
  args: CreateCheckoutSessionArgs
): Promise<CreateCheckoutSessionResult> {
  const { planId, planName, priceInCents, userEmail, userId } = args;

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set.");
    return { success: false, error: "Configuração do servidor de pagamento incompleta." };
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error("NEXT_PUBLIC_APP_URL is not set.");
    return { success: false, error: "Configuração da URL da aplicação incompleta." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl', 
            product_data: {
              name: planName,
              description: `Assinatura do ${planName}`,
            },
            unit_amount: priceInCents, 
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // Use 'subscription' for recurring plans
      success_url: `${appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/${planId}?payment_cancelled=true`,
      customer_email: userEmail, 
      client_reference_id: userId, 
      metadata: { 
        userId: userId,
        planId: planId,
      }
    });

    if (!session.url) {
      return { success: false, error: "Falha ao obter URL de checkout do Stripe." };
    }

    return { success: true, checkoutUrl: session.url, sessionId: session.id };

  } catch (error: any) {
    console.error("Erro ao criar sessão de checkout Stripe:", error);
    return { success: false, error: error.message || "Erro desconhecido ao processar pagamento." };
  }
}

// --- Webhook Handling (Crucial Next Step - Not Implemented Here) ---
// Você precisará de um endpoint de webhook (ex: /api/webhooks/stripe)
// para receber notificações do Stripe sobre o status do pagamento.
//
// Exemplo de como seria a estrutura do webhook:
//
// import { headers } from 'next/headers';
// import { buffer } from 'node:stream/consumers';
// // import { stripe } from '@/lib/stripe'; // Sua instância do Stripe
// // import { subscribeUserToPlan } from '@/path/to/your/subscriptionLogic'; // Função para atualizar o DB
//
// export async function POST(req: Request) {
//   const body = await buffer(req.body!);
//   const sig = headers().get('stripe-signature') as string;
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
//
//   let event: Stripe.Event;
//
//   try {
//     event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
//   } catch (err: any) {
//     console.error(`Webhook signature verification failed: ${err.message}`);
//     return new Response(`Webhook Error: ${err.message}`, { status: 400 });
//   }
//
//   // Handle the event
//   switch (event.type) {
//     case 'checkout.session.completed':
//       const session = event.data.object as Stripe.Checkout.Session;
//       // Retrieve userId and planId from metadata
//       const userId = session.metadata?.userId;
//       const planId = session.metadata?.planId as PlanId | undefined;
//
//       if (userId && planId && session.payment_status === 'paid') {
//         // Chame a função para atualizar o plano do usuário no seu banco de dados
//         // await subscribeUserToPlan(userId, planId, {
//         //   startDate: new Date().toISOString(),
//         //   expiryDate: calculateExpiryDate(new Date(), planId), // Implementar calculateExpiryDate
//         //   selectedCargoCompositeId: planId === 'plano_cargo' ? session.metadata.selectedCargoCompositeId : undefined,
//         //   selectedEditalId: planId === 'plano_edital' ? session.metadata.selectedEditalId : undefined,
//         // });
//         console.log(`Pagamento bem-sucedido para usuário ${userId}, plano ${planId}. Ativar plano.`);
//         // Lógica para registrar que o plano foi pago e ativar os recursos para o usuário.
//         // Isso envolveria chamar a função `subscribeToPlan` do seu AuthProvider
//         // (ou uma versão dela adaptada para ser chamada pelo backend)
//       }
//       break;
//     // ... handle other event types
//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }
//
//   return new Response(null, { status: 200 });
// }
//
// Você precisaria adicionar essa rota no seu `src/app/api/webhooks/stripe/route.ts` (ou similar)
// e configurar o endpoint no seu dashboard do Stripe.
// A função `subscribeToPlan` do AuthProvider precisaria ser adaptada ou uma nova função
// criada para ser chamada pelo webhook para atualizar o banco de dados do Firebase.
