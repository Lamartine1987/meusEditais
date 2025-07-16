
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Shield, Package } from 'lucide-react';
import type { PlanDetails } from '@/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export interface RefundRequest extends PlanDetails {
  user: {
    id: string;
    name: string;
    email: string;
  };
  editalName?: string;
  cargoName?: string;
  amount?: number | null;
  currency?: string | null;
}

interface AdminClientPageProps {
  initialRefundRequests: RefundRequest[];
}

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency.toUpperCase(),
    }).format(amount / 100);
}

export function AdminClientPage({ initialRefundRequests }: AdminClientPageProps) {
  const [refundRequests] = useState<RefundRequest[]>(initialRefundRequests);
  const [isLoadingData] = useState(false); // Can be used later if we add live updates

  return (
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
                        <TableHead className="text-center">Valor</TableHead>
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
                            <TableCell className="text-xs max-w-[200px] truncate">
                                {req.editalName && <div>Edital: {req.editalName}</div>}
                                {req.cargoName && <div>Cargo: {req.cargoName}</div>}
                            </TableCell>
                            <TableCell className="text-center">
                                {req.requestDate ? new Date(req.requestDate).toLocaleDateString('pt-BR') : 'N/A'}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                                {req.amount && req.currency ? formatCurrency(req.amount, req.currency) : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                                {req.stripePaymentIntentId ? (
                                    <Button asChild variant="outline" size="sm">
                                        <a href={`https://dashboard.stripe.com/payments/${req.stripePaymentIntentId}`} target="_blank" rel="noopener noreferrer">
                                            Reembolsar no Stripe
                                        </a>
                                    </Button>
                                ) : (
                                    <Button asChild variant="secondary" size="sm" disabled>
                                        <Link href="#">Link Indisponível</Link>
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
      </CardContent>
    </Card>
  );
}
