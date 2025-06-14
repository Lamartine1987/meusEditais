
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle, Info, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { PlanId } from '@/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PlanDisplayDetails {
  id: PlanId;
  name: string;
  price: string;
  priceDescription: string;
  features: string[];
  originalPrice?: string; 
}

const planDetailsMap: Record<PlanId, PlanDisplayDetails> = {
  plano_cargo: {
    id: 'plano_cargo',
    name: 'Plano Cargo',
    price: 'R$ 4,99',
    priceDescription: '/ano',
    features: [
      'Acesso por 1 ano a 1 cargo específico de sua escolha.',
      'Flexibilidade para alterar o cargo escolhido nos primeiros 7 dias da assinatura.',
      'Todas as funcionalidades de estudo para o cargo selecionado.',
      'Acompanhamento de progresso detalhado.',
    ],
  },
  plano_edital: {
    id: 'plano_edital',
    name: 'Plano Edital',
    price: 'R$ 9,99',
    priceDescription: '/ano',
    features: [
      'Acesso por 1 ano a todos os cargos de 1 edital específico de sua escolha.',
      'Flexibilidade para alterar o edital escolhido nos primeiros 7 dias da assinatura.',
      'Flexibilidade para estudar para múltiplas vagas do mesmo concurso.',
      'Todas as funcionalidades de estudo e acompanhamento.',
    ],
  },
  plano_anual: {
    id: 'plano_anual',
    name: 'Plano Anual',
    price: 'R$ 39,90',
    priceDescription: '/ano',
    features: [
      'Acesso por 1 ano a todos os cargos de todos os editais da plataforma.',
      'Liberdade total para explorar e se preparar para múltiplos concursos.',
      'Todas as funcionalidades premium e atualizações futuras.',
      'O melhor custo-benefício para concurseiros dedicados.',
    ],
  },
};

const PlanFeatureItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start text-sm">
    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const planId = params.planId as PlanId | undefined;
  const [selectedPlan, setSelectedPlan] = useState<PlanDisplayDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (planId && planDetailsMap[planId]) {
      setSelectedPlan(planDetailsMap[planId]);
    } else if (planId) {
      // PlanId inválido ou não encontrado, redirecionar para a página de planos
      toast({ title: "Plano Inválido", description: "O plano selecionado não foi encontrado.", variant: "destructive" });
      router.push('/planos');
    }
  }, [planId, router, toast]);

  const handleProceedToPayment = () => {
    if (!selectedPlan) return;
    setIsProcessing(true);
    // Simulação de processamento
    setTimeout(() => {
      toast({
        title: "Pagamento (Simulado)",
        description: `O ${selectedPlan.name} seria processado aqui. Funcionalidade de pagamento real pendente.`,
        variant: "default",
        className: "bg-accent text-accent-foreground",
        duration: 7000,
      });
      // Em um cenário real, após o pagamento bem-sucedido:
      // 1. Chamar a função subscribeToPlan do AuthContext
      // 2. Redirecionar para uma página de sucesso ou para o perfil.
      // Ex: await subscribeToPlan(selectedPlan.id, { selectedCargoCompositeId: 'id_do_cargo_se_for_plano_cargo', selectedEditalId: 'id_do_edital_se_for_plano_edital'});
      // Ex: router.push('/perfil?subscription_success=true');
      setIsProcessing(false);
    }, 2000);
  };

  if (authLoading && !user) {
    // Se estiver carregando e não houver usuário, pode mostrar um loader ou redirecionar
    // (o AuthProvider já lida com redirecionamento se não logado em rotas protegidas,
    // mas aqui é uma boa prática verificar)
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) {
     // Deveria ser pego pelo redirect na navegação da página de planos se o usuário não estiver logado
     // mas como uma garantia extra:
     router.push('/login?redirect=/planos');
     return null;
  }
  
  if (!planId || !selectedPlan) {
    // Se o planId for inválido ou o plano não for encontrado após o useEffect,
    // pode mostrar um loader enquanto redireciona, ou uma mensagem.
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
      <div className="container mx-auto px-0 sm:px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button variant="outline" asChild size="sm">
            <Link href="/planos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Planos
            </Link>
          </Button>
        </div>

        <PageHeader 
          title="Checkout"
          description={`Revise os detalhes do ${selectedPlan.name} antes de prosseguir.`}
        />

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-2xl text-primary">{selectedPlan.name}</CardTitle>
            <CardDescription className="text-lg">
              <span className="font-semibold text-foreground">{selectedPlan.price}</span>
              <span className="text-muted-foreground">{selectedPlan.priceDescription}</span>
              {selectedPlan.originalPrice && (
                <span className="ml-2 line-through text-muted-foreground text-sm">
                  {selectedPlan.originalPrice}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-md font-semibold text-foreground">Benefícios do plano:</h3>
            <ul className="space-y-2">
              {selectedPlan.features.map((feature, index) => (
                <PlanFeatureItem key={index}>{feature}</PlanFeatureItem>
              ))}
            </ul>

            <Alert variant="default" className="mt-6 bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="font-semibold text-blue-800 dark:text-blue-200">Próximos Passos (Simulação)</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300/90">
                    Ao clicar em "Prosseguir para Pagamento", você seria redirecionado para um ambiente seguro de pagamento.
                    Após a confirmação, seu plano será ativado. Por enquanto, esta é uma simulação.
                </AlertDescription>
            </Alert>

          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button 
              size="lg" 
              className="w-full text-base" 
              onClick={handleProceedToPayment}
              disabled={isProcessing || authLoading}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-5 w-5" />
              )}
              {isProcessing ? 'Processando...' : 'Prosseguir para Pagamento'}
            </Button>
          </CardFooter>
        </Card>
        
        {user && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
                <p>Você está comprando como: <strong>{user.name}</strong> ({user.email})</p>
                <p>Não é você? <Link href="/login" className="text-primary hover:underline" onClick={async () => {
                    // Idealmente, adicionar logout aqui se for integrado com useAuth
                }}>Sair e entrar com outra conta</Link></p>
            </div>
        )}

      </div>
    </PageWrapper>
  );
}
