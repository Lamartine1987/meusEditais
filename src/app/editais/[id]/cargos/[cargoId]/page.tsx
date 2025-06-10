
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType, Topic as TopicType } from '@/types';
import { mockEditais } from '@/lib/mock-data';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, BookOpen, ChevronRight, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export default function CargoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;

  const { user, toggleTopicStudyStatus, loading: authLoading } = useAuth();
  const { toast } = useToast();

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

  const handleToggleTopic = useCallback(async (subjectId: string, topicId: string) => {
    if (!user || !editalId || !cargoId) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    try {
      await toggleTopicStudyStatus(compositeTopicId);
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível salvar o status do tópico.",
        variant: "destructive",
      });
    }
  }, [user, editalId, cargoId, toggleTopicStudyStatus, toast]);

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

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <BookOpen className="mr-3 h-6 w-6 text-primary" />
              Conteúdo Programático
            </CardTitle>
          </CardHeader>
          <Separator className="mb-4" />
          <CardContent>
            {cargo.subjects && cargo.subjects.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-3">
                {cargo.subjects.map((subject: SubjectType) => {
                  const progressValue = calculateProgress(subject);
                  const subjectKey = `${editalId}_${cargoId}_${subject.id}`;
                  return (
                    <AccordionItem value={subject.id} key={subjectKey} className="border-b-0 rounded-lg bg-muted/50 shadow-sm">
                      <AccordionTrigger className="px-4 py-3 text-md font-semibold hover:no-underline hover:bg-muted rounded-t-lg data-[state=open]:rounded-b-none data-[state=open]:bg-muted group">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center flex-grow mr-4">
                            <ChevronRight className="h-5 w-5 mr-2 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                            <span className="truncate">{subject.name}</span>
                          </div>
                          <div className="flex items-center w-1/3 min-w-[100px] max-w-[200px]">
                            <Progress value={progressValue} className="h-2.5 flex-grow" />
                            <span className="text-xs font-normal text-muted-foreground ml-2 w-10 text-right">
                              {Math.round(progressValue)}%
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 bg-background rounded-b-lg border-t border-border">
                        {subject.topics && subject.topics.length > 0 ? (
                          <ul className="space-y-3 pt-2">
                            {subject.topics.map((topic: TopicType) => {
                              const compositeTopicId = `${editalId}_${cargoId}_${subject.id}_${topic.id}`;
                              const isChecked = user?.studiedTopicIds?.includes(compositeTopicId) ?? false;
                              const checkboxId = `topic-${topic.id}`;
                              return (
                                <li key={topic.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                  <Checkbox
                                    id={checkboxId}
                                    checked={isChecked}
                                    onCheckedChange={() => handleToggleTopic(subject.id, topic.id)}
                                    aria-labelledby={`${checkboxId}-label`}
                                  />
                                  <Label htmlFor={checkboxId} id={`${checkboxId}-label`} className="text-sm text-foreground/90 cursor-pointer flex-grow">
                                    {topic.name}
                                  </Label>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground italic py-2">Nenhum tópico cadastrado para esta matéria.</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <div className="text-center py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">Nenhuma matéria cadastrada para este cargo.</p>
                <p className="text-sm text-muted-foreground mt-1">Verifique o edital completo para mais informações.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
