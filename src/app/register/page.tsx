
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLogo } from '@/components/layout/app-logo';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerUser } from '@/actions/auth-actions'; // Import server action
import { Checkbox } from '@/components/ui/checkbox';

// Função para validar CPF
const validateCpf = (cpf: string): boolean => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;

    const digits = cpf.split('').map(Number);

    const calcDigit = (sliceEnd: number): number => {
        let sum = 0;
        for (let i = 0; i < sliceEnd; i++) {
            sum += digits[i] * (sliceEnd + 1 - i);
        }
        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };

    return calcDigit(9) === digits[9] && calcDigit(10) === digits[10];
};

// Função para formatar CPF
const formatCpf = (value: string): string => {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto entre o terceiro e o quarto dígitos
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto entre o terceiro e o quarto dígitos de novo (para o segundo bloco)
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2') // Coloca um hífen entre o terceiro e o quarto dígitos
    .substring(0, 14); // Limita o tamanho
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
      toast({ title: "Termos não aceitos", description: "Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.", variant: "destructive"});
      return;
    }

    if (password.length < 6) {
      toast({ title: "Senha Inválida", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive"});
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "Os campos de senha e confirmação devem ser iguais.", variant: "destructive"});
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await registerUser({ name, email, cpf, password });
      if (result.error) {
        throw new Error(result.error);
      }

      toast({ title: "Cadastro Realizado!", description: "Redirecionando para a página inicial...", variant: "default", className: "bg-accent text-accent-foreground" });
      router.push('/');

    } catch (error: any) {
      toast({ title: "Falha no Cadastro", description: error.message, variant: "destructive"});
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
              <Label htmlFor="cpf" className="font-semibold">CPF</Label>
              <Input 
                id="cpf" 
                type="text" 
                placeholder="000.000.000-00" 
                required 
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className="text-base h-11 rounded-md shadow-sm"
                autoComplete="off"
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-semibold">Confirmar Senha</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                placeholder="Repita a senha criada" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-base h-11 rounded-md shadow-sm"
                autoComplete="new-password"
              />
            </div>
            <div className="items-top flex space-x-2">
                <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked as boolean)} />
                <div className="grid gap-1.5 leading-none">
                <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Eu li e concordo com os{' '}
                    <Link href="/termos-de-uso" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link href="/politica-de-privacidade" target="_blank" className="underline underline-offset-4 hover:text-primary">
                    Política de Privacidade
                    </Link>
                    .
                </label>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
            <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting || !termsAccepted}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Cadastrar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
