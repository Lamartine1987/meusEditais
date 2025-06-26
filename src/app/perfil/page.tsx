
"use client";

import { useEffect, useState, useMemo } from 'react';
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
import { Loader2, Save, AlertTriangle, ShieldCheck, Gem, Edit3, KeyRound, ExternalLink, XCircle, Users, RotateCcw, Info, Zap, History } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { mockEditais } from '@/lib/mock-data'; 
import type { PlanId, Edital as EditalType, Cargo as CargoType } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const profileSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateUser, sendPasswordReset, cancelSubscription, loading: authLoading, changeCargoForPlanoCargo, isPlanoCargoWithinGracePeriod } = useAuth();
  const { toast } = useToast();
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  
  const [isChangeCargoModalOpen, setIsChangeCargoModalOpen] = useState(false);
  const [allEditaisData, setAllEditaisData] = useState<EditalType[]>([]);
  const [selectedEditalIdInCargoModal, setSelectedEditalIdInCargoModal] = useState<string | null>(null);
  const [cargosForSelectedEdital, setCargosForSelectedEdital] = useState<CargoType[]>([]);
  const [cargoSearchTerm, setCargoSearchTerm] = useState('');
  const [selectedCargoToChange, setSelectedCargoToChange] = useState<string | null>(null);
  const [isProcessingCargoChange, setIsProcessingCargoChange] = useState(false);


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

  useEffect(() => {
    setAllEditaisData(mockEditais); // Load mock editais for modal
  }, []);

  useEffect(() => {
    if (selectedEditalIdInCargoModal) {
      const edital = allEditaisData.find(e => e.id === selectedEditalIdInCargoModal);
      setCargosForSelectedEdital(edital?.cargos || []);
      setSelectedCargoToChange(null); 
      setCargoSearchTerm(''); 
    } else {
      setCargosForSelectedEdital([]);
    }
  }, [selectedEditalIdInCargoModal, allEditaisData]);

  const filteredCargosForModal = useMemo(() => {
    if (!cargoSearchTerm) return cargosForSelectedEdital;
    return cargosForSelectedEdital.filter(cargo => 
      cargo.name.toLowerCase().includes(cargoSearchTerm.toLowerCase())
    );
  }, [cargosForSelectedEdital, cargoSearchTerm]);

  const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum plano ativo";
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo";
      case 'plano_edital': return "Plano Edital";
      case 'plano_anual': return "Plano Anual";
      case 'plano_trial': return "Plano Teste Gratuito"; // Ajuste aqui
      default: return "Plano Desconhecido";
    }
  };

  const planInfo = useMemo(() => {
    if (!user?.activePlan || !user.planDetails) {
        return {
            name: getPlanDisplayName(user?.activePlan),
            accessDescription: null,
            gracePeriodInfo: null,
            expiryInfo: null,
        };
    }

    const { planId, selectedCargoCompositeId, selectedEditalId, expiryDate, startDate } = user.planDetails;
    let accessDescription: React.ReactNode = null;
    let gracePeriodInfo: string | null = null;
    let expiryInfo: string | null = null;

    if (expiryDate) {
        expiryInfo = `Expira em: ${new Date(expiryDate).toLocaleDateString('pt-BR')}.`;
    }

    if (planId === 'plano_cargo' && selectedCargoCompositeId) {
        const [editalId, cargoId] = selectedCargoCompositeId.split('_');
        const edital = allEditaisData.find(e => e.id === editalId);
        const cargo = edital?.cargos?.find(c => c.id === cargoId);
        accessDescription = cargo ? (
            <>
                Acesso ao cargo: <Link href={`/editais/${editalId}/cargos/${cargoId}`} className="font-semibold text-primary hover:underline">{cargo.name}</Link>
                <span className="text-muted-foreground/80"> ({edital?.title || 'Edital Desc.'})</span>
            </>
        ) : `Acesso a um cargo específico.`;

        if (startDate && isPlanoCargoWithinGracePeriod()) {
            const gracePeriodEnds = new Date(startDate);
            gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 7);
            gracePeriodInfo = `Troca de cargo, upgrade ou reembolso disponíveis até ${gracePeriodEnds.toLocaleDateString('pt-BR')}.`;
        }
    } else if (planId === 'plano_edital' && selectedEditalId) {
        const edital = allEditaisData.find(e => e.id === selectedEditalId);
        accessDescription = edital ? (
            <>
              Acesso a todos os cargos do edital: <Link href={`/editais/${selectedEditalId}`} className="font-semibold text-primary hover:underline">{edital.title}</Link>
            </>
        ) : `Acesso a um edital específico.`;
    } else if (planId === 'plano_anual') {
        accessDescription = "Acesso ilimitado a todos os editais e cargos.";
    } else if (planId === 'plano_trial') {
        accessDescription = "Acesso completo à plataforma para avaliação.";
    }

    return {
        name: getPlanDisplayName(planId),
        accessDescription,
        gracePeriodInfo,
        expiryInfo,
    };
}, [user, allEditaisData, isPlanoCargoWithinGracePeriod]);

  const editalIdForUpgrade = useMemo(() => {
    if (user?.planDetails?.selectedCargoCompositeId) {
        return user.planDetails.selectedCargoCompositeId.split('_')[0];
    }
    return null;
  }, [user?.planDetails?.selectedCargoCompositeId]);


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

  const handleConfirmChangeCargo = async () => {
    if (!selectedCargoToChange) {
        toast({ title: "Seleção Necessária", description: "Por favor, selecione um novo cargo.", variant: "destructive" });
        return;
    }
    setIsProcessingCargoChange(true);
    try {
        await changeCargoForPlanoCargo(selectedCargoToChange);
        // Toast de sucesso/erro já é tratado dentro de changeCargoForPlanoCargo
        setIsChangeCargoModalOpen(false);
        setSelectedEditalIdInCargoModal(null);
        setSelectedCargoToChange(null);
    } catch (error) {
        // Erro já tratado
    } finally {
        setIsProcessingCargoChange(false);
    }
  };

  const handleConfirmCancelAndRefund = async () => {
    setIsCancellingSubscription(true);
    try {
      await cancelSubscription(); // This will handle the toast internally
    } catch (error) {
      // Error already handled in cancelSubscription
    } finally {
      setIsCancellingSubscription(false);
    }
  };
  
  const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return '?';
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  };


  if (authLoading && !user) { 
    return (
       <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) { 
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
  
  const showPlanoCargoGracePeriodOptions = user.activePlan === 'plano_cargo' && isPlanoCargoWithinGracePeriod();

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais e de conta." />
        
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

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Gem className="mr-3 h-6 w-6 text-primary"/>Meu Plano</CardTitle>
             <CardDescription>Informações sobre sua assinatura atual.</CardDescription>
          </CardHeader>
          <Separator className="mb-1" />
           <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{planInfo.name}</h3>
                {planInfo.accessDescription && (
                  <p className="text-sm text-muted-foreground">{planInfo.accessDescription}</p>
                )}
                {planInfo.gracePeriodInfo && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{planInfo.gracePeriodInfo}</p>
                )}
                {planInfo.expiryInfo && (
                  <p className="text-sm text-muted-foreground">{planInfo.expiryInfo}</p>
                )}
              </div>
            {!user.activePlan && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Você ainda não possui um plano ativo. Considere assinar um para desbloquear todos os recursos!
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 items-center justify-start flex-wrap">
            <Button asChild variant="default" className="w-full sm:w-auto h-11 text-base">
              <Link href="/planos">
                {user.activePlan ? "Ver Opções de Planos" : "Ver Planos Disponíveis"}
                <ExternalLink className="ml-2 h-4 w-4"/>
              </Link>
            </Button>
            
            {showPlanoCargoGracePeriodOptions && (
              <>
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto h-11 text-base"
                  onClick={() => setIsChangeCargoModalOpen(true)}
                  disabled={authLoading}
                >
                  <RotateCcw className="mr-2 h-4 w-4"/>
                  Trocar Cargo
                </Button>
                
                {editalIdForUpgrade && (
                  <Button 
                    variant="premium"
                    className="w-full sm:w-auto h-11 text-base"
                    asChild
                    disabled={authLoading}
                  >
                    <Link href={`/checkout/plano_edital?selectedEditalId=${editalIdForUpgrade}`}>
                      <Zap className="mr-2 h-4 w-4"/>
                      Upgrade: Plano Edital
                    </Link>
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full sm:w-auto h-11 text-base"
                      disabled={isCancellingSubscription || authLoading}
                    >
                      <XCircle className="mr-2 h-5 w-5" />
                      Solicitar Reembolso
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Cancelamento e Reembolso</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você tem certeza que deseja cancelar seu Plano Cargo e solicitar um reembolso? 
                        Isso removerá seu acesso ao cargo atual e seu progresso será perdido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isCancellingSubscription}>Manter Plano</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleConfirmCancelAndRefund} 
                        disabled={isCancellingSubscription || authLoading}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isCancellingSubscription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, Cancelar e Reembolsar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            
            {user.activePlan && user.activePlan !== 'plano_cargo' && user.activePlan !== 'plano_trial' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full sm:w-auto h-11 text-base"
                      disabled={isCancellingSubscription || authLoading}
                    >
                      {isCancellingSubscription ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" />}
                      Cancelar Assinatura
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você tem certeza que deseja cancelar sua assinatura do {getPlanDisplayName(user.activePlan)}? 
                        Seu acesso será removido e o progresso associado perdido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isCancellingSubscription}>Manter Plano</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleConfirmCancelAndRefund} // Reusing the same handler
                        disabled={isCancellingSubscription || authLoading}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isCancellingSubscription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, Cancelar Assinatura
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            )}
             {user.activePlan === 'plano_trial' && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button 
                        variant="destructive" 
                        className="w-full sm:w-auto h-11 text-base"
                        disabled={isCancellingSubscription || authLoading}
                    >
                        {isCancellingSubscription ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" />}
                        Cancelar Teste Gratuito
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Cancelamento do Teste</AlertDialogTitle>
                        <AlertDialogDescription>
                        Você tem certeza que deseja cancelar seu período de Teste Gratuito? Seu acesso à plataforma será limitado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancellingSubscription}>Continuar Teste</AlertDialogCancel>
                        <AlertDialogAction 
                        onClick={handleConfirmCancelAndRefund} // Reusing the same handler for simplicity, it sets plan to null
                        disabled={isCancellingSubscription || authLoading}
                        className="bg-destructive hover:bg-destructive/90"
                        >
                        {isCancellingSubscription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, Cancelar Teste
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
          </CardFooter>
        </Card>

        <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader>
                <CardTitle className="text-xl flex items-center"><History className="mr-3 h-6 w-6 text-primary"/>Histórico de Assinaturas</CardTitle>
                <CardDescription>Seus planos anteriores.</CardDescription>
            </CardHeader>
            <Separator className="mb-1" />
            <CardContent className="pt-6 space-y-4">
                {user.planHistory && user.planHistory.length > 0 ? (
                    <ul className="space-y-3">
                        {user.planHistory.map((plan, index, historyArray) => {
                            const isLastInHistory = index === historyArray.length - 1;
                            const status = isLastInHistory && !user.activePlan ? "Cancelado" : "Upgrade";

                            return (
                                <li key={index} className="p-3 border rounded-md text-sm">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="font-semibold">{getPlanDisplayName(plan.planId)}</p>
                                      <Badge variant={status === 'Cancelado' ? 'destructive' : 'secondary'}>
                                        {status}
                                      </Badge>
                                    </div>
                                    {plan.startDate && (
                                        <p className="text-xs text-muted-foreground">
                                            Período: {new Date(plan.startDate).toLocaleDateString('pt-BR')}
                                            {plan.expiryDate ? ` - ${new Date(plan.expiryDate).toLocaleDateString('pt-BR')}` : ''}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">Nenhum plano anterior encontrado.</p>
                )}
            </CardContent>
        </Card>

      </div>

      {isChangeCargoModalOpen && (
        <AlertDialog open={isChangeCargoModalOpen} onOpenChange={(open) => { if (!open) setIsChangeCargoModalOpen(false); }}>
          <AlertDialogContent className="max-w-lg w-full">
            <AlertDialogHeader>
              <AlertDialogTitle>Trocar Cargo do Plano Cargo</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione o novo edital e cargo para o seu Plano Cargo. Seu progresso no cargo atual será perdido.
                Esta ação só é permitida dentro de 7 dias após a assinatura.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Separator />
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div>
                  <Label htmlFor="edital-select-change-cargo-modal" className="mb-1.5 block text-sm font-medium text-muted-foreground">1. Selecione o Novo Edital:</Label>
                  <Select 
                      value={selectedEditalIdInCargoModal || ""} 
                      onValueChange={(value) => setSelectedEditalIdInCargoModal(value)}
                  >
                      <SelectTrigger id="edital-select-change-cargo-modal">
                          <SelectValue placeholder="Escolha um edital..." />
                      </SelectTrigger>
                      <SelectContent>
                          {allEditaisData.map(edital => (
                              <SelectItem key={edital.id} value={edital.id}>{edital.title}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>

              {selectedEditalIdInCargoModal && (
                  <div className="space-y-2">
                      <Label htmlFor="cargo-search-change-input" className="block text-sm font-medium text-muted-foreground">2. Busque e Selecione o Novo Cargo:</Label>
                      <div className="relative">
                          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                              id="cargo-search-change-input"
                              type="search"
                              placeholder="Buscar cargo..."
                              value={cargoSearchTerm}
                              onChange={(e) => setCargoSearchTerm(e.target.value)}
                              className="pl-8"
                          />
                      </div>
                      {filteredCargosForModal.length > 0 ? (
                          <ScrollArea className="h-[200px] pr-3 border rounded-md">
                              <RadioGroup value={selectedCargoToChange || ''} onValueChange={setSelectedCargoToChange} className="space-y-1 p-2">
                                  {filteredCargosForModal.map(cargo => {
                                      const compositeCargoId = `${selectedEditalIdInCargoModal}_${cargo.id}`;
                                      const isCurrentSubscribedCargo = user?.planDetails?.selectedCargoCompositeId === compositeCargoId;
                                      return (
                                          <Label 
                                              htmlFor={`change-${compositeCargoId}`} 
                                              key={`change-${compositeCargoId}`} 
                                              className={`flex items-center space-x-3 p-2.5 border rounded-md hover:bg-muted/50 transition-colors 
                                                          ${isCurrentSubscribedCargo ? 'cursor-not-allowed opacity-60 bg-muted/30' : 'cursor-pointer'}
                                                          has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary`}
                                          >
                                              <RadioGroupItem 
                                                value={compositeCargoId} 
                                                id={`change-${compositeCargoId}`} 
                                                className="border-muted-foreground"
                                                disabled={isCurrentSubscribedCargo}
                                              />
                                              <span className="font-medium">{cargo.name}</span>
                                              {isCurrentSubscribedCargo && (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-4 w-4 text-primary ml-auto" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>Este é o seu cargo atual</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              )}
                                          </Label>
                                      );
                                  })}
                              </RadioGroup>
                          </ScrollArea>
                      ) : (
                            <p className="text-muted-foreground text-sm text-center py-4">
                              {cargoSearchTerm ? "Nenhum cargo encontrado com este termo." : "Nenhum cargo encontrado para este edital."}
                          </p>
                      )}
                  </div>
              )}
            </div>
            <Separator />
            <AlertDialogFooter className="pt-4">
              <AlertDialogCancel onClick={() => setIsChangeCargoModalOpen(false)} disabled={isProcessingCargoChange}>Cancelar Troca</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmChangeCargo} disabled={!selectedCargoToChange || isProcessingCargoChange || user?.planDetails?.selectedCargoCompositeId === selectedCargoToChange}>
                {isProcessingCargoChange && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Novo Cargo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </PageWrapper>
  );
}
