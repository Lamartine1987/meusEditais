'use server';

import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { User as AppUser, PlanDetails } from '@/types';

async function verifyAdmin(idToken: string): Promise<boolean> {
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        const adminRef = adminDb.ref(`admins/${uid}`);
        const snapshot = await adminRef.once('value');
        
        return snapshot.exists();
    } catch (error) {
        console.error("[AdminAction] Admin verification failed:", error);
        return false;
    }
}

interface ProcessRefundInput {
  userId: string;
  paymentIntentId: string;
  idToken: string;
}

export async function processRefund(input: ProcessRefundInput): Promise<{ success: true }> {
    const { userId, paymentIntentId, idToken } = input;
    
    const isAdmin = await verifyAdmin(idToken);
    if (!isAdmin) {
        throw new Error("Acesso negado. Apenas administradores podem processar reembolsos.");
    }
    
    if (!userId || !paymentIntentId) {
        throw new Error("ID do usuário e ID do pagamento são obrigatórios.");
    }

    const userRef = adminDb.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    const userData: AppUser | null = snapshot.val();
    
    if (!userData) {
        throw new Error(`Usuário com ID ${userId} não encontrado.`);
    }

    const activePlans: PlanDetails[] = userData.activePlans || [];
    const planIndex = activePlans.findIndex(p => p.stripePaymentIntentId === paymentIntentId && p.status === 'refundRequested');
    
    if (planIndex === -1) {
        throw new Error(`Nenhuma solicitação de reembolso ativa encontrada para o pagamento ${paymentIntentId}.`);
    }
    
    const refundedPlan = {
        ...activePlans[planIndex],
        status: 'refunded' as const,
        refundedDate: new Date().toISOString(),
    };

    // Remove o plano dos ativos e adiciona ao histórico
    const updatedActivePlans = activePlans.filter((_, index) => index !== planIndex);
    const updatedPlanHistory = [...(userData.planHistory || []), refundedPlan];

    // Recalcula o plano ativo de maior nível
    const planRank: Record<string, number> = { plano_trial: 0, plano_cargo: 1, plano_edital: 2, plano_anual: 3 };
    let highestPlan: PlanDetails | null = null;
    if (updatedActivePlans.length > 0) {
        highestPlan = updatedActivePlans.reduce((max, plan) => 
            planRank[plan.planId] > planRank[max.planId] ? plan : max
        );
    }
    const newActivePlanId = highestPlan ? highestPlan.planId : null;
    
    try {
        await userRef.update({
            activePlans: updatedActivePlans,
            activePlan: newActivePlanId,
            planHistory: updatedPlanHistory,
        });
        return { success: true };
    } catch (error: any) {
        console.error("[AdminAction] Erro ao atualizar dados do usuário para reembolso:", error);
        throw new Error("Falha ao atualizar o banco de dados. Verifique os logs do servidor.");
    }
}
