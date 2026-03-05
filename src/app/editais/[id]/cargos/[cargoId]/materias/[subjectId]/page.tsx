"use client";

import { useEffect, useState, useCallback, ChangeEvent, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType, Topic as TopicType, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, NoteEntry } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, BookOpen, AlertCircle, Play, Pause, RotateCcw, Save, ListChecks, TimerIcon, ClipboardList, CheckCircle, XCircle, TrendingUp, CalendarClock, Info, AlertTriangle, Gem, FileText, History, NotebookPen, Trash2, Trophy, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { format, isToday, isPast, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';

const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface QuestionFormData {
  totalQuestions: string;
  correctQuestions: string;
  incorrectQuestions: string;
  targetPercentage: string;
}

const initialQuestionFormData: QuestionFormData = {
  totalQuestions: '',
  correctQuestions: '',
  incorrectQuestions: '',
  targetPercentage: '70',
};

export default function SubjectTopicsPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;
  const subjectId = params.subjectId as string;

  const { user, toggleTopicStudyStatus, addStudyLog, deleteStudyLog, addQuestionLog, deleteQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus, addNote, deleteNote, loading: authLoading, setRankingParticipation } = useAuth();
  const { toast } = useToast();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [subject, setSubject] = useState<SubjectType | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);

  // Refatoração do Timer
  const [timerStates, setTimerStates] = useState<Record<string, { time: number; isRunning: boolean }>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const activeTimerTopicIdRef = useRef<string | null>(null);

  const [activeAccordionItem, setActiveAccordionItem] = useState<string | null>(null);

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [currentTopicIdForModal, setCurrentTopicIdForModal] = useState<string | null>(null);
  const [questionFormData, setQuestionFormData] = useState<QuestionFormData>(initialQuestionFormData);

  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [currentTopicIdForRevisionModal, setCurrentTopicIdForRevisionModal] = useState<string | null>(null);
  const [daysToReviewInput, setDaysToReviewInput] = useState<string>('');
  
  const [pdfName, setPdfName] = useState('');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  
  const [noteText, setNoteText] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [questionLogToDelete, setQuestionLogToDelete] = useState<string | null>(null);


  const [hasAccess, setHasAccess] = useState(false);

  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [pendingLogData, setPendingLogData] = useState<{ topicId: string; logData: any } | null>(null);
  const [isSavingWithRankingChoice, setIsSavingWithRankingChoice] = useState(false);


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

    const suspended = !canAccess && (user.activePlans?.some(p => p.status === 'past_due' || p.status === 'unpaid') ?? false);

    setHasAccess(canAccess);
    setIsSuspended(suspended);
  }, [user, authLoading, editalId, cargoId]);

  useEffect(() => {
    const fetchSubjectDetails = async () => {
      if (editalId && cargoId && subjectId) {
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
              const foundSubject = foundCargo.subjects?.find(s => s.id === subjectId);
              if (foundSubject) {
                setSubject(foundSubject);
                const initialTimerStates: Record<string, { time: number; isRunning: boolean }> = {};
                foundSubject.topics?.forEach(topic => {
                  initialTimerStates[topic.id] = { time: 0, isRunning: false };
                });
                setTimerStates(initialTimerStates);
              }
            }
          }
        } catch (error: any) {
          toast({ title: "Erro ao Carregar Dados", variant: "destructive" });
        } finally {
          setLoadingData(false);
        }
      }
    };
    fetchSubjectDetails();
  }, [editalId, cargoId, subjectId, toast]);

  // Efeito do Timer
  useEffect(() => {
    const activeTopicId = activeTimerTopicIdRef.current;
    if (activeTopicId && timerStates[activeTopicId]?.isRunning) {
        if (!startTimeRef.current) {
            startTimeRef.current = Date.now() - (timerStates[activeTopicId].time * 1000);
        }

        timerRef.current = setInterval(() => {
            if (startTimeRef.current) {
                const elapsedTime = Date.now() - startTimeRef.current;
                setTimerStates(prev => {
                    if (prev[activeTopicId]?.isRunning) {
                        return {
                            ...prev,
                            [activeTopicId]: { ...prev[activeTopicId], time: Math.floor(elapsedTime / 1000) }
                        };
                    }
                    return prev;
                });
            }
        }, 1000);
    }

    return () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };
  }, [timerStates]);

  const handleToggleTopicCheckbox = useCallback(async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId || !hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const isCurrentlyStudied = user.studiedTopicIds?.includes(compositeTopicId);

    try {
      await toggleTopicStudyStatus(compositeTopicId);
      
      // Se estiver marcando como estudado (e não desmarcando), cria um log de 0 duração
      // para registrar a atividade de hoje nas estatísticas de consistência.
      if (!isCurrentlyStudied) {
        await addStudyLog(compositeTopicId, { duration: 0, pdfName: "Tópico concluído (Checklist)" });
      }
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  }, [user, editalId, cargoId, subjectId, toggleTopicStudyStatus, addStudyLog, toast, hasAccess]);

  const handleTimerPlayPause = (topicId: string) => {
      if (!hasAccess) return;
      if (activeTimerTopicIdRef.current && activeTimerTopicIdRef.current !== topicId && timerStates[activeTimerTopicIdRef.current]?.isRunning) {
          setTimerStates(prev => ({ ...prev, [activeTimerTopicIdRef.current!]: { ...prev[activeTimerTopicIdRef.current!], isRunning: false } }));
      }
      const isCurrentlyRunning = timerStates[topicId]?.isRunning;
      if (isCurrentlyRunning) { 
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          startTimeRef.current = null;
      } else { 
          activeTimerTopicIdRef.current = topicId;
          startTimeRef.current = Date.now() - (timerStates[topicId].time * 1000);
      }
      setTimerStates(prev => ({ ...prev, [topicId]: { ...prev[topicId], isRunning: !isCurrentlyRunning } }));
  };

  const handleTimerReset = (topicId: string) => {
    if(!hasAccess) return;
    if (timerRef.current && activeTimerTopicIdRef.current === topicId) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    startTimeRef.current = null;
    if (activeTimerTopicIdRef.current === topicId) activeTimerTopicIdRef.current = null;
    setTimerStates(prev => ({ ...prev, [topicId]: { time: 0, isRunning: false }, }));
  };

  const saveStudyLog = async (topicId: string, logData: any) => {
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    try {
      await addStudyLog(compositeTopicId, logData);
      toast({ title: "Registro Salvo!", variant: "default", className:"bg-accent text-accent-foreground" });
      handleTimerReset(topicId);
      setPdfName(''); setStartPage(''); setEndPage('');
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
    }
  }

  const handleSaveLog = async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId || !hasAccess) return;
    if (timerStates[topicId]?.isRunning) handleTimerPlayPause(topicId);
    
    setTimeout(async () => {
        const durationToSave = timerStates[topicId]?.time || 0;
        const logData = {
          duration: durationToSave,
          ...(pdfName.trim() && { pdfName: pdfName.trim() }),
          ...(startPage && { startPage: parseInt(startPage, 10) }),
          ...(endPage && { endPage: parseInt(endPage, 10) }),
        };
        if (user.isRankingParticipant === null && (user.studyLogs || []).length === 0) {
          setPendingLogData({ topicId, logData });
          setIsRankingModalOpen(true);
        } else {
          await saveStudyLog(topicId, logData);
        }
    }, 100);
  };
  
  const getTopicStudyLogs = useCallback((topicId: string): StudyLogEntry[] => {
    if (!user?.studyLogs) return [];
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.studyLogs.filter(log => log.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user, editalId, cargoId, subjectId]);

  const calculateTotalStudiedTimeForTopic = useCallback((topicId: string): number => {
    if (!user?.studyLogs) return 0;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.studyLogs.filter(log => log.compositeTopicId === compositeTopicId).reduce((total, log) => total + log.duration, 0);
  }, [user, editalId, cargoId, subjectId]);

  const handleOpenQuestionModal = (topicId: string) => {
    if (!hasAccess) return;
    setCurrentTopicIdForModal(topicId);
    setQuestionFormData(initialQuestionFormData);
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestionLog = async () => {
    if (!user || !currentTopicIdForModal || !hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${currentTopicIdForModal}`;
    try {
      await addQuestionLog({
        compositeTopicId,
        totalQuestions: parseInt(questionFormData.totalQuestions, 10),
        correctQuestions: parseInt(questionFormData.correctQuestions, 10),
        incorrectQuestions: parseInt(questionFormData.incorrectQuestions, 10),
        targetPercentage: parseInt(questionFormData.targetPercentage, 10),
      });
      toast({ title: "Desempenho Salvo!", variant: "default", className: "bg-accent text-accent-foreground" });
      setIsQuestionModalOpen(false);
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
    }
  };

  const getNotesForTopic = useCallback((topicId: string): NoteEntry[] => {
      if (!user?.notes) return [];
      const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
      return user.notes.filter(note => note.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user, editalId, cargoId, subjectId]);

  const getRevisionSchedulesForTopic = useCallback((topicId: string): RevisionScheduleEntry[] => {
    if (!user?.revisionSchedules) return [];
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.revisionSchedules.filter(rs => rs.compositeTopicId === compositeTopicId).sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
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

  if (!authLoading && !loadingData && !hasAccess) {
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
          <PageHeader title={subject?.name ?? "Acesso Restrito"} />
          <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center">
                {isSuspended ? (
                  <AlertTriangle className="mr-3 h-6 w-6 text-destructive" />
                ) : (
                  <AlertTriangle className="mr-3 h-6 w-6 text-muted-foreground" />
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
                  Para acessar os tópicos e registrar seu progresso, certifique-se de que sua assinatura está ativa.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className={isSuspended ? "bg-destructive hover:bg-destructive/90" : ""}>
                    <Link href="/perfil">
                    {isSuspended ? "Resolver Pendência" : "Ver Minha Conta"}
                    </Link>
                </Button>
                {!isSuspended && (
                  <Button asChild variant="outline" size="lg">
                      <Link href="/planos">Ver Planos</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  if (!edital || !cargo || !subject) {
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
            <Link href={`/editais/${editalId}/cargos/${cargoId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Matérias
            </Link>
          </Button>
        </div>

        <PageHeader title={subject.name} description={`Estude os tópicos de ${subject.name}.`} />

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <BookOpen className="mr-3 h-6 w-6 text-primary" />
              Tópicos da Matéria
            </CardTitle>
          </CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-6">
            {subject.topics && subject.topics.length > 0 ? (
              <Accordion 
                type="single" 
                collapsible 
                className="w-full space-y-3"
                onValueChange={(value) => {
                    const currentOpenTopic = activeAccordionItem;
                    if (currentOpenTopic && timerStates[currentOpenTopic]?.isRunning) handleTimerPlayPause(currentOpenTopic);
                    setActiveAccordionItem(value || null);
                    setPdfName(''); setStartPage(''); setEndPage(''); setNoteText('');
                }}
              >
                {subject.topics.map((topic: TopicType) => {
                  const compositeTopicId = `${editalId}_${cargoId}_${subject.id}_${topic.id}`;
                  const isStudiedChecked = user?.studiedTopicIds?.includes(compositeTopicId) ?? false;
                  const currentTimerState = timerStates[topic.id] || { time: 0, isRunning: false };
                  const totalStudiedSeconds = calculateTotalStudiedTimeForTopic(topic.id);
                  const revisionSchedules = getRevisionSchedulesForTopic(topic.id);
                  const isRevisionDue = revisionSchedules.some(r => !r.isReviewed && (isToday(parseISO(r.scheduledDate)) || isPast(parseISO(r.scheduledDate))));

                  return (
                    <AccordionItem 
                        value={topic.id} 
                        key={topic.id} 
                        className={cn(
                            "rounded-lg shadow-sm border overflow-hidden transition-colors duration-300",
                            isRevisionDue ? "bg-yellow-100 dark:bg-yellow-800/20 border-yellow-500/50" :
                            isStudiedChecked ? "bg-accent/20 border-accent/30" : "bg-card border-border"
                        )}
                    >
                      <AccordionTrigger className="py-4 px-3 hover:bg-muted/50 w-full text-left">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-base text-foreground/90 font-medium">{topic.name}</span>
                            <div className="flex items-center">
                                {isRevisionDue && <Badge variant="outline" className="text-xs font-normal ml-2 border-yellow-600 text-yellow-700 bg-yellow-50"><Info className="h-3 w-3 mr-1"/>Revisão Pendente</Badge>}
                                {totalStudiedSeconds > 0 && (
                                    <Badge variant="outline" className="text-xs font-normal ml-2">
                                    <TimerIcon className="h-3 w-3 mr-1" />
                                    {formatDuration(totalStudiedSeconds)}
                                    </Badge>
                                )}
                            </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 px-3 space-y-4 bg-muted/20">
                        <div className="flex items-center space-x-2 p-3 border rounded-md bg-background/50">
                            <Checkbox
                                id={`topic-${topic.id}`}
                                checked={isStudiedChecked}
                                onCheckedChange={() => handleToggleTopicCheckbox(topic.id)}
                                className="h-5 w-5"
                            />
                            <Label htmlFor={`topic-${topic.id}`} className="text-sm font-medium">Marcar como estudado</Label>
                        </div>

                        <div className="p-4 border rounded-lg bg-background shadow-sm space-y-4">
                            <h4 className="text-base font-semibold text-foreground flex items-center">
                                <TimerIcon className="mr-2 h-5 w-5 text-primary" />
                                Registrar Progresso
                            </h4>
                            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                                <div className="text-3xl font-mono text-primary">{formatDuration(currentTimerState.time)}</div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" onClick={() => handleTimerPlayPause(topic.id)}>
                                      {currentTimerState.isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => handleTimerReset(topic.id)}><RotateCcw className="h-5 w-5" /></Button>
                                </div>
                            </div>
                            <Button variant="default" className="w-full h-11" onClick={() => handleSaveLog(topic.id)}>
                              <Save className="mr-2 h-5 w-5" /> Salvar Progresso
                            </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <p className="text-center py-10 text-muted-foreground">Nenhum tópico cadastrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}