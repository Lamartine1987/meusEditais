
import { redirect } from 'next/navigation';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import type { User as AppUser, PlanDetails, Edital, Cargo } from '@/types';
import { AdminClientPage, type RefundRequest } from '@/components/admin/admin-client-page';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

async function getAdminPageData(): Promise<{ refundRequests: RefundRequest[]; isAdmin: boolean }> {
  console.log('--- INICIANDO VERIFICAÇÃO DE ACESSO DE ADMINISTRADOR ---');
  try {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
      console.log('[LOG-VERIFICAÇÃO] FALHA: Nenhum cookie de sessão foi encontrado. O usuário provavelmente não está logado.');
      return { refundRequests: [], isAdmin: false };
    }
    console.log('[LOG-VERIFICAÇÃO] SUCESSO: Cookie de sessão encontrado.');
    
    const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
    console.log(`[LOG-VERIFICAÇÃO] SUCESSO: Token decodificado. UID do usuário logado: ${decodedToken.uid}`);

    const adminUidsFromEnv = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_UIDS || '';
    console.log(`[LOG-VERIFICAÇÃO] VALOR LIDO DA VARIÁVEL DE AMBIENTE (NEXT_PUBLIC_FIREBASE_ADMIN_UIDS): "${adminUidsFromEnv}"`);
    
    if (!adminUidsFromEnv) {
        console.log('[LOG-VERIFICAÇÃO] ALERTA: A variável de ambiente com os UIDs de administrador está vazia ou não foi encontrada.');
    }

    const adminUids = adminUidsFromEnv.split(',').filter(uid => uid.trim() !== '');
    console.log(`[LOG-VERIFICAÇÃO] Lista de UIDs de administrador processada: [${adminUids.join(', ')}] (Total: ${adminUids.length})`);

    const isUserAdmin = adminUids.includes(decodedToken.uid);
    if (!isUserAdmin) {
      console.log(`[LOG-VERIFICAÇÃO] FALHA: Acesso negado. O UID "${decodedToken.uid}" NÃO ESTÁ na lista de administradores.`);
      return { refundRequests: [], isAdmin: false };
    }

    console.log(`[LOG-VERIFICAÇÃO] SUCESSO: Acesso de administrador concedido para o UID: ${decodedToken.uid}. Buscando dados da página...`);

    const [usersSnapshot, editaisSnapshot] = await Promise.all([
        adminDb.ref('users').once('value'),
        adminDb.ref('editais').once('value')
    ]);

    const allUsersData: Record<string, AppUser> = usersSnapshot.val() || {};
    const allEditaisDataRaw = editaisSnapshot.val() || {};
    
    const allEditaisData: Edital[] = Object.keys(allEditaisDataRaw).map(key => ({
        id: key,
        ...allEditaisDataRaw[key]
    }));

    const requests: RefundRequest[] = [];
    for (const userId in allUsersData) {
      const userData = allUsersData[userId];
      const plansToRefund = userData.activePlans?.filter(p => p.status === 'refundRequested') || [];

      for (const plan of plansToRefund) {
        let editalName, cargoName, amount, currency;

        if (plan.planId === 'plano_edital' && plan.selectedEditalId) {
            editalName = allEditaisData.find(e => e.id === plan.selectedEditalId)?.title;
        } else if (plan.planId === 'plano_cargo' && plan.selectedCargoCompositeId) {
            const parts = plan.selectedCargoCompositeId.split('_');
            const editalId = parts.slice(0, -1).join('_');
            const cargoId = parts.slice(-1)[0];
            const edital = allEditaisData.find(e => e.id === editalId);
            const cargo = edital?.cargos?.find(c => c.id === cargoId);
            editalName = edital?.title;
            cargoName = cargo?.name;
        }

        if (plan.stripePaymentIntentId) {
            try {
                const stripe = getStripeClient();
                const paymentIntent = await stripe.paymentIntents.retrieve(plan.stripePaymentIntentId);
                amount = paymentIntent.amount;
                currency = paymentIntent.currency;
            } catch (stripeError) {
                console.warn(`[LOG-ADMIN-DADOS] Não foi possível buscar o Payment Intent ${plan.stripePaymentIntentId}:`, stripeError);
            }
        }
        
        requests.push({
          ...plan,
          user: {
            id: userId,
            name: userData.name,
            email: userData.email,
          },
          editalName,
          cargoName,
          amount,
          currency,
        });
      }
    }
    
    console.log(`[LOG-ADMIN-DADOS] Busca de dados concluída. ${requests.length} solicitações de reembolso encontradas.`);
    return { 
      refundRequests: requests.sort((a,b) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime()),
      isAdmin: true,
    };
  } catch (error: any) {
    if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/session-cookie-revoked') {
      console.log('[LOG-VERIFICAÇÃO] ERRO: Cookie de sessão expirado ou revogado.', error.code);
      return { refundRequests: [], isAdmin: false };
    }
    console.error("[LOG-VERIFICAÇÃO] ERRO INESPERADO:", error);
    return { refundRequests: [], isAdmin: false };
  }
}

export default async function AdminPage() {
  const { refundRequests, isAdmin } = await getAdminPageData();

  if (!isAdmin) {
    redirect('/');
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader
          title="Painel Administrativo"
          description="Gerencie solicitações e outras tarefas administrativas."
        />
        <AdminClientPage initialRefundRequests={refundRequests} />
      </div>
    </PageWrapper>
  );
}
