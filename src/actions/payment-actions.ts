
'use server';

import type { PlanId } from '@/types';
import Stripe from 'stripe';

// NOTA: A chave secreta do Stripe NUNCA deve ser exposta no frontend.
// Ela é lida aqui a partir das variáveis de ambiente do servidor.
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
    console.error("STRIPE_SECRET_KEY is not set. Ensure it's in your .env.local or environment variables.");
    return { success: false, error: "Configuração do servidor de pagamento incompleta. Chave secreta não encontrada." };
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error("NEXT_PUBLIC_APP_URL is not set. Ensure it's in your .env.local or environment variables.");
    return { success: false, error: "Configuração da URL da aplicação incompleta." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Verificar se priceInCents é um número válido e maior que um valor mínimo (ex: 50 centavos = R$0,50)
    // Stripe tem valores mínimos de transação. Para BRL, o mínimo geralmente é R$0.50.
    if (isNaN(priceInCents) || priceInCents < 50) {
        console.error("Preço inválido para a sessão de checkout:", priceInCents);
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
      mode: 'payment', // Para pagamentos únicos. Use 'subscription' para planos recorrentes.
      success_url: `${appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/${planId}?payment_cancelled=true`, // Volta para a página de checkout do plano específico
      customer_email: userEmail, 
      client_reference_id: userId, // Útil para reconciliação
      metadata: { // Metadados que você pode precisar no webhook
        userId: userId,
        planId: planId,
        // Adicione aqui outros metadados relevantes, como selectedCargoCompositeId ou selectedEditalId
        // selectedCargoCompositeId: args.planId === 'plano_cargo' ? user?.planDetails?.selectedCargoCompositeId : undefined,
        // selectedEditalId: args.planId === 'plano_edital' ? user?.planDetails?.selectedEditalId : undefined,
      }
    });

    if (!session.url) {
      // Isso não deveria acontecer se a criação da sessão for bem-sucedida, mas é uma boa verificação.
      return { success: false, error: "Falha ao obter URL de checkout do Stripe." };
    }

    return { success: true, checkoutUrl: session.url, sessionId: session.id };

  } catch (error: any) {
    console.error("Erro ao criar sessão de checkout Stripe:", error);
    // Verificar se o erro é uma Stripe.StripeError e formatar a mensagem
    let errorMessage = "Erro desconhecido ao processar pagamento.";
    if (error instanceof Stripe.errors.StripeError) {
        switch (error.type) {
            case 'StripeCardError':
                errorMessage = `Erro no cartão: ${error.message}`;
                break;
            case 'StripeInvalidRequestError':
                errorMessage = `Requisição inválida para o Stripe: ${error.message}`;
                break;
            case 'StripeAPIError':
                errorMessage = `Erro na API do Stripe: ${error.message}`;
                break;
            case 'StripeConnectionError':
                errorMessage = `Erro de conexão com o Stripe: ${error.message}`;
                break;
            case 'StripeAuthenticationError':
                errorMessage = `Erro de autenticação com o Stripe: ${error.message}. Verifique sua chave de API.`;
                break;
            default:
                errorMessage = `Erro no Stripe: ${error.message}`;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// --- Webhook Handling (Crucial Next Step - Not Implemented Here) ---
// Você precisará de um endpoint de webhook (ex: /api/webhooks/stripe/route.ts)
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
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // Você precisará de um webhook secret do Stripe
//
//   let event: Stripe.Event;
//
//   try {
//     event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
//   } catch (err: any) {
//     console.error(`Webhook signature verification failed: ${err.message}`);
//     return new Response(\`Webhook Error: \${err.message}\`, { status: 400 });
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
//         // Exemplo: await subscribeUserToPlan(userId, planId, {
//         //   startDate: new Date().toISOString(),
//         //   expiryDate: calculateExpiryDate(new Date(), planId), // Implementar calculateExpiryDate
//         //   selectedCargoCompositeId: planId === 'plano_cargo' ? session.metadata.selectedCargoCompositeId : undefined,
//         //   selectedEditalId: planId === 'plano_edital' ? session.metadata.selectedEditalId : undefined,
//         // });
//         console.log(\`Pagamento bem-sucedido para usuário \${userId}, plano \${planId}. Ativar plano.\`);
//         // Lógica para registrar que o plano foi pago e ativar os recursos para o usuário.
//         // Isso envolveria chamar a função \`subscribeToPlan\` do seu AuthProvider
//         // (ou uma versão dela adaptada para ser chamada pelo backend)
//         // Certifique-se de que sua função subscribeToPlan possa ser chamada aqui,
//         // ou crie uma nova função de backend para lidar com a atualização do plano.
//       }
//       break;
//     // ... handle other event types
//     default:
//       console.log(\`Unhandled event type \${event.type}\`);
//   }
//
//   return new Response(null, { status: 200 });
// }
//
// Você precisaria adicionar essa rota no seu \`src/app/api/webhooks/stripe/route.ts\` (ou similar)
// e configurar o endpoint no seu dashboard do Stripe.
// A função \`subscribeToPlan\` do AuthProvider precisaria ser adaptada ou uma nova função
// criada para ser chamada pelo webhook para atualizar o banco de dados do Firebase.
// Também será necessário um \`STRIPE_WEBHOOK_SECRET\` em suas variáveis de ambiente.
    
    