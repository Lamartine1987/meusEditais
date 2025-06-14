
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
    console.error("STRIPE_SECRET_KEY is not set. Ensure it's in your .env.local or environment variables.");
    return { success: false, error: "Configuração do servidor de pagamento incompleta. Chave secreta não encontrada." };
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error("NEXT_PUBLIC_APP_URL is not set. Ensure it's in your .env.local or environment variables.");
    return { success: false, error: "Configuração da URL da aplicação incompleta." };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20', 
  });
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

// --- Webhook Handling (Crucial Next Step) ---
// Você precisará de um endpoint de webhook (ex: /api/webhooks/stripe/route.ts)
// para receber notificações do Stripe sobre o status do pagamento.
// Isso é ESSENCIAL para confirmar o pagamento e ATIVAR O PLANO do usuário no seu banco de dados.
// 
// Exemplo de como seria a estrutura do webhook:
//
// import { headers } from 'next/headers';
// import { buffer } from 'node:stream/consumers';
// // import { stripe } from '@/lib/stripe'; // Sua instância do Stripe, já configurada em payment-actions.ts
// // import { AuthContext } from '@/contexts/auth-provider'; // Ou uma função de serviço separada
//
// export async function POST(req: Request) {
//   const body = await buffer(req.body!);
//   const sig = headers().get('stripe-signature') as string;
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // Você precisará de um webhook secret do Stripe
//
//   let event: Stripe.Event;
//
//   try {
//     // Stripe.webhooks.constructEvent precisa da instância do Stripe que foi inicializada com a API Key
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
//       const selectedCargoCompositeId = session.metadata?.selectedCargoCompositeId; // Se você passou
//       const selectedEditalId = session.metadata?.selectedEditalId; // Se você passou
//
//       if (userId && planId && session.payment_status === 'paid') {
//         console.log(\`Pagamento bem-sucedido para usuário \${userId}, plano \${planId}. Ativar plano.\`);
//         // AQUI você chamaria a lógica para ATIVAR O PLANO no seu Firebase Realtime Database
//         // Isso envolveria uma função similar à 'subscribeToPlan' do AuthProvider,
//         // mas adaptada para ser chamada pelo backend/webhook e interagir diretamente com o Firebase DB.
//         // Exemplo:
//         // await activateUserPlanInDB(userId, planId, {
//         //   selectedCargoCompositeId: planId === 'plano_cargo' ? selectedCargoCompositeId : undefined,
//         //   selectedEditalId: planId === 'plano_edital' ? selectedEditalId : undefined,
//         // });
//       }
//       break;
//     // ... handle other event types como 'invoice.payment_succeeded' se usar assinaturas recorrentes
//     default:
//       console.log(\`Unhandled event type \${event.type}\`);
//   }
//
//   return new Response(null, { status: 200 });
// }
//
// Para a função activateUserPlanInDB (exemplo):
// async function activateUserPlanInDB(userId: string, planId: PlanId, details: { selectedCargoCompositeId?: string; selectedEditalId?: string }) {
//   // Lógica para buscar o usuário no DB, atualizar activePlan e planDetails
//   // similar ao que subscribeToPlan faz, mas diretamente no DB.
//   // Ex:
//   // const userRef = ref(db, \`users/\${userId}\`);
//   // const now = new Date();
//   // const newPlanDetails = {
//   //   planId,
//   //   startDate: formatISO(now),
//   //   expiryDate: formatISO(addDays(now, 365)), // ou 7 dias conforme o plano
//   //   ...details
//   // };
//   // await update(userRef, { activePlan: planId, planDetails: newPlanDetails });
// }
//
// Você precisaria adicionar essa rota no seu \`src/app/api/webhooks/stripe/route.ts\` (ou similar)
// e configurar o endpoint no seu dashboard do Stripe, além de um \`STRIPE_WEBHOOK_SECRET\`
// em suas variáveis de ambiente.
    
    
