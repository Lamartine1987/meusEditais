
'use server';

import type { PlanId } from '@/types';
import Stripe from 'stripe';

// NOTA: A chave secreta do Stripe NUNCA deve ser exposta no frontend.
// Ela é lida aqui a partir das variáveis de ambiente do servidor.
// Certifique-se de ter STRIPE_SECRET_KEY definido no seu arquivo .env.local (para desenvolvimento)
// ou nas configurações de ambiente do seu servidor de produção.

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
    console.error("STRIPE_SECRET_KEY is not set. Ensure it's in your .env.local or production environment variables.");
    return { success: false, error: "Configuração do servidor de pagamento incompleta. Chave secreta não encontrada." };
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error("NEXT_PUBLIC_APP_URL is not set. Ensure it's in your .env.local or production environment variables.");
    return { success: false, error: "Configuração da URL da aplicação incompleta." };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    if (isNaN(priceInCents) || priceInCents < 50) { // Stripe BRL minimum is R$0.50
        console.error("Invalid price for checkout session:", priceInCents);
        return { success: false, error: "O valor do plano é inválido para processamento." };
    }

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
      mode: 'payment', // Para pagamentos únicos. Mude para 'subscription' se for implementar assinaturas recorrentes.
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
    let errorMessage = "Erro desconhecido ao processar pagamento.";
    if (error instanceof Stripe.errors.StripeError) {
        switch (error.type) {
            case 'StripeCardError':
                errorMessage = `Erro no cartão: ${error.message}`;
                break;
            case 'StripeInvalidRequestError':
                errorMessage = `Requisição inválida para o Stripe: ${error.message}`;
                break;
            // Adicione outros tipos de erro do Stripe conforme necessário
            default:
                errorMessage = `Erro no Stripe: ${error.message}`;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// --- MANUSEIO DE WEBHOOK (PRÓXIMO PASSO CRUCIAL PARA PRODUÇÃO) ---
// Você PRECISARÁ de um endpoint de webhook (ex: /api/webhooks/stripe/route.ts)
// para receber notificações do Stripe sobre o status do pagamento.
// Isso é ESSENCIAL para confirmar o pagamento e ATIVAR O PLANO do usuário no seu banco de dados.
//
// A estrutura básica do seu manipulador de webhook seria:
//
// import { headers } from 'next/headers';
// import { buffer } from 'node:stream/consumers';
// // import { stripe } from '@/lib/stripe'; // Sua instância Stripe, já configurada
// // import { AuthContext } // ou uma função de serviço para atualizar o plano do usuário
//
// export async function POST(req: Request) {
//   const body = await buffer(req.body!);
//   const sig = headers().get('stripe-signature') as string;
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // VOCÊ PRECISARÁ DE UM SEGREDO DE WEBHOOK DO STRIPE
//
//   let event: Stripe.Event;
//
//   try {
//     const stripeForWebhook = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
//     event = stripeForWebhook.webhooks.constructEvent(body, sig, webhookSecret);
//   } catch (err: any) {
//     console.error(\`Webhook signature verification failed: \${err.message}\`);
//     return new Response(\`Webhook Error: \${err.message}\`, { status: 400 });
//   }
//
//   // Handle the event
//   switch (event.type) {
//     case 'checkout.session.completed':
//       const session = event.data.object as Stripe.Checkout.Session;
//       const userId = session.metadata?.userId;
//       const planId = session.metadata?.planId as PlanId | undefined;
//
//       if (userId && planId && session.payment_status === 'paid') {
//         console.log(\`Pagamento bem-sucedido para usuário \${userId}, plano \${planId}. Ativar plano.\`);
//         // AQUI você chamaria a lógica para ATIVAR O PLANO no seu Firebase Realtime Database
//         // Exemplo:
//         // await activateUserPlanInDB(userId, planId, session); // Passe a sessão para obter mais detalhes se necessário
//       }
//       break;
//     // ... lidar com outros tipos de evento
//     default:
//       console.log(\`Unhandled event type \${event.type}\`);
//   }
//
//   return new Response(null, { status: 200 });
// }
//
// async function activateUserPlanInDB(userId: string, planId: PlanId, session: Stripe.Checkout.Session) {
//   // Lógica para buscar o usuário no DB, atualizar activePlan e planDetails
//   // similar ao que subscribeToPlan faz, mas diretamente no DB e acionado pelo webhook.
//   // const userRef = ref(db, \`users/\${userId}\`);
//   // const now = new Date();
//   // const newPlanDetails = {
//   //   planId,
//   //   startDate: formatISO(now),
//   //   expiryDate: formatISO(addDays(now, 365)), // ou 7 dias conforme o plano
//   //   stripeCheckoutSessionId: session.id, // Guarde o ID da sessão do Stripe
//   //   stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id, // Guarde o ID do cliente Stripe se aplicável
//   //   // ... outros detalhes relevantes
//   // };
//   // await update(userRef, { activePlan: planId, planDetails: newPlanDetails });
// }
//
// Você precisaria adicionar esta rota (ex: \`src/app/api/webhooks/stripe/route.ts\`)
// e configurar o endpoint no seu dashboard do Stripe, além de um \`STRIPE_WEBHOOK_SECRET\`
// nas suas variáveis de ambiente de produção.
    
    
