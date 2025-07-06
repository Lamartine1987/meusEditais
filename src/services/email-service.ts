'use server';

import type { PlanId } from '@/types';
import { Resend } from 'resend';

function getPlanDisplayName(planId: PlanId): string {
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo";
      case 'plano_edital': return "Plano Edital";
      case 'plano_anual': return "Plano Anual";
      case 'plano_trial': return "Teste Gratuito";
      default: return "Plano";
    }
}

/**
 * Envia um e-mail de confirmação de assinatura utilizando o serviço Resend.
 * Esta função só deve ser chamada do lado do servidor.
 */
export async function sendSubscriptionConfirmationEmail(
    to: string,
    name: string,
    planId: PlanId,
): Promise<void> {
    console.log(`[EmailService] Attempting to send subscription confirmation. To: ${to}, Plan: ${planId}`);
    
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        console.error("[EmailService] CRITICAL: RESEND_API_KEY is not configured in environment variables. Email will not be sent.");
        // Não lançamos um erro para não quebrar o fluxo principal do webhook,
        // mas registramos o erro crítico.
        return;
    }
    
    // Inicialize o cliente Resend dentro da função para garantir que as variáveis de ambiente
    // estejam disponíveis no runtime.
    const resend = new Resend(resendApiKey);

    const planName = getPlanDisplayName(planId);
    const subject = `Bem-vindo(a) ao seu ${planName}!`;
    const body = `
        <h1>Olá ${name},</h1>
        <p>Sua assinatura do <strong>${planName}</strong> foi confirmada com sucesso!</p>
        <p>Agora você tem acesso total aos recursos do seu plano e pode começar a se preparar para o seu concurso.</p>
        <p>Bons estudos!</p>
        <br>
        <p>Atenciosamente,</p>
        <p>Equipe Meus Editais</p>
    `;

    try {
        console.log(`[EmailService] Sending email via Resend from 'onboarding@resend.dev'`);
        const { data, error } = await resend.emails.send({
            from: 'Meus Editais <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: body,
        });

        if (error) {
            console.error(`[EmailService] Resend API returned an error for user ${to}:`, error);
            // Novamente, não lançamos um erro, mas registramos.
            return;
        }

        console.log(`[EmailService] Successfully sent email to ${to}. Email ID: ${data?.id}`);
    } catch (error) {
        console.error(`[EmailService] Failed to send email for user ${to}. Error:`, error);
    }
}
