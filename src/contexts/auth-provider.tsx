
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, PlanId, PlanDetails } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User as FirebaseUser 
} from 'firebase/auth';
import { auth as firebaseAuthService, db } from '@/lib/firebase'; 
import { ref, set, get, update, remove } from "firebase/database"; 
import { addDays, formatISO, parseISO, differenceInCalendarDays } from 'date-fns';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';

// Helper para obter o nome do plano (usado em toasts)
const getPlanDisplayNameHelper = (planId?: PlanId | null): string => {
  if (!planId) return "Nenhum plano";
  switch (planId) {
    case 'plano_cargo': return "Plano Cargo";
    case 'plano_edital': return "Plano Edital";
    case 'plano_anual': return "Plano Anual";
    default: return "Plano Desconhecido";
  }
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => Promise<void>; 
  registerForCargo: (editalId: string, cargoId: string) => Promise<void>;
  unregisterFromCargo: (editalId: string, cargoId: string) => Promise<void>;
  toggleTopicStudyStatus: (compositeTopicId: string) => Promise<void>;
  addStudyLog: (compositeTopicId: string, duration: number) => Promise<void>;
  addQuestionLog: (logEntry: Omit<QuestionLogEntry, 'date'>) => Promise<void>;
  addRevisionSchedule: (compositeTopicId: string, daysToReview: number) => Promise<void>;
  toggleRevisionReviewedStatus: (compositeTopicId: string) => Promise<void>;
  subscribeToPlan: (planId: PlanId, specificDetails?: { selectedCargoCompositeId?: string; selectedEditalId?: string }) => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        try {
          const snapshot = await get(userRef);
          const dbData = snapshot.exists() ? snapshot.val() : {};

          const appUser: AppUser = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || dbData.name || 'Usuário',
            email: firebaseUser.email || dbData.email || '',
            avatarUrl: firebaseUser.photoURL || dbData.avatarUrl || undefined,
            registeredCargoIds: dbData.registeredCargoIds || [],
            studiedTopicIds: dbData.studiedTopicIds || [],
            studyLogs: dbData.studyLogs || [],
            questionLogs: dbData.questionLogs || [],
            revisionSchedules: dbData.revisionSchedules || [],
            activePlan: dbData.activePlan || null,
            planDetails: dbData.planDetails || null,
          };
          setUser(appUser);

          const dataToSaveToDb = {
            name: appUser.name,
            email: appUser.email,
            avatarUrl: appUser.avatarUrl || null,
            registeredCargoIds: appUser.registeredCargoIds,
            studiedTopicIds: appUser.studiedTopicIds,
            studyLogs: appUser.studyLogs,
            questionLogs: appUser.questionLogs,
            revisionSchedules: appUser.revisionSchedules,
            activePlan: appUser.activePlan,
            planDetails: appUser.planDetails,
          };

          if (!snapshot.exists()) {
             await set(ref(db, `users/${firebaseUser.uid}`), dataToSaveToDb);
          } else {
             const updates: Partial<AppUser & {avatarUrl: string | null}> = {};
             if (dbData.name !== appUser.name) updates.name = appUser.name;
             if (dbData.email !== appUser.email) updates.email = appUser.email;
             if ((dbData.avatarUrl || null) !== (appUser.avatarUrl || null)) updates.avatarUrl = appUser.avatarUrl || null;
             if (!dbData.hasOwnProperty('registeredCargoIds')) updates.registeredCargoIds = dataToSaveToDb.registeredCargoIds;
             if (!dbData.hasOwnProperty('studiedTopicIds')) updates.studiedTopicIds = dataToSaveToDb.studiedTopicIds;
             if (!dbData.hasOwnProperty('studyLogs')) updates.studyLogs = dataToSaveToDb.studyLogs;
             if (!dbData.hasOwnProperty('questionLogs')) updates.questionLogs = dataToSaveToDb.questionLogs;
             if (!dbData.hasOwnProperty('revisionSchedules')) updates.revisionSchedules = dataToSaveToDb.revisionSchedules;
             if (!dbData.hasOwnProperty('activePlan')) updates.activePlan = dataToSaveToDb.activePlan;
             if (!dbData.hasOwnProperty('planDetails')) updates.planDetails = dataToSaveToDb.planDetails;
             if (!dbData.hasOwnProperty('avatarUrl') && !updates.hasOwnProperty('avatarUrl')) updates.avatarUrl = dataToSaveToDb.avatarUrl;

             if (Object.keys(updates).length > 0) {
                await update(ref(db, `users/${firebaseUser.uid}`), updates);
             }
          }
        } catch (error) {
          console.error("Error fetching/updating user data from RTDB:", error);
          toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar seus dados salvos.", variant: "destructive" });
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || undefined,
            registeredCargoIds: [],
            studiedTopicIds: [],
            studyLogs: [],
            questionLogs: [],
            revisionSchedules: [],
            activePlan: null,
            planDetails: null,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    await signInWithEmailAndPassword(firebaseAuthService, email, pass);
  };

  const register = async (name: string, email: string, pass: string) => {
    setLoading(true);
    const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    
    await set(ref(db, `users/${userCredential.user.uid}`), {
      name: name,
      email: email,
      avatarUrl: null,
      registeredCargoIds: [],
      studiedTopicIds: [],
      studyLogs: [],
      questionLogs: [],
      revisionSchedules: [],
      activePlan: null, 
      planDetails: null,
    });
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(firebaseAuthService, email);
  };

  const logout = async () => {
    setLoading(true);
    await signOut(firebaseAuthService);
    router.push('/login'); 
  };
  
  const updateUser = async (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => {
    const firebaseCurrentUser = firebaseAuthService.currentUser;
    if (firebaseCurrentUser && user) {
      setLoading(true);
      try {
        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (updatedInfo.hasOwnProperty('name')) authUpdates.displayName = updatedInfo.name;
        if (updatedInfo.hasOwnProperty('avatarUrl')) authUpdates.photoURL = updatedInfo.avatarUrl || null;
        
        if (Object.keys(authUpdates).length > 0) await updateProfile(firebaseCurrentUser, authUpdates);
        
        const dbUpdates: Partial<Pick<AppUser, 'name'>> & { avatarUrl?: string | null } = {};
        if (updatedInfo.hasOwnProperty('name') && typeof updatedInfo.name === 'string') dbUpdates.name = updatedInfo.name;
        if (updatedInfo.hasOwnProperty('avatarUrl')) dbUpdates.avatarUrl = updatedInfo.avatarUrl || null; 

        if (Object.keys(dbUpdates).length > 0) await update(ref(db, `users/${user.id}`), dbUpdates);
        
        setUser(prevUser => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            name: updatedInfo.hasOwnProperty('name') ? updatedInfo.name || prevUser.name : prevUser.name,
            avatarUrl: updatedInfo.hasOwnProperty('avatarUrl') ? updatedInfo.avatarUrl || undefined : prevUser.avatarUrl,
          };
        });
        toast({ title: "Perfil Atualizado!", description: "Suas informações foram salvas.", variant: "default", className: "bg-accent text-accent-foreground" });
      } catch (error) {
        console.error("Error updating user profile:", error);
        toast({ title: "Erro ao Atualizar", description: "Não foi possível salvar suas informações.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    } else {
      throw new Error("Nenhum usuário logado para atualizar.");
    }
  };

  const registerForCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      const compositeId = `${editalId}_${cargoId}`;
      const updatedRegisteredCargoIds = Array.from(new Set([...(user.registeredCargoIds || []), compositeId]));
      try {
        await update(ref(db, `users/${user.id}`), { registeredCargoIds: updatedRegisteredCargoIds });
        setUser(prevUser => prevUser ? { ...prevUser, registeredCargoIds: updatedRegisteredCargoIds } : null);
      } catch (error) {
        console.error("Error registering for cargo:", error);
        toast({ title: "Erro na Inscrição", description: "Não foi possível salvar a inscrição no cargo.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const unregisterFromCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      const compositeId = `${editalId}_${cargoId}`;
      const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== compositeId);
      try {
        await update(ref(db, `users/${user.id}`), { registeredCargoIds: updatedRegisteredCargoIds });
        setUser(prevUser => prevUser ? { ...prevUser, registeredCargoIds: updatedRegisteredCargoIds } : null);
      } catch (error) {
        console.error("Error unregistering from cargo:", error);
        toast({ title: "Erro ao Cancelar", description: "Não foi possível remover a inscrição do cargo.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user) {
      setLoading(true);
      let updatedStudiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = updatedStudiedTopicIds.indexOf(compositeTopicId);
      if (topicIndex > -1) updatedStudiedTopicIds.splice(topicIndex, 1); 
      else updatedStudiedTopicIds.push(compositeTopicId); 
      try {
        await update(ref(db, `users/${user.id}`), { studiedTopicIds: updatedStudiedTopicIds });
        setUser(prevUser => prevUser ? { ...prevUser, studiedTopicIds: updatedStudiedTopicIds } : null);
      } catch (error) {
        console.error("Error toggling topic study status:", error);
        toast({ title: "Erro ao Atualizar Status", description: "Não foi possível salvar o status do tópico.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const addStudyLog = async (compositeTopicId: string, duration: number) => {
    if (user) {
      setLoading(true);
      const newLog: StudyLogEntry = { compositeTopicId, date: new Date().toISOString(), duration };
      const updatedStudyLogs = [...(user.studyLogs || []), newLog];
      try {
        await update(ref(db, `users/${user.id}`), { studyLogs: updatedStudyLogs });
        setUser(prevUser => prevUser ? { ...prevUser, studyLogs: updatedStudyLogs } : null);
      } catch (error) {
        console.error("Error adding study log:", error);
        toast({ title: "Erro ao Salvar Log", description: "Não foi possível salvar o registro de estudo.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const addQuestionLog = async (logEntryData: Omit<QuestionLogEntry, 'date'>) => {
    if (user) {
      setLoading(true);
      const newQuestionLog: QuestionLogEntry = { ...logEntryData, date: new Date().toISOString() };
      const updatedQuestionLogs = [...(user.questionLogs || []), newQuestionLog];
      try {
        await update(ref(db, `users/${user.id}`), { questionLogs: updatedQuestionLogs });
        setUser(prevUser => prevUser ? { ...prevUser, questionLogs: updatedQuestionLogs } : null);
      } catch (error) {
        console.error("Error adding question log:", error);
        toast({ title: "Erro ao Salvar Desempenho", description: "Não foi possível salvar o registro de questões.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const addRevisionSchedule = async (compositeTopicId: string, daysToReview: number) => {
    if (user) {
      setLoading(true);
      const scheduledDate = formatISO(addDays(new Date(), daysToReview));
      let updatedRevisionSchedules = [...(user.revisionSchedules || [])];
      const existingScheduleIndex = updatedRevisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      const newScheduleEntry: RevisionScheduleEntry = { compositeTopicId, scheduledDate, isReviewed: false, reviewedDate: null };
      if (existingScheduleIndex > -1) updatedRevisionSchedules[existingScheduleIndex] = newScheduleEntry;
      else updatedRevisionSchedules.push(newScheduleEntry);
      try {
        await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
        setUser(prevUser => prevUser ? { ...prevUser, revisionSchedules: updatedRevisionSchedules } : null);
      } catch (error) {
        console.error("Error adding revision schedule:", error);
        toast({ title: "Erro ao Agendar Revisão", description: "Não foi possível salvar o agendamento.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleRevisionReviewedStatus = async (compositeTopicId: string) => {
     if (user) {
      setLoading(true);
      let updatedRevisionSchedules = [...(user.revisionSchedules || [])];
      const scheduleIndex = updatedRevisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      if (scheduleIndex > -1) {
        const currentStatus = updatedRevisionSchedules[scheduleIndex].isReviewed;
        updatedRevisionSchedules[scheduleIndex] = { ...updatedRevisionSchedules[scheduleIndex], isReviewed: !currentStatus, reviewedDate: !currentStatus ? new Date().toISOString() : null };
        try {
          await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
          setUser(prevUser => prevUser ? { ...prevUser, revisionSchedules: updatedRevisionSchedules } : null);
        } catch (error) {
          console.error("Error toggling revision status:", error);
          toast({ title: "Erro ao Atualizar Revisão", description: "Não foi possível salvar o status da revisão.", variant: "destructive" });
        }
      }
      setLoading(false);
    }
  };

  const subscribeToPlan = async (planId: PlanId, specificDetails?: { selectedCargoCompositeId?: string; selectedEditalId?: string }) => {
    if (!user) {
      toast({ title: "Usuário não logado", description: "Você precisa estar logado para assinar um plano.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const now = new Date();
    const planName = getPlanDisplayNameHelper(planId);

    // Lógica para usuários que já possuem um plano ativo
    if (user.activePlan) {
      if (user.activePlan === planId) { // Tentando 'reassinar' o mesmo tipo de plano
        if (user.planDetails?.startDate) {
          const startDate = parseISO(user.planDetails.startDate);
          const daysSinceSubscription = differenceInCalendarDays(now, startDate);

          if (daysSinceSubscription < 7) {
            let detailsToUpdate: Partial<PlanDetails> = {};
            let changeMade = false;

            if (planId === 'plano_cargo' && specificDetails?.selectedCargoCompositeId && specificDetails.selectedCargoCompositeId !== user.planDetails.selectedCargoCompositeId) {
              detailsToUpdate.selectedCargoCompositeId = specificDetails.selectedCargoCompositeId;
              changeMade = true;
            } else if (planId === 'plano_edital' && specificDetails?.selectedEditalId && specificDetails.selectedEditalId !== user.planDetails.selectedEditalId) {
              detailsToUpdate.selectedEditalId = specificDetails.selectedEditalId;
              changeMade = true;
            }

            if (changeMade) {
              const updatedPlanDetails: PlanDetails = { ...user.planDetails, ...detailsToUpdate };
              try {
                await update(ref(db, `users/${user.id}`), { planDetails: updatedPlanDetails });
                setUser(prev => prev ? { ...prev, planDetails: updatedPlanDetails } : null);
                toast({ title: "Seleção Alterada!", description: `Sua seleção para o ${planName} foi atualizada.`, variant: "default", className: "bg-accent text-accent-foreground" });
                router.push('/perfil');
              } catch (error) {
                toast({ title: "Erro ao Alterar Seleção", description: "Não foi possível atualizar sua seleção.", variant: "destructive" });
              } finally {
                setLoading(false);
              }
              return;
            } else if (planId === 'plano_anual') {
                 toast({ title: "Plano Anual Já Ativo", description: "Você já possui o Plano Anual.", variant: "default" });
            } else {
                 toast({ title: "Seleção Mantida", description: `Você já está com esta seleção para o ${planName}.`, variant: "default" });
            }

          } else { // Fora do período de 7 dias para mudança
            toast({ title: "Prazo Expirado", description: `O prazo de 7 dias para alterar a seleção do ${planName} terminou.`, variant: "default" });
          }
        } else { // Caso estranho: plano ativo mas sem startDate
           toast({ title: "Erro no Plano", description: "Detalhes do seu plano atual estão incompletos. Contate o suporte.", variant: "destructive" });
        }
        setLoading(false);
        return;
      } else { // Tentando assinar um plano diferente do atual
        toast({ title: "Plano Existente", description: `Você já possui o ${getPlanDisplayNameHelper(user.activePlan)} ativo. Cancele-o antes de assinar um novo.`, variant: "default" });
        setLoading(false);
        return;
      }
    }

    // Lógica para nova assinatura (usuário não tem plano ativo)
    if (!specificDetails && (planId === 'plano_cargo' || planId === 'plano_edital')) {
        toast({ 
            title: "Seleção Necessária", 
            description: `Para assinar o ${planName}, por favor, escolha o ${planId === 'plano_cargo' ? 'cargo' : 'edital'} desejado na respectiva página de detalhes.`,
            variant: "default",
            duration: 9000,
        });
        setLoading(false);
        return;
    }

    const startDate = formatISO(now);
    const expiryDate = formatISO(addDays(now, 365)); // Todos os planos com 1 ano de validade

    const newPlanDetails: PlanDetails = {
      planId,
      startDate,
      expiryDate,
      ...(planId === 'plano_cargo' && specificDetails?.selectedCargoCompositeId && { selectedCargoCompositeId: specificDetails.selectedCargoCompositeId }),
      ...(planId === 'plano_edital' && specificDetails?.selectedEditalId && { selectedEditalId: specificDetails.selectedEditalId }),
    };

    try {
      await update(ref(db, `users/${user.id}`), { 
        activePlan: planId,
        planDetails: newPlanDetails 
      });
      setUser(prevUser => prevUser ? { ...prevUser, activePlan: planId, planDetails: newPlanDetails } : null);
      toast({ title: "Assinatura Realizada!", description: `Você assinou o ${planName} por 1 ano.`, variant: "default", className: "bg-accent text-accent-foreground" });
      router.push('/perfil'); 
    } catch (error) {
      console.error("Error subscribing to plan:", error);
      toast({ title: "Erro na Assinatura", description: "Não foi possível concluir a assinatura do plano.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!user || !user.activePlan) {
      toast({ title: "Nenhuma Assinatura Ativa", description: "Você não possui um plano ativo para cancelar.", variant: "default" });
      return;
    }
    setLoading(true);
    try {
      await update(ref(db, `users/${user.id}`), { activePlan: null, planDetails: null });
      setUser(prevUser => prevUser ? { ...prevUser, activePlan: null, planDetails: null } : null);
      toast({ title: "Assinatura Cancelada", description: "Seu plano foi cancelado.", variant: "default" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({ title: "Erro ao Cancelar", description: "Não foi possível cancelar sua assinatura.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, register, sendPasswordReset, logout, updateUser, 
      registerForCargo, unregisterFromCargo, toggleTopicStudyStatus, addStudyLog, 
      addQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus,
      subscribeToPlan, cancelSubscription
    }}>
      {children}
    </AuthContext.Provider>
  );
};
