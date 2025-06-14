
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, CheckCircle, AlertTriangle, CreditCard, Gem } from 'lucide-react';
import type { PlanId } from '@/types';

interface PlanDisplayDetails {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  originalPrice?: string; 
}

const planDisplayMap: Record<PlanId, PlanDisplayDetails> = {
  plano_cargo: {
    id: 'plano_cargo',
    name: "Plano Cargo",
    price: "R$ 4,99/mês",
    description: "Acesso a 1 cargo específico de 1 edital à sua escolha. Todas as funcionalidades de estudo para o cargo selecionado. Acompanhamento de progresso detalhado."
  },
  plano_edital: {
    id: 'plano_edital',
    name: "Plano Edital",
    price: "R$ 9,99/mês",
    description: "Acesso a todos os cargos de 1 edital específico. Flexibilidade para estudar para múltiplas vagas do mesmo concurso. Todas as funcionalidades de estudo e acompanhamento."
  },
  plano_anual: {
    id: 'plano_anual',
    name: "Plano Anual",
    price: "R$ 39,99/ano", // Corrected price
    description: "Acesso a todos os cargos de todos os editais da plataforma. Liberdade total para explorar e se preparar para múltiplos concursos. Todas as funcionalidades premium e atualizações futuras."
  }
};

function CheckoutPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, subscribeToPlan, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const planIdParam = params.planId as string;
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<PlanDisplayDetails | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isValidPlan, setIsValidPlan] = useState(false);

  useEffect(() => {
    if (planIdParam && (planIdParam === 'plano_cargo' || planIdParam === 'plano_edital' || planIdParam === 'plano_anual')) {
      const planDetails = planDisplayMap[planIdParam as PlanId];
      setSelectedPlanDetails(planDetails);
      setIsValidPlan(true);

      // Removed automatic redirect for plano_cargo and plano_edital as user arrives here after selection.
      // Validation for required query params will happen before payment simulation.

    } else {
      setIsValidPlan(false);
    }
  }, [planIdParam, router, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para acessar o checkout.", variant: "destructive" });
      let redirectPath = `/checkout/${planIdParam}`;
      const cargoId = searchParams.get('selectedCargoCompositeId');
      const editalId = searchParams.get('selectedEditalId');
      if (cargoId) redirectPath += `?selectedCargoCompositeId=${cargoId}`;
      if (editalId) redirectPath += `?selectedEditalId=${editalId}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [user, authLoading, router, toast, planIdParam, searchParams]);

  const handleSimulatedPayment = async () => {
    if (!user || !selectedPlanDetails) return;

    let specificCheckoutDetails: { selectedCargoCompositeId?: string; selectedEditalId?: string } = {};

    if (selectedPlanDetails.id === 'plano_cargo') {
        const cargoCompositeId = searchParams.get('selectedCargoCompositeId');
        if (!cargoCompositeId) {
            toast({ title: "Seleção Incompleta", description: "O cargo específico não foi selecionado. Por favor, volte e selecione um cargo.", variant: "destructive", duration: 7000 });
            router.push('/planos');
            return;
        }
        specificCheckoutDetails.selectedCargoCompositeId = cargoCompositeId;
    } else if (selectedPlanDetails.id === 'plano_edital') {
        const editalId = searchParams.get('selectedEditalId');
        if (!editalId) {
            toast({ title: "Seleção Incompleta", description: "O edital específico não foi selecionado. Por favor, volte e selecione um edital.", variant: "destructive", duration: 7000 });
            router.push('/planos');
            return;
        }
        specificCheckoutDetails.selectedEditalId = editalId;
    }

    if (user.activePlan && user.activePlan !== selectedPlanDetails.id) {
       toast({ title: "Plano Existente", description: `Você já possui o plano ${planDisplayMap[user.activePlan].name} ativo. Cancele-o em seu perfil antes de assinar um novo.`, variant: "default", duration: 7000 });
      return;
    }
    // Check if user has the same specific plan already
    if (user.activePlan && user.activePlan === selectedPlanDetails.id) {
        let alreadyHasThisSpecificPlan = false;
        if (planIdParam === 'plano_anual') {
            alreadyHasThisSpecificPlan = true; // For annual, just checking planId is enough
        } else if (planIdParam === 'plano_cargo' && user.planDetails?.selectedCargoCompositeId === specificCheckoutDetails.selectedCargoCompositeId) {
            alreadyHasThisSpecificPlan = true;
        } else if (planIdParam === 'plano_edital' && user.planDetails?.selectedEditalId === specificCheckoutDetails.selectedEditalId) {
            alreadyHasThisSpecificPlan = true;
        }

        if (alreadyHasThisSpecificPlan) {
            toast({ title: "Plano Já Ativo", description: `Você já está inscrito no ${selectedPlanDetails.name}${planIdParam !== 'plano_anual' ? ' para este item específico' : ''}.`, variant: "default" });
            router.push('/perfil');
            return;
        }
    }


    setIsSubscribing(true);
    try {
      await subscribeToPlan(selectedPlanDetails.id, specificCheckoutDetails);
      // O subscribeToPlan já lida com o toast de sucesso e redirecionamento para /perfil
    } catch (error: any) {
      toast({ title: "Erro na Assinatura", description: error.message || "Não foi possível concluir a assinatura.", variant: "destructive" });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (authLoading || (!isValidPlan && !selectedPlanDetails) || (planIdParam !== 'plano_anual' && !searchParams.get('selectedCargoCompositeId') && !searchParams.get('selectedEditalId') && !selectedPlanDetails)) {
     // Added check for query params for cargo/edital plans if details not yet loaded.
     // This avoids premature rendering of "Invalid Plan" if query params are still being processed.
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!isValidPlan) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
           <Card className="max-w-md mx-auto shadow-lg rounded-xl bg-card">
            <CardHeader className="items-center">
              <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
              <CardTitle className="text-2xl">Plano Inválido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground mb-6">O plano que você está tentando acessar não é válido ou não foi encontrado.</p>
              <Button asChild variant="outline">
                <Link href="/planos">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Ver Planos Disponíveis
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }
  
  if (!user || !selectedPlanDetails) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }
  
  // Additional check: for cargo/edital plans, ensure the specific ID is present in query params.
  if (selectedPlanDetails.id === 'plano_cargo' && !searchParams.get('selectedCargoCompositeId')) {
    toast({ title: "Seleção Necessária", description: "Por favor, selecione um cargo na página de planos.", variant: "destructive" });
    router.push('/planos');
    return <PageWrapper><Loader2 className="h-12 w-12 animate-spin text-primary m-auto" /></PageWrapper>; // Show loader during redirect
  }
  if (selectedPlanDetails.id === 'plano_edital' && !searchParams.get('selectedEditalId')) {
    toast({ title: "Seleção Necessária", description: "Por favor, selecione um edital na página de planos.", variant: "destructive" });
    router.push('/planos');
    return <PageWrapper><Loader2 className="h-12 w-12 animate-spin text-primary m-auto" /></PageWrapper>; // Show loader during redirect
  }


  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href="/planos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Planos
            </Link>
          </Button>
        </div>

        <PageHeader 
          title="Checkout"
          description={`Você está prestes a assinar o ${selectedPlanDetails.name}.`}
        />

        <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
          <Card className="shadow-xl rounded-xl bg-card">
            <CardHeader className="border-b pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl flex items-center">
                  <Gem className="mr-3 h-7 w-7 text-primary" />
                  {selectedPlanDetails.name}
                </CardTitle>
                <span className="text-2xl font-bold text-primary">{selectedPlanDetails.price}</span>
              </div>
              <CardDescription className="pt-2">{selectedPlanDetails.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Resumo do Pedido</h3>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">{selectedPlanDetails.name}</span>
                  <span className="font-semibold">{selectedPlanDetails.price}</span>
                </div>
                 {selectedPlanDetails.id === 'plano_cargo' && searchParams.get('selectedCargoCompositeId') && (
                  <p className="text-sm text-muted-foreground pt-1">Cargo ID: {searchParams.get('selectedCargoCompositeId')}</p>
                )}
                {selectedPlanDetails.id === 'plano_edital' && searchParams.get('selectedEditalId') && (
                  <p className="text-sm text-muted-foreground pt-1">Edital ID: {searchParams.get('selectedEditalId')}</p>
                )}
                <div className="flex justify-between items-center py-3 font-bold text-lg">
                  <span>Total</span>
                  <span>{selectedPlanDetails.price}</span>
                </div>
              </div>
              
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md text-amber-700">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm">
                      Este é um <strong>processo de assinatura simulado</strong>. Nenhum pagamento real será processado.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                size="lg" 
                className="w-full text-lg h-12" 
                onClick={handleSimulatedPayment}
                disabled={isSubscribing || authLoading}
              >
                {isSubscribing || authLoading ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-6 w-6" />
                )}
                Confirmar Assinatura (Simulado)
              </Button>
            </CardFooter>
          </Card>

        </div>
      </div>
    </PageWrapper>
  );
}

// Wrap with Suspense because useSearchParams() needs it
export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    }>
      <CheckoutPageContent />
    </Suspense>
  )
}
