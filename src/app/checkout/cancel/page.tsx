
"use client";

import Link from 'next/link';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

export default function CheckoutCancelPage() {
  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-15rem)]">
        <Card className="w-full max-w-md shadow-2xl rounded-xl bg-card text-center">
          <CardHeader className="pt-8 pb-4">
            <XCircle className="mx-auto h-20 w-20 text-destructive mb-4" />
            <CardTitle className="text-3xl font-bold">Pagamento Cancelado</CardTitle>
            <CardDescription className="text-lg text-muted-foreground pt-2">
              Seu processo de pagamento foi cancelado ou não foi concluído.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <p className="text-muted-foreground mb-6">
              Nenhuma cobrança foi realizada. Se você mudou de ideia ou teve algum problema,
              pode tentar novamente ou escolher outro plano.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" variant="outline" className="text-base">
                    <Link href="/planos">
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Ver Planos
                    </Link>
                </Button>
                 <Button asChild size="lg" className="text-base">
                    <Link href="/">
                    Página Inicial
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
