
"use client";

import { useEffect, useState, useCallback, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType, Topic as TopicType, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, BookOpen, AlertCircle, Play, Pause, RotateCcw, Save, ListChecks, TimerIcon, ClipboardList, CheckCircle, XCircle, TrendingUp, CalendarClock, Info, AlertTriangle, Gem, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { format, isToday, isPast, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const { user, toggleTopicStudyStatus, addStudyLog, addQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [subject, setSubject] = useState<SubjectType | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [timerStates, setTimerStates] = useState<Record<string, { time: number; isRunning: boolean }>>({});
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | null>(null);

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [currentTopicIdForModal, setCurrentTopicIdForModal] = useState<string | null>(null);
  const [questionFormData, setQuestionFormData] = useState<QuestionFormData>(initialQuestionFormData);

  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [currentTopicIdForRevisionModal, setCurrentTopicIdForRevisionModal] = useState<string | null>(null);
  const [daysToReviewInput, setDaysToReviewInput] = useState<string>('');
  
  const [pdfName, setPdfName] = useState('');
  const [pagesRead, setPagesRead] = useState('');

  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;

    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    let canAccess = false;
    switch (user.activePlan) {
      case 'plano_anual':
      case 'plano_trial':
        canAccess = true;
        break;
      case 'plano_edital':
        canAccess = user.planDetails?.selectedEditalId === editalId;
        break;
      case 'plano_cargo':
        canAccess = user.planDetails?.selectedCargoCompositeId === currentCargoCompositeId;
        break;
      default:
        canAccess = false;
    }
    setHasAccess(canAccess);
  }, [user, authLoading, editalId, cargoId]);

  useEffect(() => {
    const fetchSubjectDetails = async () => {
      if (editalId && cargoId && subjectId) {
        console.log(`[SubjectTopicsPage] Fetching details for editalId: ${editalId}, cargoId: ${cargoId}, subjectId: ${subjectId}`);
        setLoadingData(true);
        try {
          const response = await fetch('/api/editais');
          if (!response.ok) {
            throw new Error('Falha ao buscar dados dos editais.');
          }
          const allEditais: Edital[] = await response.json();
          console.log(`[SubjectTopicsPage] Received ${allEditais.length} editais from API.`);
          
          const foundEdital = allEditais.find(e => e.id === editalId);
          if (foundEdital) {
            console.log(`[SubjectTopicsPage] Found edital: ${foundEdital.title}`);
            setEdital(foundEdital);
            const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId);
            if (foundCargo) {
              console.log(`[SubjectTopicsPage] Found cargo: ${foundCargo.name}`);
              setCargo(foundCargo);
              const foundSubject = foundCargo.subjects?.find(s => s.id === subjectId);
              if (foundSubject) {
                console.log(`[SubjectTopicsPage] Found subject: ${foundSubject.name}`);
                setSubject(foundSubject);
                if (foundSubject.topics) {
                  const initialTimerStates: Record<string, { time: number; isRunning: boolean }> = {};
                  foundSubject.topics.forEach(topic => {
                    initialTimerStates[topic.id] = { time: 0, isRunning: false };
                  });
                  setTimerStates(initialTimerStates);
                }
              } else {
                 console.error(`[SubjectTopicsPage] Subject with id ${subjectId} not found in cargo ${cargoId}.`);
                 setSubject(null);
              }
            } else {
              console.error(`[SubjectTopicsPage] Cargo with id ${cargoId} not found in edital ${editalId}.`);
              setCargo(null);
            }
          } else {
            console.error(`[SubjectTopicsPage] Edital with id ${editalId} not found.`);
            setEdital(null);
          }
        } catch (error: any) {
          console.error("[SubjectTopicsPage] Error fetching data:", error);
          toast({
            title: "Erro ao Carregar Dados",
            description: "Não foi possível buscar os tópicos da matéria.",
            variant: "destructive"
          });
          setEdital(null);
          setCargo(null);
          setSubject(null);
        } finally {
          setLoadingData(false);
        }
      }
    };
    fetchSubjectDetails();
  }, [editalId, cargoId, subjectId, toast]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const activeTopicId = activeAccordionItem; 

    if (activeTopicId && timerStates[activeTopicId]?.isRunning && hasAccess) {
      intervalId = setInterval(() => {
        setTimerStates(prev => ({
          ...prev,
          [activeTopicId]: {
            ...prev[activeTopicId],
            time: prev[activeTopicId].time + 1,
          },
        }));
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeAccordionItem, timerStates, hasAccess]);


  const handleToggleTopicCheckbox = useCallback(async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId || !hasAccess) return;
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
  }, [user, editalId, cargoId, subjectId, toggleTopicStudyStatus, toast, hasAccess]);

  const handleTimerPlayPause = (topicId: string) => {
    if (!timerStates[topicId] || !hasAccess) return;
     Object.keys(timerStates).forEach(id => {
        if (id !== topicId && timerStates[id].isRunning) {
            setTimerStates(prev => ({...prev, [id]: {...prev[id], isRunning: false}}));
        }
    });
    setTimerStates(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], isRunning: !prev[topicId].isRunning },
    }));
  };

  const handleTimerReset = (topicId: string) => {
    if(!hasAccess) return;
    setTimerStates(prev => ({
      ...prev,
      [topicId]: { time: 0, isRunning: false },
    }));
  };

  const handleTimerSave = async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId || !timerStates[topicId] || timerStates[topicId].time === 0 || !hasAccess) {
      if (!hasAccess) {
        toast({ title: "Acesso Restrito", description: "Seu plano não cobre esta ação.", variant: "default" });
      } else {
        toast({ title: "Nenhum tempo para salvar", description: "Inicie o cronômetro para registrar tempo de estudo.", variant: "default" });
      }
      return;
    }
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const durationToSave = timerStates[topicId].time;

    let pagesReadForPayload: number | undefined = undefined;
    if (pagesRead) { // Only process if there's input
        const parsedNumber = parseInt(pagesRead, 10);
        if (isNaN(parsedNumber) || parsedNumber < 0) {
            toast({ title: "Valor Inválido", description: "A quantidade de páginas lidas deve ser um número positivo.", variant: "destructive"});
            return; // Abort if invalid
        }
        pagesReadForPayload = parsedNumber; // Assign only if valid
    }

    const pdfInfoPayload = {
      pdfName: pdfName.trim() || undefined,
      pagesRead: pagesReadForPayload,
    };

    try {
      await addStudyLog(compositeTopicId, durationToSave, pdfInfoPayload);
      toast({ title: "Tempo Salvo!", description: `Registrado ${formatDuration(durationToSave)} para este tópico.`, variant: "default", className:"bg-accent text-accent-foreground" });
      handleTimerReset(topicId);
      setPdfName('');
      setPagesRead('');
    } catch (error) {
      toast({ title: "Erro ao Salvar Tempo", description: "Não foi possível salvar o registro de estudo.", variant: "destructive" });
    }
  };
  
  const getTopicStudyLogs = useCallback((topicId: string): StudyLogEntry[] => {
    if (!user?.studyLogs) return [];
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.studyLogs.filter(log => log.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user, editalId, cargoId, subjectId]);

  const calculateTotalStudiedTimeForTopic = useCallback((topicId: string): number => {
    if (!user?.studyLogs) return 0;
    const compositeTopicIdToFilter = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.studyLogs
      .filter(log => log.compositeTopicId === compositeTopicIdToFilter)
      .reduce((total, log) => total + log.duration, 0);
  }, [user, editalId, cargoId, subjectId]);

  const handleOpenQuestionModal = (topicId: string) => {
    if (!hasAccess) return;
    setCurrentTopicIdForModal(topicId);
    setQuestionFormData(initialQuestionFormData);
    setIsQuestionModalOpen(true);
  };

  const handleQuestionFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setQuestionFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveQuestionLog = async () => {
    if (!user || !currentTopicIdForModal || !editalId || !cargoId || !subjectId || !hasAccess) return;

    const total = parseInt(questionFormData.totalQuestions, 10);
    const correct = parseInt(questionFormData.correctQuestions, 10);
    const incorrect = parseInt(questionFormData.incorrectQuestions, 10);
    const target = parseInt(questionFormData.targetPercentage, 10);

    if (isNaN(total) || total <= 0 ||
        isNaN(correct) || correct < 0 ||
        isNaN(incorrect) || incorrect < 0 ||
        isNaN(target) || target < 0 || target > 100) {
      toast({ title: "Dados Inválidos", description: "Por favor, preencha todos os campos com números válidos.", variant: "destructive" });
      return;
    }
    if (correct + incorrect > total) {
      toast({ title: "Dados Inconsistentes", description: "A soma de questões certas e erradas não pode exceder o total.", variant: "destructive" });
      return;
    }

    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${currentTopicIdForModal}`;
    try {
      await addQuestionLog({
        compositeTopicId,
        totalQuestions: total,
        correctQuestions: correct,
        incorrectQuestions: incorrect,
        targetPercentage: target,
      });
      toast({ title: "Desempenho Salvo!", description: "Seu registro de questões foi salvo.", variant: "default", className: "bg-accent text-accent-foreground" });
      setIsQuestionModalOpen(false);
      setCurrentTopicIdForModal(null);
    } catch (error) {
      toast({ title: "Erro ao Salvar", description: "Não foi possível salvar o registro de questões.", variant: "destructive" });
    }
  };

  const getLatestQuestionLogForTopic = useCallback((topicId: string): QuestionLogEntry | null => {
    if (!user?.questionLogs) return null;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const logsForTopic = user.questionLogs
      .filter(log => log.compositeTopicId === compositeTopicId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return logsForTopic.length > 0 ? logsForTopic[0] : null;
  }, [user, editalId, cargoId, subjectId]);

  const handleOpenRevisionModal = (topicId: string) => {
    if (!hasAccess) return;
    setCurrentTopicIdForRevisionModal(topicId);
    setDaysToReviewInput('');
    setIsRevisionModalOpen(true);
  };

  const handleSaveRevisionSchedule = async () => {
    if (!user || !currentTopicIdForRevisionModal || !editalId || !cargoId || !subjectId || !hasAccess) return;
    const days = parseInt(daysToReviewInput, 10);
    if (isNaN(days) || days <= 0) {
      toast({ title: "Número de Dias Inválido", description: "Por favor, insira um número de dias válido para a revisão.", variant: "destructive" });
      return;
    }
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${currentTopicIdForRevisionModal}`;
    try {
      await addRevisionSchedule(compositeTopicId, days);
      toast({ title: "Revisão Agendada!", description: `Revisão para este tópico agendada para daqui a ${days} dia(s).`, variant: "default", className: "bg-accent text-accent-foreground" });
      setIsRevisionModalOpen(false);
      setCurrentTopicIdForRevisionModal(null);
    } catch (error) {
      toast({ title: "Erro ao Agendar", description: "Não foi possível agendar a revisão.", variant: "destructive" });
    }
  };
  
  const handleToggleRevisionReviewed = async (topicId: string) => {
    if (!user || !editalId || !cargoId || !subjectId || !hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    try {
      await toggleRevisionReviewedStatus(compositeTopicId);
      const revision = getRevisionScheduleForTopic(topicId);
      toast({
        title: `Revisão ${revision?.isReviewed ? 'Marcada' : 'Desmarcada'}!`,
        variant: "default",
      });
    } catch (error) {
      toast({ title: "Erro ao atualizar status da revisão", variant: "destructive" });
    }
  };

  const getRevisionScheduleForTopic = useCallback((topicId: string): RevisionScheduleEntry | null => {
    if (!user?.revisionSchedules) return null;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    return user.revisionSchedules.find(rs => rs.compositeTopicId === compositeTopicId) || null;
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
          <PageHeader 
            title={subject?.name ?? "Acesso Restrito"}
            description={subject ? `Tópicos de estudo para ${subject.name} do cargo ${cargo?.name ?? ''}.` : 'Este conteúdo não está disponível para seu plano atual.'}
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
              <Alert variant="destructive" className="text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Seu plano não cobre este conteúdo</AlertTitle>
                <AlertDescription>
                  Para acessar os tópicos e registrar seu progresso para este cargo, por favor, verifique seu plano atual ou considere fazer um upgrade.
                </AlertDescription>
              </Alert>
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
          <CardContent className="pt-6">
            {subject.topics && subject.topics.length > 0 ? (
              <Accordion 
                type="single" 
                collapsible 
                className="w-full space-y-3"
                onValueChange={(value) => {
                    const currentOpenTopic = activeAccordionItem;
                    const newOpenTopic = value;
                    if (currentOpenTopic && currentOpenTopic !== newOpenTopic && timerStates[currentOpenTopic]?.isRunning) {
                         setTimerStates(prev => ({
                            ...prev,
                            [currentOpenTopic]: { ...prev[currentOpenTopic], isRunning: false },
                        }));
                    }
                    setActiveAccordionItem(newOpenTopic || null);
                    setPdfName('');
                    setPagesRead('');
                }}
              >
                {subject.topics.map((topic: TopicType) => {
                  const compositeTopicId = `${editalId}_${cargoId}_${subject.id}_${topic.id}`;
                  const isStudiedChecked = user?.studiedTopicIds?.includes(compositeTopicId) ?? false;
                  const checkboxId = `topic-studied-${subject.id}-${topic.id}`;
                  const currentTimerState = timerStates[topic.id] || { time: 0, isRunning: false };
                  const topicStudyLogs = getTopicStudyLogs(topic.id);
                  const totalStudiedSeconds = calculateTotalStudiedTimeForTopic(topic.id);
                  const totalStudiedTimeDisplay = totalStudiedSeconds > 0 ? formatDuration(totalStudiedSeconds) : null;
                  const latestQuestionLog = getLatestQuestionLogForTopic(topic.id);
                  let performancePercentage = 0;
                  if (latestQuestionLog && latestQuestionLog.totalQuestions > 0) {
                    performancePercentage = (latestQuestionLog.correctQuestions / latestQuestionLog.totalQuestions) * 100;
                  }
                  const revisionSchedule = getRevisionScheduleForTopic(topic.id);
                  const isRevisionDue = revisionSchedule && !revisionSchedule.isReviewed && (isToday(parseISO(revisionSchedule.scheduledDate)) || isPast(parseISO(revisionSchedule.scheduledDate)));

                  return (
                    <AccordionItem 
                        value={topic.id} 
                        key={topic.id} 
                        className={cn(
                            "rounded-lg shadow-sm border overflow-hidden transition-colors duration-300",
                            isRevisionDue ? "bg-yellow-100 dark:bg-yellow-800/20 border-yellow-500/50" :
                            (isStudiedChecked && hasAccess) ? "bg-accent/20 border-accent/30" : "bg-card border-border"
                        )}
                    >
                      <AccordionTrigger className="py-4 px-3 hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 w-full text-left">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-base text-foreground/90 font-medium">{topic.name}</span>
                            <div className="flex items-center">
                                {isRevisionDue && <Badge variant="outline" className="text-xs font-normal ml-2 border-yellow-600 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700"><Info className="h-3 w-3 mr-1"/>Revisão Pendente</Badge>}
                                {totalStudiedTimeDisplay && (
                                    <Badge variant="outline" className="text-xs font-normal ml-2">
                                    <TimerIcon className="h-3 w-3 mr-1" />
                                    {totalStudiedTimeDisplay}
                                    </Badge>
                                )}
                            </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 px-3 space-y-4 bg-muted/20">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border rounded-md bg-background/50 shadow-sm">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id={checkboxId}
                                    checked={isStudiedChecked}
                                    onCheckedChange={() => handleToggleTopicCheckbox(topic.id)}
                                    aria-labelledby={`${checkboxId}-label`}
                                    className="h-5 w-5"
                                    disabled={!hasAccess}
                                />
                                <Label htmlFor={checkboxId} id={`${checkboxId}-label`} className={cn("text-sm font-medium text-foreground/80", !hasAccess ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
                                    Marcar como estudado
                                </Label>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleOpenRevisionModal(topic.id)} className="w-full sm:w-auto" disabled={!hasAccess}>
                                <CalendarClock className="mr-2 h-4 w-4"/>
                                {revisionSchedule ? "Reagendar Revisão" : "Agendar Revisão"}
                            </Button>
                        </div>

                        {revisionSchedule && (
                            <div className="p-3 border rounded-md bg-background/50 shadow-sm space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Status da Revisão:
                                    {revisionSchedule.isReviewed && revisionSchedule.reviewedDate ? (
                                        <span className="ml-1 text-green-600 font-semibold">Revisado em {format(parseISO(revisionSchedule.reviewedDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                                    ) : isRevisionDue ? (
                                        <span className="ml-1 text-yellow-600 font-semibold">Pendente (Agendado para {format(parseISO(revisionSchedule.scheduledDate), "dd/MM/yyyy", { locale: ptBR })})</span>
                                    ) : (
                                        <span className="ml-1 text-foreground/80">Agendado para {format(parseISO(revisionSchedule.scheduledDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                                    )}
                                </p>
                                {(isRevisionDue || revisionSchedule.isReviewed) && (
                                     <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`revision-checked-${topic.id}`}
                                            checked={revisionSchedule.isReviewed}
                                            onCheckedChange={() => handleToggleRevisionReviewed(topic.id)}
                                            className="h-5 w-5"
                                            disabled={!hasAccess}
                                        />
                                        <Label htmlFor={`revision-checked-${topic.id}`} className={cn("text-sm font-medium text-foreground/80", !hasAccess ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
                                            Marcar como revisado
                                        </Label>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="p-3 border rounded-md bg-background/50 shadow-sm space-y-3">
                            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleOpenQuestionModal(topic.id)} disabled={!hasAccess}>
                                <ClipboardList className="mr-2 h-4 w-4"/>
                                Registrar Desempenho em Questões
                            </Button>
                            {latestQuestionLog && (
                                <div className="text-xs p-3 border rounded-md bg-background/30 space-y-1.5 shadow-inner">
                                    <p className="font-semibold text-muted-foreground">Último Registro de Questões ({format(parseISO(latestQuestionLog.date), "dd/MM/yy HH:mm", { locale: ptBR })}):</p>
                                    <p>• Total: {latestQuestionLog.totalQuestions}, Acertos: {latestQuestionLog.correctQuestions} ({performancePercentage.toFixed(1)}%), Erros: {latestQuestionLog.incorrectQuestions}</p>
                                    <p className="flex items-center">
                                      • Meta: {latestQuestionLog.targetPercentage}% - Status: 
                                      {performancePercentage >= latestQuestionLog.targetPercentage ? (
                                        <span className="ml-1.5 flex items-center text-green-600 font-medium"><CheckCircle className="h-3.5 w-3.5 mr-1"/>Aprovado</span>
                                      ) : (
                                        <span className="ml-1.5 flex items-center text-red-600 font-medium"><XCircle className="h-3.5 w-3.5 mr-1"/>Reprovado</span>
                                      )}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border rounded-md bg-background/50 shadow-sm space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
                                <FileText className="mr-2 h-4 w-4 text-primary" />
                                Registro de Leitura (Opcional)
                            </h4>
                            <div className="space-y-1">
                                <Label htmlFor={`pdf-name-${topic.id}`} className="text-xs">Nome do PDF/Material</Label>
                                <Input
                                    id={`pdf-name-${topic.id}`}
                                    placeholder="Ex: Aula 01 - Intro.pdf"
                                    value={pdfName}
                                    onChange={(e) => setPdfName(e.target.value)}
                                    disabled={!hasAccess}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`pages-read-${topic.id}`} className="text-xs">Páginas Lidas</Label>
                                <Input
                                    id={`pages-read-${topic.id}`}
                                    type="number"
                                    placeholder="Ex: 15"
                                    value={pagesRead}
                                    onChange={(e) => setPagesRead(e.target.value)}
                                    disabled={!hasAccess}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-background shadow-sm">
                          <div className={cn("text-3xl font-mono font-semibold", hasAccess ? "text-primary" : "text-muted-foreground/50")}>
                            {formatDuration(currentTimerState.time)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleTimerPlayPause(topic.id)} title={currentTimerState.isRunning ? "Pausar" : "Iniciar"} disabled={!hasAccess}>
                              {currentTimerState.isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleTimerReset(topic.id)} title="Reiniciar" disabled={!hasAccess}>
                              <RotateCcw className="h-5 w-5" />
                            </Button>
                            <Button variant="default" size="icon" onClick={() => handleTimerSave(topic.id)} title="Salvar Tempo" disabled={!hasAccess || (currentTimerState.time === 0 && !currentTimerState.isRunning)}>
                              <Save className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        
                        {topicStudyLogs.length > 0 && (
                          <div className="space-y-3 pt-3">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
                              <ListChecks className="mr-2 h-4 w-4 text-primary" />
                              Registros de Estudo Salvos:
                            </h4>
                            <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                              {topicStudyLogs.map((log, index) => (
                                <li key={index} className="text-xs p-2 border rounded-md bg-background/70 shadow-sm flex flex-col gap-1">
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-medium">{format(parseISO(log.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                        <Badge variant="outline" className="font-mono text-xs">{formatDuration(log.duration)}</Badge>
                                    </div>
                                    {(log.pdfName || log.pagesRead !== undefined) && (
                                        <div className="flex items-center text-muted-foreground/90 border-t pt-1.5 mt-1">
                                            <FileText size={14} className="mr-1.5 shrink-0" />
                                            <p className="truncate">
                                            {log.pdfName || 'Material não especificado'}
                                            {log.pagesRead !== undefined && ` - ${log.pagesRead} pág(s).`}
                                            </p>
                                        </div>
                                    )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                         {topicStudyLogs.length === 0 && activeAccordionItem === topic.id && hasAccess && (
                            <p className="text-xs text-center text-muted-foreground py-2">Nenhum tempo de estudo salvo para este tópico ainda.</p>
                        )}
                        {topicStudyLogs.length === 0 && activeAccordionItem === topic.id && !hasAccess && (
                            <p className="text-xs text-center text-muted-foreground py-2">Assine um plano para salvar seus registros de estudo.</p>
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

      {isQuestionModalOpen && currentTopicIdForModal && hasAccess && (
        <AlertDialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Registrar Desempenho em Questões</AlertDialogTitle>
              <AlertDialogDescription>
                Para o tópico: {subject?.topics.find(t => t.id === currentTopicIdForModal)?.name || 'Desconhecido'}.
                 Preencha os campos abaixo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="totalQuestions">Total de Questões Respondidas</Label>
                <Input id="totalQuestions" name="totalQuestions" type="number" value={questionFormData.totalQuestions} onChange={handleQuestionFormChange} placeholder="Ex: 50" className="mt-1 bg-secondary"/>
              </div>
              <div>
                <Label htmlFor="correctQuestions">Quantidade de Questões Certas</Label>
                <Input id="correctQuestions" name="correctQuestions" type="number" value={questionFormData.correctQuestions} onChange={handleQuestionFormChange} placeholder="Ex: 35" className="mt-1 bg-secondary"/>
              </div>
              <div>
                <Label htmlFor="incorrectQuestions">Quantidade de Questões Erradas</Label>
                <Input id="incorrectQuestions" name="incorrectQuestions" type="number" value={questionFormData.incorrectQuestions} onChange={handleQuestionFormChange} placeholder="Ex: 15" className="mt-1 bg-secondary"/>
              </div>
              <div>
                <Label htmlFor="targetPercentage">Sua Meta de Aprovação (%)</Label>
                <Input id="targetPercentage" name="targetPercentage" type="number" min="0" max="100" value={questionFormData.targetPercentage} onChange={handleQuestionFormChange} placeholder="Ex: 70" className="mt-1 bg-secondary"/>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsQuestionModalOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveQuestionLog}>Salvar Registro</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isRevisionModalOpen && currentTopicIdForRevisionModal && hasAccess && (
        <AlertDialog open={isRevisionModalOpen} onOpenChange={setIsRevisionModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Agendar Revisão</AlertDialogTitle>
                    <AlertDialogDescription>
                        Para o tópico: {subject?.topics.find(t => t.id === currentTopicIdForRevisionModal)?.name || 'Desconhecido'}.
                        Informe em quantos dias você deseja revisar este assunto.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="daysToReview">Revisar em (dias)</Label>
                        <Input 
                            id="daysToReview" 
                            name="daysToReview" 
                            type="number" 
                            value={daysToReviewInput} 
                            onChange={(e) => setDaysToReviewInput(e.target.value)} 
                            placeholder="Ex: 7" 
                            className="mt-1 bg-secondary"
                            min="1"
                        />
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsRevisionModalOpen(false)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSaveRevisionSchedule}>Salvar Agendamento</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </PageWrapper>
  );
}
