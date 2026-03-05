
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, BookOpen, ChevronRight, AlertCircle, Gem, AlertTriangle, CreditCard, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CargoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;

    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    let canAccess = false;

    // Filtra apenas planos com status 'active'
    const activePaidPlans = user.activePlans?.filter(p => p.status === 'active') || [];

    if (activePaidPlans.some(p => p.planId === 'plano_mensal' || p.planId === 'plano_trial')) {
        canAccess = true;
    } else if (activePaidPlans.some(p => p.planId === 'plano_edital' && p.selectedEditalId === editalId)) {
        canAccess = true;
    } else if (activePaidPlans.some(p => p.planId === 'plano_cargo' && p.selectedCargoCompositeId === currentCargoCompositeId)) {
        canAccess = true;
    }
    
    // Verifica se há planos suspensos para feedback específico
    const suspended = !canAccess && (user.activePlans?.some(p => p.status === 'past_due' || p.status === 'unpaid') ?? false);

    setHasAccess(canAccess);
    setIsSuspended(suspended);
  }, [user, authLoading, editalId, cargoId]);

  useEffect(() => {
    const fetchCargoDetails = async () => {
      if (editalId && cargoId) {
        setLoadingData(true);
        try {
          const response = await fetch('/api/editais');
          if (!response.ok) throw new Error('Falha ao buscar dados.');
          const allEditais: Edital[] = await response.json();
          const foundEdital = allEditais.find(e => e.id === editalId);
          if (foundEdital) {
            setEdital(foundEdital);
            const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId);
            setCargo(foundCargo || null);
          }
        } catch (error: any) {
          toast({ title: "Erro ao Carregar Dados", variant: "destructive" });
        } finally {
          setLoadingData(false);
        }
      }
    };
    fetchCargoDetails();
  }, [editalId, cargoId, toast]);

  const calculateProgress = useCallback((subject: SubjectType): number => {
    if (!user || !subject.topics || subject.topics.length === 0) return 0;
    const studiedTopicsCount = subject.topics.filter(topic => {
      const compositeTopicId = `${editalId}_${cargoId}_${subject.id}_${topic.id}`;
      return user.studiedTopicIds?.includes(compositeTopicId);
    }).length;
    return (studiedTopicsCount / subject.topics.length) * 100;
  }, [user, editalId, cargoId]);


  if (loadingData || authLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }
  
  if (!authLoading && !loadingData && !hasAccess) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-0 sm:px-4 py-8">
          <div className="mb-6">
            <Button variant="outline" asChild>
              <Link href={`/editais/${editalId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Detalhes do Edital
              </Link>
            </Button>
          </div>
          <PageHeader 
            title={cargo?.name ?? "Acesso Restrito"}
            description={cargo ? `Conteúdo programático do cargo ${cargo.name}.` : 'Este conteúdo não está disponível para seu plano atual.'}
          />
          <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center">
                {isSuspended ? (
                  <AlertTriangle className="mr-3 h-6 w-6 text-destructive" />
                ) : (
                  <Lock className="mr-3 h-6 w-6 text-muted-foreground" />
                )}
                {isSuspended ? "Assinatura Suspensa" : "Acesso Restrito ao Conteúdo"}
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {isSuspended ? (
                <Alert variant="destructive" className="mb-6">
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>Falha no Pagamento Detectada</AlertTitle>
                  <AlertDescription>
                    Seu acesso foi suspenso automaticamente porque o Stripe não conseguiu processar a última cobrança da sua assinatura. 
                    Por favor, atualize seus dados de pagamento para reativar o acesso.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground text-center mb-6">
                  Seu plano atual não está ativo ou não concede acesso às matérias deste cargo. 
                  Verifique se sua assinatura está em dia ou considere fazer um upgrade.
                </p>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className={isSuspended ? "bg-destructive hover:bg-destructive/90" : ""}>
                    <Link href="/perfil">
                    {isSuspended ? "Resolver Pendência no Perfil" : "Gerenciar Assinatura"}
                    </Link>
                </Button>
                {!isSuspended && (
                  <Button asChild variant="outline" size="lg">
                      <Link href="/planos">
                      <Gem className="mr-2 h-4 w-4" />
                      Ver Planos Disponíveis
                      </Link>
                  </Button>
                )}
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
          <PageHeader title="Informação Não Encontrada" />
          <p className="mb-4">O edital ou cargo que você está procurando não foi encontrado.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
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
              Voltar para Detalhes do Edital
            </Link>
          </Button>
        </div>

        <PageHeader 
          title={`Matérias para: ${cargo.name}`}
          description={`Conteúdo programático do cargo ${cargo.name} no edital ${edital.title}.`}
        />

        {cargo.subjects && cargo.subjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cargo.subjects.map((subject: SubjectType) => {
              const progressValue = calculateProgress(subject);
              const subjectKey = `${editalId}_${cargoId}_${subject.id}`;
              return (
                <Link key={subjectKey} href={`/editais/${editalId}/cargos/${cargoId}/materias/${subject.id}`} passHref>
                  <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl flex flex-col h-full bg-card cursor-pointer group">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-primary group-hover:underline flex justify-between items-center">
                        {subject.name}
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow pt-1">
                      <p className="text-xs text-muted-foreground mb-2">
                        {subject.topics?.length || 0} tópico(s) no total.
                      </p>
                    </CardContent>
                    <CardFooter className="pt-3 border-t">
                      <div className="flex items-center w-full">
                        <Progress value={progressValue} className="h-2.5 flex-grow" aria-label={`Progresso em ${subject.name}`} />
                        <span className="text-xs font-medium text-muted-foreground ml-2 w-10 text-right">
                          {Math.round(progressValue)}%
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <BookOpen className="mr-3 h-6 w-6 text-primary" />
                Conteúdo Programático
              </CardTitle>
            </CardHeader>
            <Separator className="my-4" />
            <CardContent>
              <div className="text-center py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">Nenhuma matéria cadastrada para este cargo.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
