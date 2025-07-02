
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Dices, RotateCcw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { Edital, Cargo, Subject, Topic } from '@/types';
import { generateQuizQuestion, type GenerateQuestionOutput } from '@/ai/flows/generate-question-flow';
import { cn } from '@/lib/utils';

type AllTopics = {
  topic: Topic;
  subject: Subject;
  cargo: Cargo;
  edital: Edital;
};

export default function RoletaDeQuestoesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [allEditais, setAllEditais] = useState<Edital[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [allUserTopics, setAllUserTopics] = useState<AllTopics[]>([]);
  const [allSubjectNames, setAllSubjectNames] = useState<string[]>([]);
  const [selectedTopicInfo, setSelectedTopicInfo] = useState<AllTopics | null>(null);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [questionData, setQuestionData] = useState<GenerateQuestionOutput | null>(null);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const [rouletteDisplayText, setRouletteDisplayText] = useState<string | null>(null);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all editais data once
  useEffect(() => {
    const fetchAllEditais = async () => {
      setDataLoading(true);
      try {
        const response = await fetch('/api/editais');
        if (!response.ok) throw new Error('Falha ao buscar dados dos editais.');
        const data: Edital[] = await response.json();
        setAllEditais(data);
      } catch (error: any) {
        toast({ title: "Erro ao Carregar Dados", description: error.message, variant: "destructive" });
      } finally {
        setDataLoading(false);
      }
    };
    fetchAllEditais();
  }, [toast]);

  // Populate user topics based on registered cargos and fetched editais
  useEffect(() => {
    if (authLoading || dataLoading || !user?.registeredCargoIds) return;

    const topics: AllTopics[] = [];
    user.registeredCargoIds.forEach(compositeId => {
      for (const edital of allEditais) {
        if (compositeId.startsWith(`${edital.id}_`)) {
          const cargoId = compositeId.substring(edital.id.length + 1);
          const cargo = edital.cargos?.find(c => c.id === cargoId);
          if (cargo?.subjects) {
            cargo.subjects.forEach(subject => {
              subject.topics?.forEach(topic => {
                topics.push({ topic, subject, cargo, edital });
              });
            });
          }
        }
      }
    });
    setAllUserTopics(topics);
    const uniqueSubjectNames = [...new Set(topics.map(t => t.subject.name))];
    setAllSubjectNames(uniqueSubjectNames);
  }, [user, allEditais, authLoading, dataLoading]);
  
  const resetGameState = useCallback(() => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      setSelectedTopicInfo(null);
      setQuestionData(null);
      setSelectedAnswer(null);
      setShowResult(false);
      setRouletteDisplayText(null);
  }, []);

  const handleSpin = async () => {
    if (allUserTopics.length === 0) {
      toast({ title: "Nenhum Assunto Encontrado", description: "Inscreva-se em um cargo com matérias cadastradas para jogar.", variant: "destructive" });
      return;
    }
    
    resetGameState();
    setIsSpinning(true);

    // Start roulette text animation
    if (allSubjectNames.length > 0) {
      let i = 0;
      spinIntervalRef.current = setInterval(() => {
        setRouletteDisplayText(allSubjectNames[i % allSubjectNames.length]);
        i++;
      }, 100);
    }

    const randomIndex = Math.floor(Math.random() * allUserTopics.length);
    const randomTopicInfo = allUserTopics[randomIndex];
    
    // Simulate spin duration
    setTimeout(async () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      
      setSelectedTopicInfo(randomTopicInfo);
      setRouletteDisplayText(randomTopicInfo.subject.name); // Final text
      setIsSpinning(false);
      setIsGeneratingQuestion(true);
      try {
        const result = await generateQuizQuestion({
          subjectName: randomTopicInfo.subject.name,
          topicName: randomTopicInfo.topic.name,
        });
        setQuestionData(result);
      } catch (error) {
        console.error("Detailed error generating question:", error);
        toast({ title: "Erro ao Gerar Questão", description: "Não foi possível criar uma questão. Verifique o console para mais detalhes.", variant: "destructive" });
        resetGameState();
      } finally {
        setIsGeneratingQuestion(false);
      }
    }, 3000); // Corresponds to the animation duration
  };
  
  const handleAnswerSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
  }

  const handleConfirmAnswer = () => {
    if (selectedAnswer === null) {
      toast({ title: "Selecione uma resposta", description: "Você precisa escolher uma alternativa antes de confirmar." });
      return;
    }
    setShowResult(true);
  };

  const getResultIcon = (index: number) => {
      if (!showResult || questionData === null) return null;
      const isCorrect = index === questionData.correctAnswerIndex;
      const isSelected = index === selectedAnswer;
      if (isCorrect) return <CheckCircle className="h-5 w-5 text-green-500" />;
      if (isSelected && !isCorrect) return <XCircle className="h-5 w-5 text-red-500" />;
      return null;
  };

  const getButtonClass = (index: number) => {
    if (!showResult || questionData === null) return "bg-secondary text-secondary-foreground hover:bg-muted";

    const isCorrect = index === questionData.correctAnswerIndex;
    const isSelected = index === selectedAnswer;
    
    if (isCorrect) return "bg-green-100 dark:bg-green-900/50 border-green-500 text-green-800 dark:text-green-300";
    if (isSelected && !isCorrect) return "bg-red-100 dark:bg-red-900/50 border-red-500 text-red-800 dark:text-red-300";
    return "bg-secondary text-secondary-foreground opacity-70";
  };


  if (authLoading || dataLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg rounded-xl">
            <CardHeader>
                <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
                <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para acessar a Roleta de Questões.</p>
                <Button asChild size="lg"><Link href="/login?redirect=/roleta-de-questoes">Fazer Login</Link></Button>
            </CardContent>
        </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Roleta de Questões" 
          description="Gire a roleta para testar seus conhecimentos de forma divertida!"
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Roleta e Ação */}
            <Card className="shadow-lg rounded-xl bg-card lg:sticky lg:top-24">
                <CardHeader className="text-center">
                    <CardTitle>Gire para Sortear um Assunto</CardTitle>
                    <CardDescription>Clique no botão para começar!</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-6 py-10">
                    <div 
                        className={cn(
                            "relative w-64 h-64 rounded-full border-8 border-primary/50 bg-muted flex items-center justify-center text-center transition-transform duration-3000 ease-out",
                            isSpinning && "animate-spin-roulette"
                        )}
                    >
                        {rouletteDisplayText ? (
                            <span className="text-2xl font-bold text-primary p-4">{rouletteDisplayText}</span>
                        ) : (
                            <Dices className="h-24 w-24 text-primary opacity-50" />
                        )}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-destructive"></div>
                    </div>
                     <Button 
                        size="lg" 
                        className="w-full max-w-xs text-lg h-12"
                        onClick={handleSpin}
                        disabled={isSpinning || isGeneratingQuestion}
                    >
                       {(isSpinning || isGeneratingQuestion) ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <RotateCcw className="mr-2 h-5 w-5" />
                        )}
                        {isSpinning ? 'Girando...' : isGeneratingQuestion ? 'Gerando Questão...' : 'Girar a Roleta!'}
                    </Button>
                </CardContent>
            </Card>

            {/* Display da Questão */}
            <Card className="shadow-lg rounded-xl bg-card min-h-[30rem]">
                <CardHeader>
                    {selectedTopicInfo ? (
                        <>
                            <CardTitle>Questão sobre: {selectedTopicInfo.topic.name}</CardTitle>
                            <CardDescription>Matéria: {selectedTopicInfo.subject.name} | Cargo: {selectedTopicInfo.cargo.name}</CardDescription>
                        </>
                    ) : (
                        <CardTitle>Aguardando um assunto...</CardTitle>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    {isGeneratingQuestion && (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground pt-10">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p className="font-semibold">A Banca Examinadora está preparando sua questão...</p>
                        </div>
                    )}

                    {questionData ? (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-base font-semibold leading-relaxed">{questionData.question}</p>
                            <div className="space-y-3">
                                {questionData.options.map((option, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        className={cn("w-full h-auto text-wrap justify-between p-4 text-left font-normal", getButtonClass(index))}
                                        onClick={() => handleAnswerSelect(index)}
                                        disabled={showResult}
                                    >
                                        <span>{option}</span>
                                        {getResultIcon(index)}
                                    </Button>
                                ))}
                            </div>

                            {showResult && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded-md mt-6 animate-fade-in">
                                    <h4 className="font-bold text-blue-800 dark:text-blue-300">Explicação:</h4>
                                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">{questionData.explanation}</p>
                                </div>
                            )}

                            <div className="pt-4">
                                {!showResult ? (
                                    <Button onClick={handleConfirmAnswer} className="w-full" disabled={selectedAnswer === null}>
                                        Confirmar Resposta
                                    </Button>
                                ) : (
                                    <Button onClick={handleSpin} className="w-full">
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Jogar Novamente
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        !isGeneratingQuestion && (
                            <div className="flex flex-col items-center justify-center text-center text-muted-foreground pt-10">
                                <Dices className="h-16 w-16 opacity-30 mb-4" />
                                <p className="font-semibold">Gire a roleta ao lado para começar!</p>
                                <p className="text-sm">Uma questão sobre um assunto dos seus cargos inscritos será gerada aqui.</p>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
