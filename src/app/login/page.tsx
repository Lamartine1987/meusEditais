
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/hooks/use-auth';
import { AppLogo } from '@/components/layout/app-logo';
import { Loader2, BookOpen, BarChart3, Clock, Sparkles, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast({ title: "Bem-vindo de volta!", variant: "default", className: "bg-accent text-accent-foreground" });
      router.push('/'); 
    } catch (error: any) {
      let errorMessage = "Credenciais inválidas. Verifique seu e-mail e senha.";
      if (error.code === 'auth/too-many-requests') errorMessage = "Muitas tentativas. Tente mais tarde.";
      toast({ title: "Falha no Login", description: errorMessage, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* Lado Esquerdo: Formulário */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px] space-y-8 animate-fade-in">
          <div className="flex flex-col items-center lg:items-start space-y-2">
            <AppLogo />
            <h1 className="text-3xl font-bold tracking-tight mt-4">Entrar</h1>
            <p className="text-muted-foreground text-center lg:text-left">
              Acesse sua conta para continuar sua jornada de aprovação.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold ml-1">E-mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="exemplo@email.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" title="Senha" className="text-sm font-semibold">Senha</Label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm"
                    autoComplete="current-password"
                  />
                </div>
                <div className="flex justify-end pr-1">
                   <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                    Esqueceu sua senha?
                  </Link>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 rounded-xl" disabled={isSubmitting || authLoading}>
              {(isSubmitting || authLoading) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Acessar Plataforma
            </Button>

            <div className="text-center text-sm text-muted-foreground pt-4">
              Ainda não tem conta?{' '}
              <Link href="/register" className="font-bold text-primary hover:underline">
                Cadastre-se grátis
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Lado Direito: Área de Marketing */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary via-purple-600 to-indigo-900 p-12 text-white items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl -ml-48 -mb-48" />
        
        <div className="relative z-10 max-w-lg space-y-10">
          <div className="space-y-4">
            <Badge variant="outline" className="bg-white/10 text-white border-white/20 px-4 py-1.5 backdrop-blur-sm text-sm font-medium">
              <Sparkles className="mr-2 h-4 w-4 text-yellow-300" />
              Sua aprovação começa aqui
            </Badge>
            <h2 className="text-5xl font-black leading-tight tracking-tighter">
              Transforme sua rotina de estudos.
            </h2>
            <p className="text-xl text-white/80 font-medium">
              A plataforma definitiva para organizar seus editais e acompanhar cada passo rumo ao cargo dos seus sonhos.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all hover:bg-white/10 group">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Editais Verticalizados</h3>
                <p className="text-white/70">Todo o conteúdo programático organizado tópico por tópico para você não perder nada.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all hover:bg-white/10 group">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Gestão de Revisões</h3>
                <p className="text-white/70">Sistema inteligente de agendamento para manter o conhecimento fresco na sua memória.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all hover:bg-white/10 group">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Estatísticas Reais</h3>
                <p className="text-white/70">Acompanhe seu desempenho em questões e tempo de estudo com gráficos detalhados.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
