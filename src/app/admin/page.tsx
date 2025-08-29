"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ShieldCheck, Users, BadgeHelp, CheckCircle, Filter } from 'lucide-react';
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


export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingRefundId, setProcessingRefundId] = useState<string | null>(null);
    const { toast } = useToast();
    const [refundFilter, setRefundFilter] = useState('all');

    const fetchUsers = async () => {
        try {
            setLoadingData(true);
            const auth = getAuth();
            const currentUser = auth.currentUser;

            if (!currentUser) {
                throw new Error("Usuário não autenticado para fazer a solicitação.");
            }
            
            const idToken = await currentUser.getIdToken();
            console.log("[AdminPage] Fetching users with token:", idToken ? "Token present" : "Token MISSING");

            const res = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Falha ao analisar a resposta de erro.' }));
                 console.error("[AdminPage] Error response from API:", res.status, errorData);
                throw new Error(errorData.error || `Falha ao buscar dados dos usuários. Status: ${res.status}`);
            }
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            console.error("[AdminPage] Error in fetchUsers:", err);
            setError(err.message);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login?redirect=/admin');
                return;
            }
            fetchUsers();
        }
    }, [user, authLoading, router]);

    const filteredUsers = useMemo(() => {
        if (refundFilter === 'all') {
            return users;
        }
        return users.filter(u => {
            if (refundFilter === 'refundRequested') {
                return u.activePlans?.some(p => p.status === 'refundRequested');
            }
            if (refundFilter === 'refunded') {
                return u.planHistory?.some(p => p.status === 'refunded');
            }
            return false;
        });
    }, [users, refundFilter]);
    
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
                            <div className="w-full sm:w-auto">
                                <Label htmlFor="refund-filter" className="text-xs text-muted-foreground">Filtrar por reembolso</Label>
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
                                                        <div className="flex flex-col gap-1.5">
                                                            {u.activePlans.map((plan: PlanDetails) => (
                                                                <div key={plan.stripePaymentIntentId || plan.startDate} className="flex flex-col gap-1">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Badge
                                                                                    variant={plan.status === 'refundRequested' ? 'destructive' : 'secondary'}
                                                                                    className="cursor-pointer self-start"
                                                                                >
                                                                                    {getPlanDisplayName(plan.planId)}
                                                                                    {plan.status === 'refundRequested' && <BadgeHelp className="ml-1.5 h-3 w-3"/>}
                                                                                </Badge>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>ID do Pagamento: {plan.stripePaymentIntentId || 'N/A'}</p>
                                                                                {plan.startDate && <p>Início: {format(parseISO(plan.startDate), 'dd/MM/yy', {locale: ptBR})}</p>}
                                                                                {plan.expiryDate && <p>Expira: {format(parseISO(plan.expiryDate), 'dd/MM/yy', {locale: ptBR})}</p>}
                                                                                {plan.status === 'refundRequested' && <p className="font-bold text-destructive">REEMBOLSO SOLICITADO</p>}
                                                                                {plan.requestDate && <p>Data Solicitação: {format(parseISO(plan.requestDate), 'dd/MM/yy HH:mm', {locale: ptBR})}</p>}
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
                                                                        <p className="font-semibold">
                                                                            {plan.status === 'refunded' ? 'Reembolsado' : 'Expirado'}: {getPlanDisplayName(plan.planId)}
                                                                        </p>
                                                                        {plan.status === 'refunded' && (
                                                                            <>
                                                                                {plan.refundedDate && <p>Data: {format(parseISO(plan.refundedDate), 'dd/MM/yy HH:mm', { locale: ptBR })}</p>}
                                                                                {adminProcessor && <p>Por: {adminProcessor.name}</p>}
                                                                            </>
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
