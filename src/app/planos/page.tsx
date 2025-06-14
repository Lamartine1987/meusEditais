
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gem, Briefcase, Library, Zap, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { PlanId } from '@/types';

const PlanFeature = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

export default function PlanosPage() {
  const { user, subscribeToPlan, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [subscribingPlan, setSubscribingPlan] = useState<PlanId | null>(null);

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para assinar um plano.", variant: "destructive" });
      // Consider redirecting to login: router.push('/login');
      return;
    }

    if (user.activePlan === planId) {
        toast({ title: "Plano Já Ativo", description: `Você já está inscrito no ${planId}.`, variant: "default" });
        return;
    }
    if (user.activePlan && user.activePlan !== planId) {
         toast({ title: "Plano Existente", description: `Você já possui o ${user.activePlan} ativo. Cancele-o antes de assinar um novo.`, variant: "default" });
        return;
    }


    setSubscribingPlan(planId);
    try {
      if (planId === 'plano_cargo' || planId === 'plano_edital') {
        toast({ 
            title: "Seleção Necessária", 
            description: `Para assinar o ${planId === 'plano_cargo' ? 'Plano Cargo' : 'Plano Edital'}, por favor, escolha o ${planId === 'plano_cargo' ? 'cargo' : 'edital'} desejado na respectiva página de detalhes.`,
            variant: "default",
            duration: 7000,
        });
        setSubscribingPlan(null); // Reset loading state for these buttons
        return;
      }
      await subscribeToPlan(planId);
      // Success toast and redirection are handled within subscribeToPlan
    } catch (error) {
      // Error toast is handled within subscribeToPlan
      console.error(`Error subscribing to ${planId}:`, error);
    } finally {
      setSubscribingPlan(null);
    }
  };


  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Nossos Planos"
          description="Escolha o plano ideal para sua jornada de aprovação."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Plano Cargo */}
          <Card className="shadow-lg rounded-xl flex flex-col transform hover:scale-105 transition-transform duration-300">
            <CardHeader className="items-center text-center pb-4">
              <Briefcase className="h-12 w-12 text-primary mb-3" />
              <CardTitle className="text-2xl font-semibold">Plano Cargo</CardTitle>
              <CardDescription className="text-base text-muted-foreground">Foco total em uma oportunidade!</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-2">
              <p className="text-center text-3xl font-bold text-primary">
                R$ 4<span className="text-xl font-normal">,99/mês</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>1 cargo específico</strong> de <strong>1 edital</strong> à sua escolha.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo para o cargo selecionado.</PlanFeature>
                <PlanFeature>Acompanhamento de progresso detalhado.</PlanFeature>
                <PlanFeature>Ideal para quem tem um objetivo claro.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => handleSubscribe('plano_cargo')}
                disabled={authLoading || subscribingPlan === 'plano_cargo'}
              >
                {authLoading && subscribingPlan === 'plano_cargo' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Assinar Plano Cargo
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Edital */}
          <Card className="shadow-xl rounded-xl flex flex-col border-2 border-primary relative transform hover:scale-105 transition-transform duration-300">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary text-primary-foreground">
                    Mais Popular
                </span>
            </div>
            <CardHeader className="items-center text-center pb-4 pt-10">
              <Library className="h-12 w-12 text-primary mb-3" />
              <CardTitle className="text-2xl font-semibold">Plano Edital</CardTitle>
              <CardDescription className="text-base text-muted-foreground">Explore todas as vagas de um edital.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-2">
              <p className="text-center text-3xl font-bold text-primary">
                R$ 9<span className="text-xl font-normal">,99/mês</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>todos os cargos</strong> de <strong>1 edital específico</strong>.</PlanFeature>
                <PlanFeature>Flexibilidade para estudar para múltiplas vagas do mesmo concurso.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo e acompanhamento.</PlanFeature>
                <PlanFeature>Perfeito para quem quer maximizar chances em um concurso.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
               <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => handleSubscribe('plano_edital')}
                disabled={authLoading || subscribingPlan === 'plano_edital'}
              >
                 {authLoading && subscribingPlan === 'plano_edital' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Assinar Plano Edital
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Anual */}
          <Card className="shadow-lg rounded-xl flex flex-col transform hover:scale-105 transition-transform duration-300">
            <CardHeader className="items-center text-center pb-4">
              <Zap className="h-12 w-12 text-primary mb-3" /> {/* Usando Zap como ícone para "ilimitado" ou "premium" */}
              <CardTitle className="text-2xl font-semibold">Plano Anual</CardTitle>
              <CardDescription className="text-base text-muted-foreground">Acesso total e ilimitado!</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-2">
              <p className="text-center text-3xl font-bold text-primary">
                R$ 39<span className="text-xl font-normal">,99/ano</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>todos os cargos</strong> de <strong>todos os editais</strong> da plataforma.</PlanFeature>
                <PlanFeature>Liberdade total para explorar e se preparar para múltiplos concursos.</PlanFeature>
                <PlanFeature>Todas as funcionalidades premium e atualizações futuras.</PlanFeature>
                <PlanFeature>O melhor custo-benefício para concurseiros dedicados.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => handleSubscribe('plano_anual')}
                disabled={authLoading || subscribingPlan === 'plano_anual'}
              >
                {authLoading && subscribingPlan === 'plano_anual' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Assinar Plano Anual
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card className="mt-12 bg-muted/70 shadow-md rounded-xl">
            <CardHeader>
                <CardTitle className="text-xl text-center">Como funciona a assinatura?</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground space-y-3">
                <p>No momento, as assinaturas ainda não estão integradas com um sistema de pagamento real. Esta funcionalidade simula a lógica de assinatura.</p>
                <p>Para o <strong>Plano Anual</strong>, a assinatura pode ser ativada diretamente aqui. Para o <strong>Plano Cargo</strong> e <strong>Plano Edital</strong>, a intenção é que a assinatura seja feita nas páginas de detalhes do cargo ou edital específico (funcionalidade a ser implementada).</p>
                <p><strong>Atenção:</strong> Para utilizar as funcionalidades de inscrição em cargos, marcação de tópicos estudados, registro de tempo e desempenho, é necessário estar logado. Em breve, será necessário também ter um plano ativo para acesso completo.</p>
            </CardContent>
             <CardFooter className="justify-center pt-4">
                {user ? (
                     <Button variant="outline" asChild>
                        <Link href="/perfil">Ver Meu Perfil</Link>
                    </Button>
                ) : (
                    <Button variant="outline" asChild>
                        <Link href="/login">Já tem uma conta? Faça Login</Link>
                    </Button>
                )}
            </CardFooter>
        </Card>

      </div>
    </PageWrapper>
  );
}

