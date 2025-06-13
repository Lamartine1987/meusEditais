
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gem, Briefcase, Library, Zap } from 'lucide-react';
import Link from 'next/link';

const PlanFeature = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

export default function PlanosPage() {
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
                R$ 29<span className="text-xl font-normal">,90/mês</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>1 cargo específico</strong> de <strong>1 edital</strong> à sua escolha.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo para o cargo selecionado.</PlanFeature>
                <PlanFeature>Acompanhamento de progresso detalhado.</PlanFeature>
                <PlanFeature>Ideal para quem tem um objetivo claro.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button size="lg" className="w-full text-base" disabled>
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
                R$ 49<span className="text-xl font-normal">,90/mês</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>todos os cargos</strong> de <strong>1 edital específico</strong>.</PlanFeature>
                <PlanFeature>Flexibilidade para estudar para múltiplas vagas do mesmo concurso.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo e acompanhamento.</PlanFeature>
                <PlanFeature>Perfeito para quem quer maximizar chances em um concurso.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button size="lg" className="w-full text-base" disabled>
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
                R$ 299<span className="text-xl font-normal">,90/ano</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>todos os cargos</strong> de <strong>todos os editais</strong> da plataforma.</PlanFeature>
                <PlanFeature>Liberdade total para explorar e se preparar para múltiplos concursos.</PlanFeature>
                <PlanFeature>Todas as funcionalidades premium e atualizações futuras.</PlanFeature>
                <PlanFeature>O melhor custo-benefício para concurseiros dedicados.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button size="lg" className="w-full text-base" disabled>
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
                <p>No momento, as assinaturas ainda não estão integradas. Esta página é uma demonstração dos planos que serão oferecidos.</p>
                <p>Quando disponível, você poderá escolher seu plano e realizar o pagamento de forma segura. Após a confirmação, seu acesso será liberado conforme o plano escolhido.</p>
                <p><strong>Atenção:</strong> Para utilizar as funcionalidades de inscrição em cargos, marcação de tópicos estudados, registro de tempo e desempenho, é necessário estar logado. Em breve, será necessário também ter um plano ativo.</p>
            </CardContent>
             <CardFooter className="justify-center pt-4">
                <Button variant="outline" asChild>
                    <Link href="/login">Já tem uma conta? Faça Login</Link>
                </Button>
            </CardFooter>
        </Card>

      </div>
    </PageWrapper>
  );
}
