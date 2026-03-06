"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLogo } from '@/components/layout/app-logo';
import { Loader2, CheckCircle2, Zap, ShieldCheck, Sparkles, User, Mail, CreditCard, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerUser } from '@/actions/auth-actions';
import { Checkbox } from '@/components/ui/checkbox';

const validateCpf = (cpf: string): boolean => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    const digits = cpf.split('').map(Number);
    const calcDigit = (sliceEnd: number): number => {
        let sum = 0;
        for (let i = 0; i < sliceEnd; i++) sum += digits[i] * (sliceEnd + 1 - i);
        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };
    return calcDigit(9) === digits[9] && calcDigit(10) === digits[10];
};

const formatCpf = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .substring(0, 14);
};

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCpf(cpf)) {
      toast({ title: "CPF Inválido", description: "Por favor, insira um número de CPF válido.", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "Termos não aceitos", description: "Você precisa aceitar os termos para continuar.", variant: "destructive"});
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha Curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive"});
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas Divergentes", description: "As senhas não coincidem.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await registerUser({ name, email, cpf, password });
      if (result.error) throw new Error(result.error);
      toast({ title: "Conta Criada!", description: "Bem-vindo ao Meus Editais.", variant: "default", className: "bg-accent text-accent-foreground" });
      router.push('/');
    } catch (error: any) {
      toast({ title: "Erro no Cadastro", description: error.message, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* Lado Direito: Marketing */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-bl from-accent via-emerald-600 to-teal-900 p-12 text-white items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -ml-48 -mt-48 animate-pulse" />
        
        <div className="relative z-10 max-w-lg space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm text-sm font-medium">
              <Sparkles className="mr-2 h-4 w-4 text-yellow-300" />
              Comece agora mesmo
            </div>
            <h2 className="text-5xl font-black leading-tight tracking-tighter">
              Sua jornada rumo ao cargo público.
            </h2>
            <p className="text-xl text-white/80 font-medium">
              Crie sua conta em segundos e tenha acesso a ferramentas profissionais de organização de estudo.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-semibold">Acesso imediato aos editais</span>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-semibold">Teste grátis por 7 dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Esquerdo: Formulário */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[450px] space-y-8 animate-fade-in">
          <div className="flex flex-col items-center lg:items-start space-y-2">
            <AppLogo />
            <h1 className="text-3xl font-bold tracking-tight mt-4">Criar Conta</h1>
            <p className="text-muted-foreground text-center lg:text-left">
              Preencha os dados abaixo para iniciar sua preparação.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold ml-1">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input 
                    id="name" 
                    placeholder="Como quer ser chamado?" 
                    required 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold ml-1">E-mail</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="seu@email.com" 
                      required 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-sm font-semibold ml-1">CPF</Label>
                  <div className="relative group">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input 
                      id="cpf" 
                      placeholder="000.000.000-00" 
                      required 
                      value={cpf} 
                      onChange={(e) => setCpf(formatCpf(e.target.value))} 
                      className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm" 
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" title="Senha" className="text-sm font-semibold ml-1">Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Mín. 6 caracteres" 
                      required 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" title="Confirmar Senha" className="text-sm font-semibold ml-1">Confirmar Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      placeholder="Repita a senha" 
                      required 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      className="h-12 pl-10 border-muted-foreground/20 bg-muted/20 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all rounded-xl shadow-sm" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-2 pt-2 px-1">
              <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked as boolean)} />
              <Label htmlFor="terms" className="text-xs leading-snug text-muted-foreground cursor-pointer">
                Eu li e concordo com os{' '}
                <Link href="/termos-de-uso" target="_blank" className="text-primary font-bold hover:underline">Termos de Uso</Link> e a{' '}
                <Link href="/politica-de-privacidade" target="_blank" className="text-primary font-bold hover:underline">Política de Privacidade</Link>.
              </Label>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 rounded-xl" disabled={isSubmitting || !termsAccepted}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Cadastrar Agora
            </Button>

            <div className="text-center text-sm text-muted-foreground pt-4">
              Já possui uma conta?{' '}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Fazer login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
