"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ShieldCheck, Users, BadgeHelp } from 'lucide-react';
import type { User, PlanDetails, PlanId } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAuth } from 'firebase/auth';

const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum";
    const names: Record<PlanId, string> = {
        plano_anual: 'Anual',
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

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login?redirect=/admin');
                return;
            }
            if (!user.isAdmin) {
                router.push('/'); // Redireciona para a home se não for admin
                return;
            }

            const fetchUsers = async () => {
                try {
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
                        const errorData = await res.json();
                        throw new Error(errorData.error || 'Falha ao buscar dados dos usuários.');
                    }
                    const data = await res.json();
                    setUsers(data);
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setLoadingData(false);
                }
            };

            fetchUsers();
        }
    }, [user, authLoading, router]);

    if (authLoading || loadingData) {
        return (
            <PageWrapper>
                <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </PageWrapper>
        );
    }

    if (!user?.isAdmin) {
         return (
            <PageWrapper>
                <div className="container mx-auto px-4 py-8 text-center">
                    <Card className="max-w-md mx-auto">
                        <CardHeader>
                            <CardTitle>Acesso Negado</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>Você não tem permissão para acessar esta página.</p>
                        </CardContent>
                    </Card>
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
                        <CardTitle className="flex items-center">
                            <Users className="mr-2 h-5 w-5" />
                            Lista de Usuários
                        </CardTitle>
                        <CardDescription>
                            Total de {users.length} usuário(s) cadastrado(s).
                        </CardDescription>
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
                                            <TableHead className="text-center">Admin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((u) => (
                                            <TableRow key={u.id}>
                                                <TableCell className="font-medium">{u.name}</TableCell>
                                                <TableCell>{u.email}</TableCell>
                                                <TableCell>
                                                    {u.activePlans && u.activePlans.length > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            {u.activePlans.map(plan => (
                                                                <TooltipProvider key={plan.stripePaymentIntentId || plan.startDate}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Badge
                                                                                variant={plan.status === 'refundRequested' ? 'destructive' : 'secondary'}
                                                                                className="cursor-pointer"
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
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline">Nenhum</Badge>
                                                    )}
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
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
