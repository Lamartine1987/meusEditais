
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/hooks/use-auth';
import { AppLogo } from '@/components/layout/app-logo';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { sendPasswordReset, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      toast({ 
        title: "E-mail Enviado!", 
        description: "Verifique sua caixa de entrada para redefinir sua senha.", 
        variant: "default", 
        className: "bg-accent text-accent-foreground",
        duration: 7000,
      });
      router.push('/login'); 
    } catch (error: any) {
      let errorMessage = "Não foi possível enviar o e-mail de redefinição.";
       if (error.code === 'auth/invalid-email') {
        errorMessage = "O formato do e-mail é inválido.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "Nenhuma conta encontrada com este e-mail.";
      } else {
        console.error("Password reset failed with code:", error.code, error.message);
      }
      toast({ title: "Falha ao Redefinir Senha", description: errorMessage, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl bg-card">
        <CardHeader className="space-y-2 text-center border-b pb-6">
          <div className="inline-block mb-4 pt-2">
            <AppLogo />
          </div>
          <CardTitle className="text-2xl font-bold">Redefinir Senha</CardTitle>
          <CardDescription>Digite seu e-mail para receber o link de redefinição.</CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordReset}>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-base h-11 rounded-md shadow-sm"
                autoComplete="email"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
            <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting || authLoading}>
              {(isSubmitting || authLoading) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Enviar E-mail de Redefinição
            </Button>
            <Button variant="outline" className="w-full h-11 text-base" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Login
              </Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
