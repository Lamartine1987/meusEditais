"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, BookOpen, Lock, AlertTriangle, CreditCard, ChevronRight, CheckCircle2, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function CargoSubjectsPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;

    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    
    // O acesso só é concedido se o status do plano for explicitamente 'active'
    const activePaidPlans = user.activePlans?.filter(p => p.status === 'active') || [];

    const canAccess = activePaidPlans.some(p => 
        p.planId === 'plano_mensal' || 
        p.planId === 'plano_trial' ||
        (p.planId === 'plano_edital' && p.selectedEditalId === editalId) ||
        (p.planId === 'plano_cargo' && p.selectedCargoCompositeId === currentCargoCompositeId)
    );

    // Considera suspenso se não tiver acesso mas tiver algum plano com status de erro de pagamento
    const suspended = !canAccess && (user.activePlans?.some(p => p.status === 'past_due' || p.status === 'unpaid') ?? false);

    setHasAccess(canAccess);
    setIsSuspended(suspended);
  }, [user, authLoading, editalId, cargoId]);

  useEffect(() => {
    const fetchCargoDetails = async () => {
      setLoadingData(true);
      try {
        const response = await fetch('/api/editais');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const allEditais: Edital[] = await response.json();
        const foundEdital = allEditais.find(e => e.id === editalId);
        if (foundEdital) {
          setEdital(foundEdital);
          const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId);
          if (foundCargo) {
            setCargo(foundCargo);
          }
        }
      } catch (error: any) {
        toast({ title: "Erro ao Carregar Dados", variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    };
    fetchCargoDetails();
  }, [editalId, cargoId, toast]);

  if (loadingData || authLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!hasAccess) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-0 sm:px-4 py-8">
          <div className="mb-6">
            <Button variant="outline" asChild>
              <Link href={`/editais/${editalId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Edital
              </Link>
            </Button>
          </div>
          <PageHeader title={cargo?.name ?? "Acesso Restrito"} />
          <Card className="shadow-lg rounded-xl bg-card border-muted-foreground/10 overflow-hidden">
            <CardHeader className="text-center bg-muted/30 pb-8 pt-10">
              <div className="mx-auto bg-background rounded-full p-4 w-fit shadow-sm mb-4">
                {isSuspended ? (
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                ) : (
                  <Lock className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                {isSuspended ? "Sua assinatura está suspensa" : "Conteúdo Restrito"}
              </CardTitle>
              <CardDescription className="text-base max-w-md mx-auto">
                {isSuspended 
                  ? "Não conseguimos processar o pagamento da sua assinatura. Regularize para continuar seus estudos."
                  : "Este cargo não está incluído no seu plano atual. Escolha um plano para desbloquear."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 pb-10">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className={cn("min-w-[200px] h-12 text-base", isSuspended ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" : "shadow-primary/20")}>
                    <Link href="/planos">
                    {isSuspended ? "Resolver Pendência" : "Ver Planos de Acesso"}
                    </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-[200px] h-12 text-base">
                    <Link href="/perfil">Ir para Meu Perfil</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  if (!edital || !cargo) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <PageHeader title="Não Encontrado" />
          <Button onClick={() => router.back()} variant="outline">Voltar</Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="-ml-2 text-muted-foreground hover:text-primary">
            <Link href={`/editais/${editalId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o Edital
            </Link>
          </Button>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{cargo.name}</h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Edital: <span className="font-semibold text-foreground">{edital.title}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cargo.subjects && cargo.subjects.length > 0 ? (
            cargo.subjects.map((subject: Subject) => {
              const totalTopics = subject.topics?.length || 0;
              const studiedTopics = (subject.topics || []).filter(topic => 
                user?.studiedTopicIds?.includes(`${editalId}_${cargoId}_${subject.id}_${topic.id}`)
              ).length;
              const progress = totalTopics > 0 ? (studiedTopics / totalTopics) * 100 : 0;

              return (
                <Card key={subject.id} className="flex flex-col h-full shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden group border-muted-foreground/10 bg-card">
                  <CardHeader className="pb-4 relative">
                    {/* Decorative Background Icon */}
                    <div className="absolute top-4 right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                      <BookOpen className="h-20 w-20 text-primary" />
                    </div>
                    
                    <CardTitle className="text-xl font-bold leading-tight min-h-[3rem] flex items-start pr-8">
                      <span className="group-hover:text-primary transition-colors duration-300">
                        {subject.name}
                      </span>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-sm font-medium">
                      <BookOpen className="h-3.5 w-3.5 text-primary/60" />
                      {totalTopics} {totalTopics === 1 ? 'tópico' : 'tópicos'} cadastrados
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5 flex-grow">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progresso</span>
                        <span className="text-sm font-black text-primary font-mono">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2.5 bg-muted rounded-full overflow-hidden" />
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-muted-foreground/5 transition-colors group-hover:bg-muted/50">
                      <div className={cn(
                        "rounded-full p-1.5",
                        progress === 100 ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                      )}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground/80">
                        {studiedTopics} de {totalTopics} concluídos
                      </span>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-4 pb-6 mt-auto">
                    <Button asChild className="w-full h-11 text-sm font-bold shadow-sm transition-all group-hover:translate-y-[-2px]" variant="outline">
                      <Link href={`/editais/${editalId}/cargos/${cargoId}/materias/${subject.id}`}>
                        Estudar Matéria
                        <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full">
              <Card className="text-center py-16 bg-muted/20 border-dashed">
                <CardContent className="flex flex-col items-center">
                  <div className="bg-background rounded-full p-4 mb-4 shadow-sm">
                    <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <p className="text-xl font-semibold text-muted-foreground">Nenhuma matéria cadastrada para este cargo.</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Verifique novamente mais tarde ou entre em contato com o suporte.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
