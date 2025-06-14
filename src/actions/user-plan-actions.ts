// src/actions/user-plan-actions.ts
'use server';

import type { PlanId, PlanDetails } from '@/types';
import { db } from '@/lib/firebase';
import { ref, update, get } from "firebase/database";
import { formatISO, addDays } from 'date-fns';
import type Stripe from 'stripe';

export async function activateUserPlanInDB(
  userId: string,
  planId: PlanId,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (!userId || !planId) {
    throw new Error('ID do Usuário e ID do Plano são necessários para ativar o plano.');
  }

  const userRef = ref(db, `users/${userId}`);

  try {
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      // Isso não deveria acontecer se o userId veio de um usuário logado que iniciou o checkout
      console.error(`Usuário com ID ${userId} não encontrado no banco de dados. Tentando criar um registro básico.`);
      // Poderia-se optar por criar um usuário aqui, mas idealmente ele já existe.
      // Por ora, vamos lançar um erro mais específico ou logar para investigação.
      // Se você espera que usuários possam pagar sem estarem totalmente registrados no seu DB ainda,
      // precisaria de lógica para criar o usuário aqui.
      throw new Error(`Usuário com ID ${userId} não encontrado no banco de dados.`);
    }

    const now = new Date();
    const newStartDate = formatISO(now);
    const newExpiryDate = formatISO(addDays(now, 365)); // Todos os planos são de 1 ano

    const newPlanDetails: PlanDetails = {
      planId: planId,
      startDate: newStartDate,
      expiryDate: newExpiryDate,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      // selectedCargoCompositeId e selectedEditalId serão definidos pelo usuário via UI, se aplicável,
      // após a ativação básica do plano.
    };

    const updates: Partial<{ activePlan: PlanId | null; planDetails: PlanDetails | null }> = {
      activePlan: planId,
      planDetails: newPlanDetails,
    };

    await update(userRef, updates);
    console.log(`Plano ${planId} ativado com sucesso para o usuário ${userId} no BD. Sessão de checkout: ${session.id}`);

  } catch (error: any) {
    console.error(`Erro ao ativar plano ${planId} para o usuário ${userId} no BD:`, error);
    // É importante lidar com este erro. Se o DB falhar, o usuário pagou mas não tem acesso.
    // Pode ser necessário um sistema de retry ou notificação para intervenção manual.
    throw new Error(`Falha ao atualizar o plano do usuário no banco de dados: ${error.message}`);
  }
}
