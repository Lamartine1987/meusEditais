
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
import { Loader2, ArrowLeft, BookOpen, ChevronRight, AlertCircle, Gem, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (!user || authLoading) return;

    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    let canAccess = false;

    if (user.activePlans?.some(p => p.planId === 'plano_mensal' || p.planId === 'plano_trial')) {
        canAccess = true;
    } else if (user.activePlans?.some(p => p.planId === 'plano_edital' && p.selectedEditalId === editalId)) {
        canAccess = true;
    } else if (user.activePlans?.some(p => p.planId === 'plano_cargo' && p.selectedCargoCompositeId === currentCargoCompositeId)) {
        canAccess = true;
    }
    
    setHasAccess(canAccess);
  }, [user, authLoading, editalId, cargoId]);

  useEffect(() => {
    const fetchCargoDetails = async () => {
      if (editalId && cargoId) {
        console.log(`[CargoDetailPage] Fetching details for editalId: ${editalId}, cargoId: ${cargoId}`);
        setLoadingData(true);
        try {
          const response = await fetch('/api/editais');
          if (!response.ok) {
            throw new Error('Falha ao buscar dados dos editais.');
          }
          const allEditais: Edital[] = await response.json();
          console.log(`[CargoDetailPage] Received ${allEditais.length} editais from API.`);

          const foundEdital = allEditais.find(e => e.id === editalId);
          if (foundEdital) {
            console.log(`[CargoDetailPage] Found edital: ${foundEdital.title}`);
            const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId);
            if (foundCargo) {
              console.log(`[CargoDetailPage] Found cargo: ${foundCargo.name}`);
              setEdital(foundEdital);
              setCargo(foundCargo);
            } else {
              console.error(`[CargoDetailPage] Cargo with id ${cargoId} not found in edital ${editalId}.`);
              setEdital(foundEdital); // Still set edital to show some context
              setCargo(null);
            }
          } else {
            console.error(`[CargoDetailPage] Edital with id ${editalId} not found.`);
            setEdital(null);
            setCargo(null);
          }
        } catch (error: any) {
          console.error("[CargoDetailPage] Error fetching data:", error);
          toast({
            title: "Erro ao Carregar Dados",
            description: "Não foi possível buscar as matérias do cargo.",
            variant: "destructive"
          });
          setEdital(null);
          setCargo(null);
        } finally {
          setLoadingData(false);
        }
      }
    };
    fetchCargoDetails();
  }, [editalId, cargoId, toast]);

  const calculateProgress = useCallback((subject: SubjectType): number => {
    if (!user || !subject.topics || subject.topics.length === 0) {
      return 0;
    }
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
          <Card className="shadow-lg rounded-xl bg-card text-center">
            <CardHeader>
              <CardTitle className="text-xl flex items-center justify-center">
                <AlertTriangle className="mr-3 h-6 w-6 text-destructive" />
                Acesso Restrito ao Conteúdo
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">
                Seu plano atual não concede acesso às matérias deste cargo. Para visualizar este conteúdo, por favor, faça um upgrade no seu plano.
              </p>
              <Button asChild className="mt-6" size="lg">
                <Link href="/planos">
                  <Gem className="mr-2 h-4 w-4" />
                  Ver Planos Disponíveis
                </Link>
              </Button>
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
                       {/* Placeholder for a brief description if available in future */}
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
                <p className="text-sm text-muted-foreground mt-1">Verifique o edital completo para mais informações.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
