
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gem, Briefcase, Library, Zap, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation'; // Importado useRouter
import type { PlanId } from '@/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PlanFeature = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

export default function PlanosPage() {
  const { user, loading: authLoading } = useAuth(); // Removido subscribeToPlan
  const router = useRouter(); // Inicializado useRouter
  const { toast } = useToast(); // Mantido para possíveis toasts futuros, mas não usado em handleSubscribe

  // Removido subscribingPlan e handleSubscribe

  const navigateToCheckout = (planId: PlanId) => {
    if (!user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para prosseguir para o checkout.", variant: "destructive" });
      router.push('/login');
      return;
    }
    router.push(`/checkout/${planId}`);
  };


  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Nossos Planos"
          description="Escolha o plano ideal para sua jornada de aprovação. Todos os planos têm validade de 1 ano!"
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
                R$ 4<span className="text-xl font-normal">,99/ano</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso por <strong>1 ano</strong> a <strong>1 cargo específico</strong> de sua escolha.</PlanFeature>
                <PlanFeature>Flexibilidade para <strong>alterar o cargo escolhido</strong> nos primeiros <strong>7 dias</strong> da assinatura.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo para o cargo selecionado.</PlanFeature>
                <PlanFeature>Acompanhamento de progresso detalhado.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => navigateToCheckout('plano_cargo')}
                disabled={authLoading} // Removido subscribingPlan
              >
                {authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
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
                R$ 9<span className="text-xl font-normal">,99/ano</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso por <strong>1 ano</strong> a <strong>todos os cargos</strong> de <strong>1 edital específico</strong> de sua escolha.</PlanFeature>
                <PlanFeature>Flexibilidade para <strong>alterar o edital escolhido</strong> nos primeiros <strong>7 dias</strong> da assinatura.</PlanFeature>
                <PlanFeature>Flexibilidade para estudar para múltiplas vagas do mesmo concurso.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo e acompanhamento.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
               <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => navigateToCheckout('plano_edital')}
                disabled={authLoading} // Removido subscribingPlan
              >
                 {authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Assinar Plano Edital
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
                R$ 39<span className="text-xl font-normal">,90/ano</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso por <strong>1 ano</strong> a <strong>todos os cargos</strong> de <strong>todos os editais</strong> da plataforma.</PlanFeature>
                <PlanFeature>Liberdade total para explorar e se preparar para múltiplos concursos.</PlanFeature>
                <PlanFeature>Todas as funcionalidades premium e atualizações futuras.</PlanFeature>
                <PlanFeature>O melhor custo-benefício para concurseiros dedicados.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => navigateToCheckout('plano_anual')}
                disabled={authLoading} // Removido subscribingPlan
              >
                {authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Assinar Plano Anual
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Alert variant="default" className="mt-12 bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="font-semibold text-blue-800 dark:text-blue-200">Como funciona a assinatura?</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300/90 space-y-2">
                <p>No momento, as assinaturas simulam a lógica de um sistema real. Todos os planos têm <strong>validade de 1 ano</strong>.</p>
                <p>Para o <strong>Plano Anual</strong>, a assinatura pode ser ativada diretamente aqui ou via checkout (a ativação real ocorreria após pagamento).</p>
                <p>Para o <strong>Plano Cargo</strong> e <strong>Plano Edital</strong>, a assinatura é realizada ao selecionar o cargo/edital desejado nas páginas de detalhes e clicar em "Inscrever-se" (a ativação real ocorreria após pagamento). Você terá <strong>7 dias</strong> após a assinatura para alterar sua escolha de cargo ou edital, caso deseje. Para alterar, basta "inscrever-se" no novo item desejado.</p>
                <p><strong>Atenção:</strong> É necessário estar logado para utilizar funcionalidades de estudo e assinatura.</p>
            </AlertDescription>
        </Alert>
        
        <CardFooter className="justify-center pt-8">
            {user ? (
                 <Button variant="outline" asChild>
                    <Link href="/perfil">Ver Meu Perfil e Assinatura</Link>
                </Button>
            ) : (
                <Button variant="outline" asChild>
                    <Link href="/login">Já tem uma conta? Faça Login</Link>
                </Button>
            )}
        </CardFooter>

      </div>
    </PageWrapper>
  );
}
