
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
      client_reference_id: userId, // Útil para reconciliação, mas não usado diretamente para buscar usuário aqui.
      metadata: { // ESSENCIAL para o webhook identificar o usuário e o plano comprado.
        userId: userId,
        planId: planId,
        // Você pode adicionar outros metadados aqui, se necessário.
        // Ex: selectedCargoCompositeId: args.selectedCargoCompositeId (se aplicável e passado para esta função)
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

// --- MANUSEIO DE WEBHOOK (IMPLEMENTADO EM /src/app/api/webhooks/stripe/route.ts) ---
//
// O endpoint de webhook em '/src/app/api/webhooks/stripe/route.ts' é agora responsável por:
// 1. Receber eventos do Stripe (especialmente 'checkout.session.completed').
// 2. Verificar a assinatura do webhook usando o 'STRIPE_WEBHOOK_SECRET'.
// 3. Se o pagamento for bem-sucedido:
//    a. Extrair 'userId' e 'planId' dos metadados da sessão.
//    b. Chamar a função 'activateUserPlanInDB' (de '@/actions/user-plan-actions')
//       para atualizar o status da assinatura do usuário no Firebase Realtime Database.
//
// Você precisará:
// 1. Criar um endpoint de webhook no seu Stripe Dashboard.
//    - URL do endpoint: `https://SUA_URL_DE_PRODUCAO/api/webhooks/stripe`
//    - Eventos para escutar: Pelo menos `checkout.session.completed`.
// 2. Obter o "Segredo do endpoint" (Signing secret) do Stripe para este endpoint.
// 3. Configurar a variável de ambiente `STRIPE_WEBHOOK_SECRET` no seu ambiente de produção
//    (no arquivo `apphosting.production.yaml`, idealmente via Google Secret Manager)
//    e no seu `.env.local` para testes locais com a Stripe CLI
//    (ex: `STRIPE_WEBHOOK_SECRET=whsec_...`).
//
// Para testar webhooks localmente com a Stripe CLI:
//    stripe listen --forward-to localhost:PORTA/api/webhooks/stripe
//    (substitua PORTA pela porta do seu servidor de desenvolvimento, ex: 9002)
//    A CLI fornecerá um segredo de webhook de teste (whsec_...) para usar no seu .env.local.
