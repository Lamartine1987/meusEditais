
"use client";

import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Shield, User, Info, Package, DollarSign } from 'lucide-react';
import { adminDb } from '@/lib/firebase-admin'; // This is a trick; it won't work client-side.
import { ref, get } from "firebase/database";
import type { User as AppUser, PlanDetails, Edital, Cargo } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface RefundRequest extends PlanDetails {
  user: {
    id: string;
    name: string;
    email: string;
  };
  editalName?: string;
  cargoName?: string;
}

// NOTE: This component fetches ALL user data. This is NOT scalable for a large user base.
// For a real-world scenario with many users, this should be refactored to use a more
// efficient query, possibly denormalizing refund requests into a separate DB node.

export default function AdminPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [allEditais, setAllEditais] = useState<Edital[]>([]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      router.push('/');
    }
  }, [user, authLoading, isAdmin, router, toast]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch all necessary data in parallel
        const [usersSnapshot, editaisResponse] = await Promise.all([
          get(ref(window.firebaseDb, 'users')), // Use a client-side DB instance
          fetch('/api/editais')
        ]);

        const allUsersData: Record<string, AppUser> = usersSnapshot.val() || {};
        const allEditaisData: Edital[] = await editaisResponse.json();
        setAllEditais(allEditaisData);

        const requests: RefundRequest[] = [];
        for (const userId in allUsersData) {
          const userData = allUsersData[userId];
          const plansToRefund = userData.activePlans?.filter(p => p.status === 'refundRequested') || [];
          
          plansToRefund.forEach(plan => {
            let editalName, cargoName;

            if (plan.planId === 'plano_edital' && plan.selectedEditalId) {
                editalName = allEditaisData.find(e => e.id === plan.selectedEditalId)?.title;
            } else if (plan.planId === 'plano_cargo' && plan.selectedCargoCompositeId) {
                const parts = plan.selectedCargoCompositeId.split('_');
                const editalId = parts[0];
                const cargoId = parts[1];
                const edital = allEditaisData.find(e => e.id === editalId);
                const cargo = edital?.cargos?.find(c => c.id === cargoId);
                editalName = edital?.title;
                cargoName = cargo?.name;
            }

            requests.push({
              ...plan,
              user: {
                id: userId,
                name: userData.name,
                email: userData.email,
              },
              editalName,
              cargoName,
            });
          });
        }
        setRefundRequests(requests.sort((a,b) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime()));
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
        toast({
          title: "Erro ao Carregar Dados",
          description: "Não foi possível buscar as solicitações de reembolso.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    };
    
    fetchData();
  }, [isAdmin, toast]);
  

  if (authLoading || !isAdmin) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader
          title="Painel Administrativo"
          description="Gerencie solicitações e outras tarefas administrativas."
        />

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="mr-3 h-6 w-6 text-destructive" />
              Solicitações de Reembolso
            </CardTitle>
            <CardDescription>
              Usuários que solicitaram o reembolso de seus planos. Após processar o estorno no Stripe, o plano será removido automaticamente via webhook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            ) : refundRequests.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-semibold">Nenhuma solicitação de reembolso pendente.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Plano</TableHead>
                            <TableHead>Detalhes</TableHead>
                            <TableHead className="text-center">Data da Solicitação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {refundRequests.map(req => (
                            <TableRow key={req.stripePaymentIntentId || req.user.id}>
                                <TableCell>
                                    <div className="font-medium">{req.user.name}</div>
                                    <div className="text-xs text-muted-foreground">{req.user.email}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center">
                                       <Package className="h-4 w-4 mr-2 text-primary" />
                                       {req.planId === 'plano_anual' ? 'Plano Anual' : req.planId === 'plano_edital' ? 'Plano Edital' : 'Plano Cargo'}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {req.editalName && <div>Edital: {req.editalName}</div>}
                                    {req.cargoName && <div>Cargo: {req.cargoName}</div>}
                                </TableCell>
                                <TableCell className="text-center">
                                    {req.requestDate ? new Date(req.requestDate).toLocaleDateString('pt-BR') : 'N/A'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm">
                                        <a href={`https://dashboard.stripe.com/customers/${req.stripeCustomerId}`} target="_blank" rel="noopener noreferrer">
                                            Ver no Stripe
                                        </a>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

// We need to declare firebaseDb on the window object for our client-side trick to work
declare global {
  interface Window {
    firebaseDb: any;
  }
}

if (typeof window !== 'undefined') {
  const { db } = require('@/lib/firebase');
  window.firebaseDb = db;
}
