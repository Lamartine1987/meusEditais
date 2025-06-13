
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
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha Inválida", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    try {
      await register(name, email, password);
      toast({ title: "Cadastro Realizado!", description: "Redirecionando para a página inicial...", variant: "default", className: "bg-accent text-accent-foreground" });
      router.push('/'); 
    } catch (error: any) {
      let errorMessage = "Não foi possível realizar o cadastro.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este e-mail já está em uso.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "O formato do e-mail é inválido.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "A senha é muito fraca. Tente uma senha mais forte.";
      } else {
         console.error("Registration failed with code:", error.code, error.message);
      }
      toast({ title: "Falha no Cadastro", description: errorMessage, variant: "destructive"});
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
          <CardTitle className="text-2xl font-bold">Crie sua Conta</CardTitle>
          <CardDescription>Preencha os campos abaixo para se registrar.</CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">Nome Completo</Label>
              <Input 
                id="name" 
                type="text" 
                placeholder="Seu nome completo" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base h-11 rounded-md shadow-sm"
                autoComplete="name"
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Crie uma senha (mín. 6 caracteres)" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base h-11 rounded-md shadow-sm"
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
            <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting || authLoading}>
              {(isSubmitting || authLoading) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Cadastrar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" passHref legacyBehavior>
                <a className="font-semibold text-primary hover:underline">Entrar</a>
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
