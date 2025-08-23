
import Stripe from 'stripe';

let stripeClientInstance: Stripe | null = null;

// Esta função deve ser chamada apenas no lado do servidor (ex: em Server Actions ou rotas de API)
export function getStripeClient(): Stripe {
  // Garante que este código só execute no lado do servidor.
  if (typeof window !== 'undefined') {
    const errorMessage = '[stripe.ts] ERRO CRÍTICO: Tentativa de criar cliente Stripe no lado do cliente.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  console.log(`[stripe.ts] Tentando inicializar o Stripe. Chave secreta presente: ${!!secretKey}`);

  if (!secretKey || secretKey.trim() === '') {
    const errorMessage = "[stripe.ts] ERRO CRÍTICO: A variável de ambiente STRIPE_SECRET_KEY não está disponível no servidor. Verifique o apphosting.yaml e os segredos no App Hosting.";
    console.error(errorMessage);
    throw new Error('A chave secreta do Stripe não está configurada no servidor. Verifique os logs do servidor.');
  }

  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    console.log("[stripe.ts] Instância do cliente Stripe criada com sucesso em runtime.");
  } else {
    console.log("[stripe.ts] Usando instância existente do cliente Stripe.");
  }
  
  return stripeClientInstance;
}
