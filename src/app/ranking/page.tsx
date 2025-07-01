
"use client";

import { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, AlertTriangle, Trophy, Medal, Award, HelpCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RankingUser {
  id: string;
  name: string;
  avatarUrl?: string;
  totalStudyTime: number; // in seconds
  totalQuestionsAnswered: number;
}

const formatTotalDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
};

const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return '?';
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
};

const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-orange-400" />;
    return <span className="text-sm font-medium text-muted-foreground">{rank}</span>;
};


export default function RankingPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [rankingData, setRankingData] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState('all_time');

  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const date = subMonths(now, i);
        months.push({
            value: format(date, 'yyyy-MM'),
            label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
        });
    }
    return months;
  }, []);

  useEffect(() => {
    const fetchRankingData = async () => {
      setLoading(true);
      setError(null);
      
      const url = monthFilter === 'all_time' 
        ? '/api/ranking'
        : `/api/ranking?month=${monthFilter}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Não foi possível carregar o ranking. Tente novamente mais tarde.');
        }
        const data: RankingUser[] = await response.json();
        setRankingData(data);
      } catch (err: any) {
        setError(err.message);
        toast({
          title: "Erro ao Carregar Ranking",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchRankingData();
  }, [toast, monthFilter]);
  
  if (authLoading) {
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
              <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para ver o ranking.</p>
              <Button asChild size="lg">
                <Link href="/login?redirect=/ranking">Fazer Login</Link>
              </Button>
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
          title="Ranking de Estudos"
          description="Veja quem são os usuários mais dedicados da plataforma."
          actions={
            <div className="w-full sm:w-auto">
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filtrar por mês..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all_time">Ranking Geral</SelectItem>
                        {availableMonths.map(month => (
                            <SelectItem key={month.value} value={month.value}>
                                {month.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          }
        />
        
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
              <CardTitle>Classificação</CardTitle>
              <CardDescription className="flex items-center gap-1.5 pt-1">
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>A classificação é baseada no tempo de estudo e na quantidade de questões respondidas.</span>
              </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-10 text-destructive">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg font-semibold">{error}</p>
              </div>
            ) : rankingData.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground">
                    <Trophy className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-semibold">O Ranking ainda está vazio para este período.</p>
                    <p>Ninguém pontuou no período selecionado. Tente o ranking geral.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px] text-center">Posição</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead className="text-right">Tempo de Estudo</TableHead>
                            <TableHead className="text-right">Questões</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rankingData.map((rankedUser, index) => {
                        const rank = index + 1;
                        const isCurrentUser = rankedUser.id === user.id;
                        return (
                            <TableRow key={rankedUser.id} className={cn(isCurrentUser && 'bg-primary/10')}>
                                <TableCell className="text-center">
                                    <div className="flex justify-center items-center h-full">
                                        <RankIcon rank={rank} />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={rankedUser.avatarUrl} alt={rankedUser.name} />
                                            <AvatarFallback>{getInitials(rankedUser.name)}</AvatarFallback>
                                        </Avatar>
                                        <span className={cn("font-medium", isCurrentUser && "text-primary")}>
                                            {rankedUser.name}
                                            {isCurrentUser && " (Você)"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-base font-mono">
                                    {formatTotalDuration(rankedUser.totalStudyTime)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-base font-mono">
                                    {rankedUser.totalQuestionsAnswered.toLocaleString('pt-BR')}
                                </TableCell>
                            </TableRow>
                        );
                        })}
                    </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
