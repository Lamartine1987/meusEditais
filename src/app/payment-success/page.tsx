
"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth'; // Para forçar a recarga dos dados do usuário
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function PaymentSuccessPage() {
  const { user } = useAuth(); // Pode ser usado para obter dados atualizados do usuário se necessário
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Aqui, em uma implementação completa, você poderia fazer uma chamada para o seu backend
      // para verificar o status da sessão do Stripe e garantir que o pagamento foi de fato bem-sucedido
      // antes de mostrar a mensagem de sucesso ou atualizar o estado do usuário localmente.
      // Por ora, confiamos que o Stripe só redireciona para cá em caso de sucesso.
      console.log("Stripe Checkout Session ID:", sessionId);
      toast({
        title: "Pagamento Confirmado (Simulado)",
        description: "Seu pagamento foi processado. Um webhook confirmaria e ativaria seu plano.",
        variant: "default",
        className:"bg-accent text-accent-foreground",
        duration: 7000,
      });
      // Idealmente, o webhook do Stripe já teria atualizado o status do plano do usuário no DB.
      // O AuthProvider, ao detectar a mudança, atualizaria o estado `user`.
    }
  }, [searchParams, toast]);

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-16 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Card className="w-full max-w-lg shadow-2xl rounded-xl text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-green-700">Pagamento Bem-Sucedido!</CardTitle>
            <CardDescription className="text-lg text-muted-foreground pt-2">
              Obrigado pela sua compra! Seu plano será ativado em breve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Você está um passo mais perto de alcançar seus objetivos. <br/>
              Agradecemos por escolher nossa plataforma!
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Importante:</strong> Em uma aplicação real, a ativação do seu plano ocorreria após a confirmação do pagamento via webhook do Stripe.
              Esta página indica que o Stripe redirecionou você após um pagamento (simulado ou real).
            </p>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/perfil">
                Ver Meu Perfil e Plano
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4"/>
                Voltar para Início
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </PageWrapper>
  );
}
