
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ShieldCheck, Users, CheckCircle, Filter, XCircle, Clock, CalendarX, Info, CreditCard, Search as SearchIcon } from 'lucide-react';
import type { User, PlanId, PlanDetails } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAuth } from 'firebase/auth';
import { processRefund } from '@/actions/admin-actions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum";
    const names: Record<PlanId, string> = {
        plano_mensal: 'Mensal',
        plano_cargo: 'Cargo',
        plano_edital: 'Edital',
        plano_trial: 'Trial'
    };
    return names[planId] || 'Desconhecido';
};

const PlanStatusBadge = ({ status }: { status: PlanDetails['status'] }) => {
    switch (status) {
        case 'refundRequested':
            return <Badge variant="destructive" className="cursor-pointer self-start"><Clock className="mr-1.5 h-3 w-3"/> Reembolso Solicitado</Badge>;
        case 'canceled':
             return <Badge variant="secondary" className="cursor-pointer self-start"><CalendarX className="mr-1.5 h-3 w-3"/> Cancelado</Badge>;
        case 'past_due':
             return <Badge variant="destructive" className="cursor-pointer self-start"><Clock className="mr-1.5 h-3 w-3"/> Pag. Pendente</Badge>;
        default:
             return null;
    }
}

export default function AdminPage() {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingRefundId, setProcessingRefundId] = useState<string | null>(null);
    const { toast } = useToast();
    const [refundFilter, setRefundFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        try {
            setLoadingData(true);
            const auth = getAuth();
            const currentUser = auth.currentUser;

            if (!currentUser) {
                throw new Error("Usuário não autenticado para fazer a solicitação.");
            }
            
            const idToken = await currentUser.getIdToken();

            const res = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Falha ao analisar a resposta de erro.' }));
                throw new Error(errorData.error || `Falha ao buscar dados dos usuários. Status: ${res.status}`);
            }
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!adminUser) {
                router.push('/login?redirect=/admin');
                return;
            }
            fetchUsers();
        }
    }, [adminUser, authLoading, router]);
    
    const dashboardMetrics = useMemo(() => {
        const totalUsers = users.length;
        const activeSubscriptions = users.reduce((acc, user) => {
            const activePaidPlans = user.activePlans?.filter(p => p.planId !== 'plano_trial' && p.status === 'active').length ?? 0;
            return acc + activePaidPlans;
        }, 0);
        const pendingRefunds = users.filter(u => u.activePlans?.some(p => p.status === 'refundRequested')).length;

        return { totalUsers, activeSubscriptions, pendingRefunds };
    }, [users]);


    const filteredUsers = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        
        return users.filter(u => {
            // Search filter
            const matchesSearch = searchTerm === '' ||
                (u.name && u.name.toLowerCase().includes(lowercasedSearchTerm)) ||
                (u.email && u.email.toLowerCase().includes(lowercasedSearchTerm));
            if (!matchesSearch) return false;

            // Refund status filter
            if (refundFilter === 'all') {
                return true;
            }
            if (refundFilter === 'refundRequested') {
                return u.activePlans?.some(p => p.status === 'refundRequested');
            }
            if (refundFilter === 'refunded') {
                return u.planHistory?.some(p => p.status === 'refunded');
            }
            return false;
        });
    }, [users, refundFilter, searchTerm]);
    
    const handleProcessRefund = async (userId: string, paymentIntentId: string) => {
        setProcessingRefundId(paymentIntentId);
        try {
            const idToken = await getAuth().currentUser?.getIdToken();
            if (!idToken) throw new Error("Token de autenticação não encontrado.");
            
            await processRefund({ userId, paymentIntentId, idToken });
            toast({
                title: "Reembolso Processado!",
                description: "O status do plano foi atualizado para reembolsado.",
                variant: 'default',
                className: "bg-accent text-accent-foreground",
            });
            await fetchUsers(); // Recarrega os dados para refletir a mudança
        } catch (error: any) {
            toast({
                title: "Erro ao Processar Reembolso",
                description: error.message || "Não foi possível atualizar o status do plano.",
                variant: 'destructive',
            });
        } finally {
            setProcessingRefundId(null);
        }
    };

    if (authLoading || loadingData) {
        return (
            <PageWrapper>
                <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </PageWrapper>
        );
    }
    
    return (
        <PageWrapper>
            <div className="container mx-auto px-4 py-8">
                <PageHeader
                    title="Painel do Administrador"
                    description="Gerencie e visualize os usuários e suas assinaturas."
                />

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardMetrics.totalUsers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardMetrics.activeSubscriptions}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Reembolsos Pendentes</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{dashboardMetrics.pendingRefunds}</div>
                        </CardContent>
                    </Card>
                </div>


                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="flex items-center">
                                    <Users className="mr-2 h-5 w-5" />
                                    Lista de Usuários
                                </CardTitle>
                                <CardDescription>
                                    Exibindo {filteredUsers.length} de {users.length} usuário(s) cadastrado(s).
                                </CardDescription>
                            </div>
                             <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4">
                                <div className="relative w-full sm:w-64">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar por nome ou email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <div className="w-full sm:w-auto">
                                    <Label htmlFor="refund-filter" className="text-xs text-muted-foreground sr-only">Filtrar por reembolso</Label>
                                    <Select value={refundFilter} onValueChange={setRefundFilter}>
                                        <SelectTrigger id="refund-filter" className="w-full sm:w-[200px]">
                                            <SelectValue placeholder="Filtrar por status..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os Usuários</SelectItem>
                                            <SelectItem value="refundRequested">Reembolsos Pendentes</SelectItem>
                                            <SelectItem value="refunded">Reembolsados</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div className="text-destructive text-center py-8">
                                <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                                <p>{error}</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Planos Ativos</TableHead>
                                            <TableHead>Detalhes da Transação</TableHead>
                                            <TableHead className="text-center">Status Admin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.map((u) => (
                                            <TableRow key={u.id}>
                                                <TableCell className="font-medium">{u.name}</TableCell>
                                                <TableCell>{u.email}</TableCell>
                                                <TableCell>
                                                    {u.activePlans && u.activePlans.length > 0 ? (
                                                        <div className="flex flex-col gap-2">
                                                            {u.activePlans.map((plan: PlanDetails) => (
                                                                <div key={plan.stripePaymentIntentId || plan.stripeSubscriptionId || plan.startDate} className="flex flex-col gap-1">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <div className='flex items-center gap-2'>
                                                                                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'} className={cn(plan.planId === 'plano_trial' && 'bg-green-500/10 text-green-700 border-green-500/30')}>{getPlanDisplayName(plan.planId)}</Badge>
                                                                                    <PlanStatusBadge status={plan.status}/>
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent className='text-sm'>
                                                                                <p>ID Assinatura: {plan.stripeSubscriptionId || 'N/A'}</p>
                                                                                <p>ID Pagamento: {plan.stripePaymentIntentId || 'N/A'}</p>
                                                                                {plan.startDate && <p>Início: {format(parseISO(plan.startDate), 'dd/MM/yy', {locale: ptBR})}</p>}
                                                                                {plan.expiryDate && <p>Expira: {format(parseISO(plan.expiryDate), 'dd/MM/yy', {locale: ptBR})}</p>}
                                                                                {plan.status === 'refundRequested' && plan.requestDate && <p>Solicitado em: {format(parseISO(plan.requestDate), 'dd/MM/yy HH:mm', {locale: ptBR})}</p>}
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    {plan.status === 'refundRequested' && plan.stripePaymentIntentId && (
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="outline" 
                                                                            className="h-7 text-xs"
                                                                            onClick={() => handleProcessRefund(u.id, plan.stripePaymentIntentId!)}
                                                                            disabled={processingRefundId === plan.stripePaymentIntentId}
                                                                        >
                                                                            {processingRefundId === plan.stripePaymentIntentId ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <CheckCircle className="h-3 w-3 mr-1"/>}
                                                                            Processar Reembolso
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline">Nenhum</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {u.planHistory && u.planHistory.length > 0 ? (
                                                        <div className="flex flex-col gap-2 text-xs">
                                                            {u.planHistory.map((plan: PlanDetails) => {
                                                                const adminProcessor = plan.refundedBy ? users.find(adm => adm.id === plan.refundedBy) : null;
                                                                return (
                                                                    <div key={plan.stripePaymentIntentId || plan.startDate} className="p-2 border rounded-md bg-muted/50">
                                                                        <div className="font-semibold flex items-center gap-2">
                                                                            {plan.status === 'refunded' ? <XCircle className="h-3 w-3 text-destructive"/> : <Info className="h-3 w-3 text-muted-foreground"/>}
                                                                            <span>{plan.status === 'refunded' ? 'Reembolsado' : 'Expirado'}: {getPlanDisplayName(plan.planId)}</span>
                                                                        </div>
                                                                        {plan.status === 'refunded' && (
                                                                            <>
                                                                                {plan.refundedDate && <p>Data: {format(parseISO(plan.refundedDate), 'dd/MM/yy HH:mm', { locale: ptBR })}</p>}
                                                                                {adminProcessor && <p>Por: {adminProcessor.name}</p>}
                                                                            </>
                                                                        )}
                                                                         {plan.status !== 'refunded' && plan.expiryDate && (
                                                                             <p>Expirou em: {format(parseISO(plan.expiryDate), 'dd/MM/yy', { locale: ptBR })}</p>
                                                                         )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {u.isAdmin && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <ShieldCheck className="h-5 w-5 text-green-600" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Este usuário é um administrador.</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {filteredUsers.length === 0 && (
                                    <div className="text-center p-8 text-muted-foreground">
                                        <Filter className="mx-auto h-8 w-8 mb-2" />
                                        Nenhum usuário encontrado para o filtro selecionado.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
