
'use server';

import type { PlanId } from '@/types';

const getPlanInfo = (planId: PlanId): { name: string; benefits: string } => {
    switch (planId) {
        case 'plano_cargo': return { name: "Plano Cargo", benefits: "Acesso a 1 cargo específico, Funcionalidades de estudo completas, Acompanhamento de progresso detalhado." };
        case 'plano_edital': return { name: "Plano Edital", benefits: "Acesso a todos os cargos de 1 edital, Flexibilidade para múltiplas vagas, Suporte para upgrade." };
        case 'plano_anual': return { name: "Plano Anual", benefits: "Acesso ILIMITADO a todos os editais e cargos, Liberdade total para explorar concursos, O melhor custo-benefício." };
        case 'plano_trial': return { name: "Teste Gratuito", benefits: "Acesso completo por 5 dias, Explore todos os recursos, Sem compromisso." };
        default: return { name: "Plano", benefits: "Acesso aos recursos da plataforma." };
    }
};

/**
 * Sends a subscription confirmation email by calling the external API endpoint.
 *
 * @param to - The recipient's email address.
 * @param name - The recipient's name.
 * @param planId - The ID of the subscribed plan.
 */
export async function sendSubscriptionConfirmationEmail(
    to: string,
    name: string,
    planId: PlanId,
): Promise<void> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    // The endpoint provided in the screenshot
    const emailApiUrl = `${appUrl}/api/send-welcome-email`; 

    const { name: planName, benefits: keyBenefits } = getPlanInfo(planId);
    const companyName = "Meus Editais";

    const payload = {
        userName: name,
        userEmail: to,
        planName,
        companyName,
        keyBenefits,
    };

    console.log(`[EmailService] Attempting to send welcome email via API: ${emailApiUrl}`);
    console.log(`[EmailService] Payload: ${JSON.stringify(payload)}`);

    try {
        const response = await fetch(emailApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API call to email service failed with status ${response.status}: ${errorBody}`);
        }

        const responseData = await response.json();
        console.log("[EmailService] Successfully triggered email via external API:", responseData);

    } catch (error: any) {
        console.error("[EmailService] Failed to send email via external API:", error.message);
        // Re-throw the error so the calling function (webhook) is aware of the failure.
        // The webhook handler has a try/catch block that will log this as a warning
        // without stopping the entire webhook process.
        throw error;
    }
}
