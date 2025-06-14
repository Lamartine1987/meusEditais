
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gem, Briefcase, Library, Zap, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { PlanId } from '@/types';
import { useRouter } from 'next/navigation';

const PlanFeature = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

export default function PlanosPage() {
  const { user, loading: authLoading } = useAuth(); // subscribeToPlan foi removido daqui
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingPlan, setIsLoadingPlan] = useState<PlanId | null>(null);

  const handleSelectPlan = async (planId: PlanId) => {
    if (!user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para selecionar um plano.", variant: "destructive" });
      router.push('/login');
      return;
    }

    if (user.activePlan && user.activePlan !== planId) {
      toast({ title: "Plano Existente", description: `Você já possui o ${user.activePlan} ativo. Cancele-o em seu perfil antes de assinar um novo.`, variant: "default", duration: 7000 });
      return;
    }
     if (user.activePlan && user.activePlan === planId) {
      toast({ title: "Plano Já Ativo", description: `Você já está inscrito no plano ${planId === 'plano_cargo' ? 'Cargo' : planId === 'plano_edital' ? 'Edital' : 'Anual'}.`, variant: "default" });
      return;
    }


    setIsLoadingPlan(planId);

    if (planId === 'plano_anual') {
      router.push(`/checkout/${planId}`);
    } else if (planId === 'plano_cargo') {
      toast({ 
          title: "Seleção de Cargo Necessária", 
          description: "Para assinar o Plano Cargo, por favor, inscreva-se no cargo desejado na página de detalhes do edital.",
          variant: "default",
          duration: 10000,
      });
      setIsLoadingPlan(null);
    } else if (planId === 'plano_edital') {
         toast({ 
          title: "Seleção de Edital Necessária", 
          description: "Para assinar o Plano Edital, por favor, escolha o edital desejado e selecione a opção de assinatura na página de detalhes do edital (funcionalidade em desenvolvimento).",
          variant: "default",
          duration: 10000,
      });
      setIsLoadingPlan(null);
    }
    // setIsLoadingPlan(null) será chamado na página de checkout ou após o toast para cargo/edital.
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
                onClick={() => handleSelectPlan('plano_cargo')}
                disabled={authLoading || isLoadingPlan === 'plano_cargo'}
                variant="outline"
              >
                {authLoading && isLoadingPlan === 'plano_cargo' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                Selecionar Cargo
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
                onClick={() => handleSelectPlan('plano_edital')}
                disabled={authLoading || isLoadingPlan === 'plano_edital'}
                variant="outline"
              >
                 {authLoading && isLoadingPlan === 'plano_edital' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                Selecionar Edital
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Anual */}
          <Card className="shadow-lg rounded-xl flex flex-col transform hover:scale-105 transition-transform duration-300">
            <CardHeader className="items-center text-center pb-4">
              <Zap className="h-12 w-12 text-primary mb-3" />
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
                onClick={() => handleSelectPlan('plano_anual')}
                disabled={authLoading || isLoadingPlan === 'plano_anual'}
              >
                {authLoading && isLoadingPlan === 'plano_anual' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />}
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
                <p>As assinaturas são gerenciadas através da página de checkout (para o Plano Anual) ou diretamente nas páginas de detalhes (para Planos Cargo/Edital).</p>
                <p><strong>Atenção:</strong> No momento, a integração com pagamentos reais (Stripe) é simulada. As funcionalidades de estudo requerem um plano ativo (simulado).</p>
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

