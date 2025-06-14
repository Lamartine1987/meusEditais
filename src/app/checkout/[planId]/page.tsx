
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle, Info, CreditCard, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { PlanId } from '@/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createCheckoutSession } from '@/actions/payment-actions';

interface PlanDisplayDetails {
  id: PlanId;
  name: string;
  price: string;
  priceDescription: string;
  features: string[];
  originalPrice?: string;
  priceInCents: number; 
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
    priceInCents: 499,
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
    priceInCents: 999,
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
    priceInCents: 3990,
  },
};

const PlanFeatureItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start text-sm">
    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

function CheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const planId = params.planId as PlanId | undefined;
  const [selectedPlan, setSelectedPlan] = useState<PlanDisplayDetails | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (planId && planDetailsMap[planId]) {
      setSelectedPlan(planDetailsMap[planId]);
    } else if (planId) {
      toast({ title: "Plano Inválido", description: "O plano selecionado não foi encontrado.", variant: "destructive" });
      router.push('/planos');
    }
  }, [planId, router, toast]);

  useEffect(() => {
    if (searchParams.get('payment_cancelled') === 'true') {
      toast({
        title: "Pagamento Cancelado",
        description: "Você cancelou o processo de pagamento.",
        variant: "default",
        duration: 7000,
      });
      // Limpar o parâmetro da URL para evitar que o toast apareça novamente ao recarregar
      router.replace(`/checkout/${planId}`);
    }
  }, [searchParams, planId, router, toast]);

  const handleProceedToPayment = async () => {
    if (!selectedPlan || !user || !user.email) {
      toast({ title: "Erro", description: "Detalhes do plano ou usuário ausentes.", variant: "destructive"});
      return;
    }
    setIsProcessingPayment(true);
    try {
      const result = await createCheckoutSession({
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        priceInCents: selectedPlan.priceInCents,
        userEmail: user.email,
        userId: user.id,
      });

      if (result.success && result.checkoutUrl) {
        toast({
          title: "Redirecionando para Pagamento",
          description: "Você será redirecionado para a página de pagamento segura.",
          variant: "default",
          className: "bg-accent text-accent-foreground",
          duration: 3000, 
        });
        window.location.href = result.checkoutUrl; // Redireciona para o Stripe
      } else {
        throw new Error(result.error || "Falha ao iniciar o processo de pagamento.");
      }
    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      toast({ title: "Falha no Pagamento", description: error.message || "Não foi possível iniciar o pagamento.", variant: "destructive"});
      setIsProcessingPayment(false);
    }
    // Não definir setIsProcessingPayment(false) aqui se o redirecionamento ocorrer,
    // pois a página será descarregada. Ele está no catch para o caso de falha antes do redirect.
  };


  if (authLoading && !user) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) {
     router.push(`/login?redirect=/checkout/${planId || 'plano_anual'}`);
     return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }
  
  if (!planId || !selectedPlan) {
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
                <AlertTitle className="font-semibold text-blue-800 dark:text-blue-200">Próximos Passos</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300/90">
                    Ao clicar em "Prosseguir para Pagamento", você será redirecionado para uma página de pagamento segura do Stripe (ambiente de teste).
                    Após a conclusão (ou cancelamento) do pagamento, você será redirecionado de volta para o nosso site.
                    Uma implementação completa requer um Webhook para confirmar o pagamento e ativar seu plano.
                </AlertDescription>
            </Alert>

          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button 
              size="lg" 
              className="w-full text-base" 
              onClick={handleProceedToPayment}
              disabled={isProcessingPayment || authLoading}
            >
              {isProcessingPayment ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-5 w-5" />
              )}
              {isProcessingPayment ? 'Processando...' : `Pagar ${selectedPlan.price} com Stripe`}
            </Button>
          </CardFooter>
        </Card>
        
        {user && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
                <p>Você está comprando como: <strong>{user.name}</strong> ({user.email})</p>
            </div>
        )}

      </div>
    </PageWrapper>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Carregando checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
