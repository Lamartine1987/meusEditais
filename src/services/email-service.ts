
'use server';

import type { PlanId } from '@/types';

/**
 * A funcionalidade de envio de e-mail foi desativada.
 */
export async function sendSubscriptionConfirmationEmail(
    to: string,
    name: string,
    planId: PlanId,
): Promise<void> {
    console.log(`[EmailService DISABLED] A funcionalidade de envio de e-mail foi desativada. E-mail para ${to} sobre o plano ${planId} não foi enviado.`);
    return Promise.resolve();
}
