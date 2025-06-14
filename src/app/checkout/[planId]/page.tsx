
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    price: "R$ 39,99/ano",
    description: "Acesso a todos os cargos de todos os editais da plataforma. Liberdade total para explorar e se preparar para múltiplos concursos. Todas as funcionalidades premium e atualizações futuras."
  }
};


export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
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

      // Redirecionar para a página de planos se o plano for Cargo ou Edital,
      // pois eles devem ser assinados via seleção de item específico.
      if (planIdParam === 'plano_cargo' || planIdParam === 'plano_edital') {
        toast({
          title: "Seleção Específica Necessária",
          description: `Para o ${planDetails.name}, a seleção deve ser feita na página do edital/cargo. Redirecionando...`,
          variant: "default",
          duration: 5000,
        });
        router.push('/planos');
      }

    } else {
      setIsValidPlan(false);
    }
  }, [planIdParam, router, toast]);

  useEffect(() => {
    // Redireciona para login se não houver usuário após o carregamento inicial
    if (!authLoading && !user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para acessar o checkout.", variant: "destructive" });
      router.push('/login?redirect=/checkout/' + planIdParam);
    }
  }, [user, authLoading, router, toast, planIdParam]);

  const handleSimulatedPayment = async () => {
    if (!user || !selectedPlanDetails) return;

    if (user.activePlan && user.activePlan !== selectedPlanDetails.id) {
       toast({ title: "Plano Existente", description: `Você já possui o plano ${planDisplayMap[user.activePlan].name} ativo. Cancele-o em seu perfil antes de assinar um novo.`, variant: "default", duration: 7000 });
      return;
    }
    if (user.activePlan && user.activePlan === selectedPlanDetails.id) {
        toast({ title: "Plano Já Ativo", description: `Você já está inscrito no ${selectedPlanDetails.name}.`, variant: "default" });
        router.push('/perfil');
        return;
    }

    setIsSubscribing(true);
    try {
      await subscribeToPlan(selectedPlanDetails.id);
      // O subscribeToPlan já lida com o toast de sucesso e redirecionamento para /perfil
    } catch (error: any) {
      toast({ title: "Erro na Assinatura", description: error.message || "Não foi possível concluir a assinatura.", variant: "destructive" });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (authLoading || (!isValidPlan && !selectedPlanDetails)) {
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
     // Este estado não deve ser alcançado devido aos useEffects, mas é um fallback.
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
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

        <div className="grid grid-cols-1 md:grid-cols-1 gap-8"> {/* Alterado para 1 coluna */}
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
