
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


export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('usuario@example.com'); // Pre-fill for demo
  const [password, setPassword] = useState('password'); // Pre-fill for demo

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast({ title: "Login Bem-sucedido!", description: "Redirecionando...", variant: "default", className: "bg-accent text-accent-foreground" });
      router.push('/'); 
    } catch (error) {
      toast({ title: "Falha no Login", description: "Email ou senha inválidos.", variant: "destructive"});
      console.error("Login failed", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl bg-card">
        <CardHeader className="space-y-2 text-center border-b pb-6">
          <div className="inline-block mb-4 pt-2">
            <AppLogo />
          </div>
          <CardTitle className="text-2xl font-bold">Bem-vindo de Volta!</CardTitle>
          <CardDescription>Entre com seu email e senha para continuar.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
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
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-semibold">Senha</Label>
                {/* <Link href="#" className="text-sm text-primary hover:underline">Esqueceu a senha?</Link> */}
              </div>
              <Input 
                id="password" 
                type="password" 
                placeholder="********" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base h-11 rounded-md shadow-sm"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Entrar
            </Button>
            {/* <p className="text-center text-sm text-muted-foreground">
              Não tem uma conta? <Link href="#" className="font-semibold text-primary hover:underline">Cadastre-se</Link>
            </p> */}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
