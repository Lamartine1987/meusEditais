
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
  try {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
      return { refundRequests: [], isAdmin: false };
    }
    
    const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
    
    // Nova verificação de administrador baseada no banco de dados
    const adminRef = adminDb.ref(`admins/${decodedToken.uid}`);
    const adminSnapshot = await adminRef.once('value');
    const isUserAdmin = adminSnapshot.exists();

    if (!isUserAdmin) {
      return { refundRequests: [], isAdmin: false };
    }

    // Se for administrador, busca os dados da página
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
    
    return { 
      refundRequests: requests.sort((a,b) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime()),
      isAdmin: true,
    };
  } catch (error: any) {
    if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/session-cookie-revoked') {
      console.log('ERRO: Cookie de sessão expirado ou revogado.', error.code);
      return { refundRequests: [], isAdmin: false };
    }
    console.error("ERRO INESPERADO AO BUSCAR DADOS DE ADMIN:", error);
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
