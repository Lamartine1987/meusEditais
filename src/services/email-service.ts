
'use server';

/**
 * @fileOverview A mock email service for sending transactional emails.
 * In a real application, this would integrate with a service like SendGrid, Mailgun, or AWS SES.
 */
import type { PlanId } from '@/types';

const getPlanDisplayName = (planId: PlanId): string => {
    switch (planId) {
        case 'plano_cargo': return "Plano Cargo";
        case 'plano_edital': return "Plano Edital";
        case 'plano_anual': return "Plano Anual";
        case 'plano_trial': return "Teste Gratuito";
        default: return "Plano";
    }
};

/**
 * Sends a subscription confirmation email.
 * This is a mock function that logs to the console.
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
    const planName = getPlanDisplayName(planId);
    const subject = `Confirmação de Assinatura: ${planName}`;
    const body = `
        Olá ${name},

        Obrigado por assinar o ${planName} na plataforma Meus Editais!

        Sua assinatura está ativa e você já pode aproveitar todos os benefícios.

        Para gerenciar sua conta e assinatura, acesse seu perfil:
        ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/perfil

        Atenciosamente,
        Equipe Meus Editais
    `;

    console.log("--- MOCK EMAIL SENDER ---");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body.trim().replace(/^ +/gm, '')}`);
    console.log("-------------------------");
    
    // In a real application, you would use an email API here.
    // For example, using a library like 'nodemailer' or an SDK for SendGrid/Mailgun.
    // await emailProvider.send({ to, subject, body });

    return Promise.resolve();
}
