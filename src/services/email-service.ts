
'use server';

import { Resend } from 'resend';
import type { PlanId } from '@/types';

// O serviço Resend será inicializado dentro da função para evitar erros de build.

const getPlanInfo = (planId: PlanId): { name: string; benefits: string[] } => {
    switch (planId) {
        case 'plano_cargo': return { name: "Plano Cargo", benefits: ["Acesso a 1 cargo específico", "Funcionalidades de estudo completas", "Acompanhamento de progresso detalhado."] };
        case 'plano_edital': return { name: "Plano Edital", benefits: ["Acesso a todos os cargos de 1 edital", "Flexibilidade para múltiplas vagas", "Suporte para upgrade."] };
        case 'plano_anual': return { name: "Plano Anual", benefits: ["Acesso ILIMITADO a todos os editais e cargos", "Liberdade total para explorar concursos", "O melhor custo-benefício."] };
        case 'plano_trial': return { name: "Teste Gratuito", benefits: ["Acesso completo por 5 dias", "Explore todos os recursos", "Sem compromisso."] };
        default: return { name: "Plano", benefits: ["Acesso aos recursos da plataforma."] };
    }
};

const createEmailHtml = (userName: string, planName: string, benefits: string[]): string => {
    const benefitsHtml = benefits.map(benefit => `<li>${benefit}</li>`).join('');
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .header { background-color: #3498DB; color: white; padding: 10px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .footer { font-size: 0.8em; text-align: center; color: #777; margin-top: 20px; }
        ul { list-style-type: '✓ '; padding-left: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bem-vindo ao Meus Editais!</h1>
        </div>
        <div class="content">
            <h2>Olá, ${userName}!</h2>
            <p>Sua assinatura do <strong>${planName}</strong> foi confirmada com sucesso. Estamos muito felizes em ter você conosco!</p>
            <p>Você agora tem acesso aos seguintes benefícios:</p>
            <ul>
                ${benefitsHtml}
            </ul>
            <p>Comece a explorar seus editais agora mesmo e acelere sua jornada rumo à aprovação.</p>
            <p>Atenciosamente,<br>Equipe Meus Editais</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Meus Editais. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>`;
};

/**
 * Envia um e-mail de confirmação de assinatura usando a API do Resend.
 *
 * @param to - O endereço de e-mail do destinatário.
 * @param name - O nome do destinatário.
 * @param planId - O ID do plano assinado.
 */
export async function sendSubscriptionConfirmationEmail(
    to: string,
    name: string,
    planId: PlanId,
): Promise<void> {

    const apiKey = process.env.RESEND_API_KEY;

    // Durante o build, a chave de API não está disponível. Este check previne o erro.
    if (!apiKey) {
        console.log("[EmailService] Chave de API do Resend não encontrada. Pulando envio de e-mail. (Esperado durante o build)");
        // Em um ambiente de produção real, queremos saber se a chave está faltando.
        if (process.env.K_SERVICE) { // K_SERVICE é uma variável de ambiente do App Hosting.
            console.error("[EmailService] CRÍTICO: A chave de API do Resend está faltando em um ambiente de produção!");
        }
        return;
    }
    
    const resend = new Resend(apiKey);
    console.log(`[EmailService] >>>>> SERVIÇO DE EMAIL RESEND INICIADO <<<<<`);
    
    const { name: planName, benefits } = getPlanInfo(planId);
    const emailHtml = createEmailHtml(name, planName, benefits);

    try {
        console.log(`[EmailService] Tentando enviar e-mail via Resend para: ${to}`);
        const { data, error } = await resend.emails.send({
            from: 'Meus Editais <onboarding@resend.dev>', // IMPORTANTE: Para produção, este deve ser um domínio verificado.
            to: [to],
            subject: `Sua assinatura do ${planName} foi confirmada!`,
            html: emailHtml,
        });

        if (error) {
            console.error("[EmailService] >>>>> ERRO DA API RESEND <<<<<", error);
            throw new Error(`A API do Resend falhou ao enviar o e-mail. Erro: ${error.message}`);
        }

        console.log("[EmailService] >>>>> SUCESSO: A API do Resend aceitou a requisição de e-mail. <<<<<", data);

    } catch (error: any) {
        console.error("[EmailService] >>>>> ERRO: Falha ao executar a chamada para a API do Resend. <<<<<", error.message);
        throw error;
    }
}
