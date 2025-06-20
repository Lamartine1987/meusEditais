
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType } from '@/types';
import { mockEditais } from '@/lib/mock-data';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, BookOpen, ChevronRight, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';

export default function CargoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;

  const { user, loading: authLoading } = useAuth();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (editalId && cargoId) {
      setLoadingData(true);
      // Simulate data fetching
      const timer = setTimeout(() => {
        const foundEdital = mockEditais.find(e => e.id === editalId) || null;
        if (foundEdital) {
          const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId) || null;
          setEdital(foundEdital);
          setCargo(foundCargo);
        }
        setLoadingData(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [editalId, cargoId]);

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
