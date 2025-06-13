
"use client";

import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save, AlertTriangle, ShieldCheck, Gem, Edit3, KeyRound, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { mockEditais } from '@/lib/mock-data'; // Para buscar nomes de editais/cargos
import type { PlanId } from '@/types';

const profileSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateUser, sendPasswordReset, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
      });
    }
  }, [user, reset]);

  const onSubmitName: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user) return;
    try {
      await updateUser({ name: data.name }); 
      toast({
        title: "Nome Atualizado!",
        description: "Seu nome foi salvo com sucesso.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error) {
      toast({
        title: "Erro ao Atualizar Nome",
        description: "Não foi possível salvar seu nome. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      toast({ title: "Erro", description: "Email do usuário não encontrado.", variant: "destructive" });
      return;
    }
    setIsPasswordResetting(true);
    try {
      await sendPasswordReset(user.email);
      toast({
        title: "E-mail de Redefinição Enviado",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
        duration: 7000,
      });
    } catch (error: any) {
      let errorMessage = "Não foi possível enviar o e-mail de redefinição.";
       if (error.code === 'auth/too-many-requests') {
        errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
      }
      toast({ title: "Falha ao Enviar E-mail", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPasswordResetting(false);
    }
  };
  
  const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return '?';
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  };

  const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum plano ativo";
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo";
      case 'plano_edital': return "Plano Edital";
      case 'plano_anual': return "Plano Anual";
      default: return "Plano Desconhecido";
    }
  };

  const getPlanDetailsDescription = (): string | null => {
    if (!user || !user.activePlan || !user.planDetails) return null;

    const { planId, selectedCargoCompositeId, selectedEditalId, expiryDate } = user.planDetails;
    let details = "";

    if (planId === 'plano_cargo' && selectedCargoCompositeId) {
      const [editalId, cargoId] = selectedCargoCompositeId.split('_');
      const edital = mockEditais.find(e => e.id === editalId);
      const cargo = edital?.cargos?.find(c => c.id === cargoId);
      details = cargo ? `Acesso ao cargo: ${cargo.name} (${edital?.title || 'Edital Desc.'})` : `Acesso a um cargo específico.`;
    } else if (planId === 'plano_edital' && selectedEditalId) {
      const edital = mockEditais.find(e => e.id === selectedEditalId);
      details = edital ? `Acesso a todos os cargos do edital: ${edital.title}` : `Acesso a um edital específico.`;
    } else if (planId === 'plano_anual') {
      details = "Acesso ilimitado a todos os editais e cargos.";
    }

    if (expiryDate) {
      details += ` Expira em: ${new Date(expiryDate).toLocaleDateString('pt-BR')}.`;
    }
    return details.trim() || null;
  };

  if (authLoading && !user) { // Show loader only if user data is not yet available
    return (
       <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) { // If still no user after loading, then show restricted access
      return (
           <PageWrapper>
            <div className="container mx-auto px-4 py-8 text-center">
              <Card className="max-w-md mx-auto shadow-lg rounded-xl">
                <CardHeader>
                    <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
                    <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para acessar esta página.</p>
                    <Button asChild size="lg">
                        <Link href="/login">Fazer Login</Link>
                    </Button>
                </CardContent>
              </Card>
            </div>
          </PageWrapper>
      )
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais e de conta." />
        
        {/* Card de Informações Pessoais */}
        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader className="items-center text-center border-b pb-6">
            <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-background ring-offset-2">
              <AvatarImage src={user.avatarUrl} alt={user.name || 'Avatar'} data-ai-hint="user avatar large" />
              <AvatarFallback className="text-3xl font-semibold">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl">{user.name || 'Usuário'}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmitName)}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold flex items-center"><Edit3 className="mr-2 h-4 w-4 text-primary"/>Nome Completo</Label>
                <Input 
                  id="name" 
                  {...register('name')} 
                  placeholder="Seu nome completo"
                  className="text-base h-11 rounded-md shadow-sm"
                />
                {errors.name && <p className="text-sm text-destructive pt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={user.email || ''} 
                  readOnly 
                  disabled
                  placeholder="seu@email.com"
                  className="text-base h-11 rounded-md shadow-sm bg-muted/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground pt-1">O e-mail não pode ser alterado através desta página no momento.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={isSubmitting || authLoading} className="w-full sm:w-auto min-w-[150px] h-11 text-base">
                {(isSubmitting || authLoading) ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salvar Nome
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Card de Segurança da Conta */}
        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><ShieldCheck className="mr-3 h-6 w-6 text-primary"/>Segurança da Conta</CardTitle>
            <CardDescription>Gerencie sua senha.</CardDescription>
          </CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="font-semibold flex items-center"><KeyRound className="mr-2 h-4 w-4 text-primary"/>Senha</Label>
              <p className="text-sm text-muted-foreground">
                Para alterar sua senha, enviaremos um link de redefinição para seu e-mail.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handlePasswordReset} 
              disabled={isPasswordResetting || authLoading}
              variant="outline"
              className="w-full sm:w-auto min-w-[200px] h-11 text-base"
            >
              {isPasswordResetting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Enviando E-mail...
                </>
              ) : (
                "Enviar E-mail para Redefinir Senha"
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Card de Plano Atual */}
        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Gem className="mr-3 h-6 w-6 text-primary"/>Meu Plano</CardTitle>
             <CardDescription>Informações sobre sua assinatura atual.</CardDescription>
          </CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{getPlanDisplayName(user.activePlan)}</h3>
            {user.activePlan && user.planDetails && (
              <p className="text-sm text-muted-foreground">{getPlanDetailsDescription()}</p>
            )}
            {!user.activePlan && (
              <p className="text-sm text-muted-foreground">
                Você ainda não possui um plano ativo. Considere assinar um para desbloquear todos os recursos!
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="default" className="w-full sm:w-auto h-11 text-base">
              <Link href="/planos">
                {user.activePlan ? "Gerenciar Plano" : "Ver Planos Disponíveis"}
                <ExternalLink className="ml-2 h-4 w-4"/>
              </Link>
            </Button>
          </CardFooter>
        </Card>

      </div>
    </PageWrapper>
  );
}

