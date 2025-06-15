
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
import { Loader2, Save, AlertTriangle, ShieldCheck, Gem, Edit3, KeyRound, ExternalLink, XCircle, Replace, RotateCcw, Search as SearchIcon } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateUser, sendPasswordReset, cancelSubscription, changeCargoForPlanoCargo, isPlanoCargoWithinGracePeriod, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [isRequestingRefund, setIsRequestingRefund] = useState(false);
  
  const [isChangeCargoModalOpen, setIsChangeCargoModalOpen] = useState(false);
  const [allEditaisData, setAllEditaisData] = useState<EditalType[]>([]);
  const [selectedEditalIdForChange, setSelectedEditalIdForChange] = useState<string | null>(null);
  const [cargosForSelectedEditalChange, setCargosForSelectedEditalChange] = useState<CargoType[]>([]);
  const [cargoSearchTermChange, setCargoSearchTermChange] = useState('');
  const [selectedNewCargoCompositeId, setSelectedNewCargoCompositeId] = useState<string | null>(null);
  const [isChangingCargo, setIsChangingCargo] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting: isSubmittingName }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    }
  });

  useEffect(() => {
    setAllEditaisData(mockEditais);
  }, []);
  
  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
      });
    }
  }, [user, reset]);

  const allSelectableEditais = useMemo(() => allEditaisData.sort((a,b) => a.title.localeCompare(b.title)), [allEditaisData]);

  useEffect(() => {
    if (selectedEditalIdForChange) {
      const edital = allSelectableEditais.find(e => e.id === selectedEditalIdForChange);
      setCargosForSelectedEditalChange(edital?.cargos || []);
      setSelectedNewCargoCompositeId(null); 
      setCargoSearchTermChange(''); 
    } else {
      setCargosForSelectedEditalChange([]);
    }
  }, [selectedEditalIdForChange, allSelectableEditais]);

  const filteredCargosForChangeModal = useMemo(() => {
    if (!cargoSearchTermChange) return cargosForSelectedEditalChange;
    return cargosForSelectedEditalChange.filter(cargo => 
      cargo.name.toLowerCase().includes(cargoSearchTermChange.toLowerCase())
    );
  }, [cargosForSelectedEditalChange, cargoSearchTermChange]);


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

  const handleGeneralCancelSubscription = async () => {
    // This function is now only for 'plano_edital' and 'plano_anual'
    setIsCancellingSubscription(true);
    try {
      await cancelSubscription();
      // Toast de sucesso/erro já é tratado dentro de cancelSubscription no AuthProvider
    } catch (error) {
        // Erro já tratado no AuthProvider
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const handleRefundAndCancelPlanoCargo = async () => {
    // This is the specific cancellation for 'plano_cargo' within 7 days
    setIsRequestingRefund(true);
    try {
      await cancelSubscription(); 
      toast({ title: "Cancelamento Solicitado", description: "Sua assinatura do Plano Cargo e todo o progresso foram removidos. O reembolso (simulado) seria processado.", duration: 7000, variant: "default", className: "bg-accent text-accent-foreground"});
    } catch (error) {
       // Erro já tratado no AuthProvider
    } finally {
        setIsRequestingRefund(false);
    }
  };

  const handleOpenChangeCargoModal = () => {
    setSelectedEditalIdForChange(null);
    setCargosForSelectedEditalChange([]);
    setSelectedNewCargoCompositeId(null);
    setCargoSearchTermChange('');
    setIsChangeCargoModalOpen(true);
  };

  const handleChangeCargo = async () => {
    if (!selectedNewCargoCompositeId) {
        toast({ title: "Seleção Necessária", description: "Por favor, selecione um novo cargo.", variant: "destructive" });
        return;
    }
    setIsChangingCargo(true);
    try {
        await changeCargoForPlanoCargo(selectedNewCargoCompositeId);
        setIsChangeCargoModalOpen(false);
    } catch (error) {
        // Error toast is handled in changeCargoForPlanoCargo
    } finally {
        setIsChangingCargo(false);
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

    const { planId, selectedCargoCompositeId, selectedEditalId, expiryDate, startDate } = user.planDetails;
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

    if (startDate) {
        details += ` Assinado em: ${new Date(startDate).toLocaleDateString('pt-BR')}.`;
    }
    if (expiryDate) {
      details += ` Expira em: ${new Date(expiryDate).toLocaleDateString('pt-BR')}.`;
    }
    return details.trim() || null;
  };
  
  const planoCargoInGracePeriod = user?.activePlan === 'plano_cargo' && isPlanoCargoWithinGracePeriod();

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
              <Button type="submit" disabled={isSubmittingName || authLoading} className="w-full sm:w-auto min-w-[150px] h-11 text-base">
                {(isSubmittingName || authLoading) ? (
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
            {user.activePlan === 'plano_cargo' && planoCargoInGracePeriod && (
                <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                    <AlertTriangle className="inline h-4 w-4 mr-1"/> Você está no período de 7 dias para trocar o cargo do seu Plano Cargo ou solicitar cancelamento com reembolso.
                </p>
            )}
             {user.activePlan === 'plano_cargo' && !planoCargoInGracePeriod && (
                <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md border border-orange-200">
                    <AlertTriangle className="inline h-4 w-4 mr-1"/> O período de 7 dias para troca de cargo ou cancelamento com reembolso do seu Plano Cargo expirou. Nenhuma alteração ou cancelamento é permitido para este plano agora.
                </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 items-center justify-start flex-wrap">
            {!user.activePlan && (
                <Button asChild variant="default" className="w-full sm:w-auto h-11 text-base">
                <Link href="/planos">
                    Ver Planos Disponíveis
                    <ExternalLink className="ml-2 h-4 w-4"/>
                </Link>
                </Button>
            )}

            {user.activePlan === 'plano_cargo' && planoCargoInGracePeriod && (
                <>
                    <Button 
                        onClick={handleOpenChangeCargoModal}
                        variant="outline" 
                        className="w-full sm:w-auto h-11 text-base"
                        disabled={authLoading || isChangingCargo}
                    >
                        <Replace className="mr-2 h-5 w-5" />
                        Trocar Cargo (Plano Cargo)
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                            variant="destructive" 
                            className="w-full sm:w-auto h-11 text-base"
                            disabled={isRequestingRefund || authLoading}
                            >
                            {isRequestingRefund ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RotateCcw className="mr-2 h-5 w-5" />}
                            Solicitar Cancelamento e Reembolso
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Cancelamento com Reembolso</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você tem certeza que deseja cancelar sua assinatura do {getPlanDisplayName(user.activePlan)} e solicitar um reembolso (simulado)? 
                                Seu acesso ao plano e todo o progresso associado serão removidos imediatamente.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel disabled={isRequestingRefund}>Manter Plano</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handleRefundAndCancelPlanoCargo} 
                                disabled={isRequestingRefund || authLoading}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {isRequestingRefund && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sim, Cancelar e Solicitar Reembolso
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
            
            {/* General "Cancelar Assinatura" button - only for plano_edital or plano_anual */}
            {user.activePlan && (user.activePlan === 'plano_edital' || user.activePlan === 'plano_anual') && (
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
                      <AlertDialogTitle>Confirmar Cancelamento de Assinatura</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você tem certeza que deseja cancelar sua assinatura do {getPlanDisplayName(user.activePlan)}? 
                        Seu acesso aos benefícios do plano e todo o progresso associado serão removidos imediatamente (simulado).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isCancellingSubscription}>Manter Plano</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleGeneralCancelSubscription} 
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
             {user.activePlan && (
                <Button asChild variant="outline" className="w-full sm:w-auto h-11 text-base">
                    <Link href="/planos">
                        Ver Outros Planos
                        <ExternalLink className="ml-2 h-4 w-4"/>
                    </Link>
                </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Modal para Trocar Cargo (Plano Cargo) */}
      <Dialog open={isChangeCargoModalOpen} onOpenChange={setIsChangeCargoModalOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Trocar Cargo do Plano Cargo</DialogTitle>
            <DialogDescription>
              Selecione o novo edital e cargo para o seu Plano Cargo. Esta ação é permitida apenas uma vez nos primeiros 7 dias da sua assinatura. O progresso do cargo atual será removido.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="edital-select-change-modal">1. Selecione o Edital:</Label>
                <Select 
                    value={selectedEditalIdForChange || ""} 
                    onValueChange={(value) => setSelectedEditalIdForChange(value)}
                >
                    <SelectTrigger id="edital-select-change-modal">
                        <SelectValue placeholder="Escolha um edital..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allSelectableEditais.map(edital => (
                            <SelectItem key={edital.id} value={edital.id}>{edital.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedEditalIdForChange && (
                <div className="space-y-2">
                    <Label htmlFor="cargo-search-change-input">2. Busque e Selecione o Novo Cargo:</Label>
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="cargo-search-change-input"
                            type="search"
                            placeholder="Buscar cargo..."
                            value={cargoSearchTermChange}
                            onChange={(e) => setCargoSearchTermChange(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    {filteredCargosForChangeModal.length > 0 ? (
                        <ScrollArea className="h-[200px] pr-3 border rounded-md">
                            <RadioGroup value={selectedNewCargoCompositeId || ''} onValueChange={setSelectedNewCargoCompositeId} className="space-y-1 p-2">
                                {filteredCargosForChangeModal.map(cargo => {
                                    const compositeCargoId = `${selectedEditalIdForChange}_${cargo.id}`;
                                    const isCurrentPlanCargo = user?.planDetails?.selectedCargoCompositeId === compositeCargoId;
                                    return (
                                        <Label 
                                            htmlFor={`change-${compositeCargoId}`} 
                                            key={compositeCargoId} 
                                            className={`flex items-center space-x-3 p-2.5 border rounded-md hover:bg-muted/50 transition-colors ${isCurrentPlanCargo ? "cursor-not-allowed opacity-50 bg-muted/30" : "cursor-pointer has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary"}`}
                                        >
                                            <RadioGroupItem value={compositeCargoId} id={`change-${compositeCargoId}`} className="border-muted-foreground" disabled={isCurrentPlanCargo}/>
                                            <span className="font-medium">{cargo.name}</span>
                                        </Label>
                                    );
                                })}
                            </RadioGroup>
                        </ScrollArea>
                    ) : (
                         <p className="text-muted-foreground text-sm text-center py-4">
                            {cargoSearchTermChange ? "Nenhum cargo encontrado com este termo." : (cargosForSelectedEditalChange.length === 0 ? "Nenhum cargo disponível para este edital." : "Nenhum cargo encontrado.")}
                        </p>
                    )}
                </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isChangingCargo}>Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleChangeCargo} disabled={!selectedNewCargoCompositeId || isChangingCargo || authLoading}>
              {isChangingCargo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Troca de Cargo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageWrapper>
  );
}

    