"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/hooks/use-auth';
import { AppLogo } from '@/components/layout/app-logo';
import { Loader2, ArrowLeft, ShieldCheck, Mail, Sparkles } from 'lucide-react';
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
      if (error.code === 'auth/user-not-found') errorMessage = "Nenhuma conta encontrada com este e-mail.";
      toast({ title: "Falha ao Redefinir", description: errorMessage, variant: "destructive"});
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
            <h1 className="text-3xl font-bold tracking-tight mt-4">Recuperar Senha</h1>
            <p className="text-muted-foreground text-center lg:text-left">
              Enviaremos um link de redefinição para o seu e-mail cadastrado.
            </p>
          </div>

          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold ml-1">Seu E-mail</Label>
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

            <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 rounded-xl" disabled={isSubmitting || authLoading}>
              {(isSubmitting || authLoading) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Enviar Link de Recuperação
            </Button>

            <Button variant="ghost" className="w-full h-12 text-muted-foreground hover:text-primary rounded-xl" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Link>
            </Button>
          </form>
        </div>
      </div>

      {/* Lado Direito: Marketing */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900 p-12 text-white items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 border border-white/20 rounded-full" />
            <div className="absolute top-1/3 left-1/3 w-96 h-96 border border-white/10 rounded-full" />
        </div>
        
        <div className="relative z-10 max-w-lg space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm text-sm font-medium">
              <ShieldCheck className="mr-2 h-4 w-4 text-green-300" />
              Segurança em primeiro lugar
            </div>
            <h2 className="text-5xl font-black leading-tight tracking-tighter">
              Proteja seus dados e seu progresso.
            </h2>
            <p className="text-xl text-white/80 font-medium">
              Sua conta é pessoal e intransferível. Mantenha sua senha segura para garantir que seu histórico de estudos esteja sempre protegido.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
            <h3 className="font-bold text-lg mb-2 flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-yellow-300" />
                Dica de Segurança
            </h3>
            <p className="text-white/70 italic text-sm">
                "Uma senha forte contém uma mistura de letras maiúsculas, minúsculas, números e símbolos especiais. Evite usar datas de nascimento ou nomes óbvios."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
