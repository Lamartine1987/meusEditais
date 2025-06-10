
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType, Topic as TopicType, StudyLogEntry } from '@/types';
import { mockEditais } from '@/lib/mock-data';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, ArrowLeft, BookOpen, AlertCircle, Play, Pause, RotateCcw, Save, ListChecks } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper function to format duration from seconds to MM:SS
const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function SubjectTopicsPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;
  const subjectId = params.subjectId as string;

  const { user, toggleTopicStudyStatus, addStudyLog, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [subject, setSubject] = useState<SubjectType | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Timer states
  const [timerStates, setTimerStates] = useState<Record<string, { time: number; isRunning: boolean }>>({});
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | null>(null);


  useEffect(() => {
    if (editalId && cargoId && subjectId) {
      setLoadingData(true);
      const timer = setTimeout(() => {
        const foundEdital = mockEditais.find(e => e.id === editalId) || null;
        if (foundEdital) {
          const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId) || null;
          if (foundCargo) {
            const foundSubject = foundCargo.subjects?.find(s => s.id === subjectId) || null;
            setSubject(foundSubject);
            // Initialize timer states for each topic
            if (foundSubject?.topics) {
              const initialTimerStates: Record<string, { time: number; isRunning: boolean }> = {};
              foundSubject.topics.forEach(topic => {
                initialTimerStates[topic.id] = { time: 0, isRunning: false };
              });
              setTimerStates(initialTimerStates);
            }
          }
          setCargo(foundCargo);
        }
        setEdital(foundEdital);
        setLoadingData(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [editalId, cargoId, subjectId]);

  // Timer effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (activeAccordionItem && timerStates[activeAccordionItem]?.isRunning) {
      intervalId = setInterval(() => {
        setTimerStates(prev => ({
          ...prev,
          [activeAccordionItem]: {
            ...prev[activeAccordionItem],
            time: prev[activeAccordionItem].time + 1,
          },
        }));
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeAccordionItem, timerStates]);


  const handleToggleTopicCheckbox = useCallback(async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId) return;
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
  }, [user, editalId, cargoId, subjectId, toggleTopicStudyStatus, toast]);


  const handleTimerPlayPause = (topicId: string) => {
    if (!timerStates[topicId]) return;
    setTimerStates(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], isRunning: !prev[topicId].isRunning },
    }));
  };

  const handleTimerReset = (topicId: string) => {
    setTimerStates(prev => ({
      ...prev,
      [topicId]: { time: 0, isRunning: false },
    }));
  };

  const handleTimerSave = async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId || !timerStates[topicId] || timerStates[topicId].time === 0) {
      toast({ title: "Nenhum tempo para salvar", description: "Inicie o cronômetro para registrar tempo de estudo.", variant: "default" });
      return;
    }
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const durationToSave = timerStates[topicId].time;
    try {
      await addStudyLog(compositeTopicId, durationToSave);
      toast({ title: "Tempo Salvo!", description: `Registrado ${formatDuration(durationToSave)} para este tópico.`, variant: "default", className:"bg-accent text-accent-foreground" });
      handleTimerReset(topicId); // Reset timer after saving
    } catch (error) {
      toast({ title: "Erro ao Salvar Tempo", description: "Não foi possível salvar o registro de estudo.", variant: "destructive" });
    }
  };
  
  const getTopicLogs = useCallback((topicId: string): StudyLogEntry[] => {
    if (!user?.studyLogs) return [];
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.studyLogs.filter(log => log.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user, editalId, cargoId, subjectId]);


  if (loadingData || authLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!edital || !cargo || !subject) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <PageHeader title="Informação Não Encontrada" />
          <p className="mb-4">A matéria ou os detalhes do cargo que você está procurando não foram encontrados.</p>
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
            <Link href={`/editais/${editalId}/cargos/${cargoId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Matérias do Cargo
            </Link>
          </Button>
        </div>

        <PageHeader 
          title={subject.name}
          description={`Tópicos de estudo para ${subject.name} do cargo ${cargo.name}.`}
        />

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <BookOpen className="mr-3 h-6 w-6 text-primary" />
              Tópicos da Matéria
            </CardTitle>
          </CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-0">
            {subject.topics && subject.topics.length > 0 ? (
              <Accordion 
                type="single" 
                collapsible 
                className="w-full"
                onValueChange={(value) => setActiveAccordionItem(value || null)}
              >
                {subject.topics.map((topic: TopicType) => {
                  const compositeTopicId = `${editalId}_${cargoId}_${subject.id}_${topic.id}`;
                  const isChecked = user?.studiedTopicIds?.includes(compositeTopicId) ?? false;
                  const checkboxId = `topic-${subject.id}-${topic.id}`;
                  const currentTimerState = timerStates[topic.id] || { time: 0, isRunning: false };
                  const topicLogs = getTopicLogs(topic.id);

                  return (
                    <AccordionItem value={topic.id} key={topic.id} className="border-b border-border last:border-b-0">
                      <AccordionTrigger className="py-4 px-2 hover:bg-muted/50 rounded-md transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={checkboxId}
                              checked={isChecked}
                              onCheckedChange={(e) => {
                                e.stopPropagation(); // Prevent accordion from toggling
                                handleToggleTopicCheckbox(topic.id);
                              }}
                              aria-labelledby={`${checkboxId}-label`}
                              className="h-5 w-5"
                              onClick={(e) => e.stopPropagation()} // Also here for good measure
                            />
                            <Label htmlFor={checkboxId} id={`${checkboxId}-label`} className="text-base text-foreground/90 cursor-pointer flex-grow" onClick={(e) => e.stopPropagation()}>
                              {topic.name}
                            </Label>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 px-2 space-y-4 bg-muted/30 rounded-b-md">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-background shadow-sm">
                          <div className="text-3xl font-mono font-semibold text-primary">
                            {formatDuration(currentTimerState.time)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleTimerPlayPause(topic.id)} title={currentTimerState.isRunning ? "Pausar" : "Iniciar"}>
                              {currentTimerState.isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleTimerReset(topic.id)} title="Reiniciar">
                              <RotateCcw className="h-5 w-5" />
                            </Button>
                            <Button variant="default" size="icon" onClick={() => handleTimerSave(topic.id)} title="Salvar Tempo" disabled={currentTimerState.time === 0 && !currentTimerState.isRunning}>
                              <Save className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        
                        {topicLogs.length > 0 && (
                          <div className="space-y-3 pt-3">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
                              <ListChecks className="mr-2 h-4 w-4 text-primary" />
                              Registros de Estudo Salvos:
                            </h4>
                            <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                              {topicLogs.map((log, index) => (
                                <li key={index} className="text-xs p-2 border rounded-md bg-background/70 shadow-sm flex justify-between items-center">
                                  <span>{format(new Date(log.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                  <span className="font-medium">{formatDuration(log.duration)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                         {topicLogs.length === 0 && activeAccordionItem === topic.id && (
                            <p className="text-xs text-center text-muted-foreground py-2">Nenhum tempo de estudo salvo para este tópico ainda.</p>
                        )}

                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <div className="text-center py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">Nenhum tópico cadastrado para esta matéria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
