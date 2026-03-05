"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, BookOpen, Lock, AlertTriangle, CreditCard, ChevronRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from '@/components/ui/progress';

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
          <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center">
                {isSuspended ? (
                  <AlertTriangle className="mr-3 h-6 w-6 text-destructive" />
                ) : (
                  <Lock className="mr-3 h-6 w-6 text-muted-foreground" />
                )}
                {isSuspended ? "Assinatura Suspensa" : "Acesso Restrito"}
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {isSuspended ? (
                <Alert variant="destructive" className="mb-6">
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>Bloqueio por Falta de Pagamento</AlertTitle>
                  <AlertDescription>
                    O acesso a este conteúdo foi interrompido porque não conseguimos processar o pagamento da sua assinatura. 
                    Verifique seu cartão de crédito na página de perfil para restaurar o acesso.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground text-center mb-6">
                  Para acessar as matérias e registrar seu progresso, você precisa ter uma assinatura ativa para este cargo ou edital.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className={isSuspended ? "bg-destructive hover:bg-destructive/90" : ""}>
                    <Link href="/planos">
                    {isSuspended ? "Resolver Pendência" : "Ver Planos"}
                    </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                    <Link href="/perfil">Ver Meu Perfil</Link>
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
          <Button variant="outline" asChild>
            <Link href={`/editais/${editalId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o Edital
            </Link>
          </Button>
        </div>

        <PageHeader 
          title={cargo.name} 
          description={`Edital: ${edital.title}`}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cargo.subjects && cargo.subjects.length > 0 ? (
            cargo.subjects.map((subject: Subject) => {
              const totalTopics = subject.topics?.length || 0;
              const studiedTopics = (subject.topics || []).filter(topic => 
                user?.studiedTopicIds?.includes(`${editalId}_${cargoId}_${subject.id}_${topic.id}`)
              ).length;
              const progress = totalTopics > 0 ? (studiedTopics / totalTopics) * 100 : 0;

              return (
                <Card key={subject.id} className="shadow-md hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden group border-muted-foreground/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl flex items-start justify-between gap-2">
                      <span className="group-hover:text-primary transition-colors">{subject.name}</span>
                      <BookOpen className="h-5 w-5 text-primary/40 shrink-0" />
                    </CardTitle>
                    <CardDescription>
                      {totalTopics} {totalTopics === 1 ? 'tópico' : 'tópicos'} cadastrados
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="text-primary">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-accent" />
                      <span>{studiedTopics} de {totalTopics} concluídos</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/editais/${editalId}/cargos/${cargoId}/materias/${subject.id}`}>
                        Estudar Matéria
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full">
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">Nenhuma matéria cadastrada para este cargo.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
