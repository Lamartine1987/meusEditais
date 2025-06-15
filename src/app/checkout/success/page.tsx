
"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
// import { stripe } from '@/lib/stripe'; // Not needed client-side for this page typically

export default function CheckoutSuccessPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    // You could potentially verify the session server-side here if needed,
    // but typically the webhook handles the subscription update.
    // For now, just show a success message.
    if (sessionId) {
        toast({
            title: "Pagamento Bem-sucedido!",
            description: "Sua assinatura foi ativada. Obrigado!",
            variant: "default",
            className: "bg-accent text-accent-foreground",
            duration: 7000,
        });
    } else {
        // This case might happen if user navigates here directly without a session_id
        // or if there's an issue with redirect.
         toast({
            title: "Status do Pagamento",
            description: "Seu pagamento está sendo processado ou foi concluído.",
            variant: "default",
            duration: 7000,
        });
    }
  }, [toast, searchParams]);

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-15rem)]">
        <Card className="w-full max-w-md shadow-2xl rounded-xl bg-card text-center">
          <CardHeader className="pt-8 pb-4">
            <CheckCircle className="mx-auto h-20 w-20 text-green-500 mb-4" />
            <CardTitle className="text-3xl font-bold">Pagamento Realizado com Sucesso!</CardTitle>
            <CardDescription className="text-lg text-muted-foreground pt-2">
              Obrigado pela sua assinatura. Seu plano está ativo!
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <p className="text-muted-foreground mb-6">
              Você já pode aproveitar todos os benefícios do seu novo plano.
              Seu acesso foi atualizado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="text-base">
                <Link href="/perfil">
                  Ir para Meu Perfil
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base">
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
