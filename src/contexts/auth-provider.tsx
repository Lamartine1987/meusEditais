
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
import { auth as firebaseAuthService, db } from '@/lib/firebase'; // Import db from firebase
import { ref, set, get, update, remove } from "firebase/database"; // Firebase Realtime Database functions
import { addDays, formatISO } from 'date-fns';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';


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
             const updates: Partial<AppUser & {avatarUrl: string | null}> = {}; // Ensure avatarUrl can be explicitly null
             if (dbData.name !== appUser.name) {
                updates.name = appUser.name;
             }
             if (dbData.email !== appUser.email) {
                updates.email = appUser.email;
             }
             if ((dbData.avatarUrl || null) !== (appUser.avatarUrl || null)) {
                 updates.avatarUrl = appUser.avatarUrl || null;
             }
             
             if (!dbData.hasOwnProperty('registeredCargoIds')) updates.registeredCargoIds = dataToSaveToDb.registeredCargoIds;
             if (!dbData.hasOwnProperty('studiedTopicIds')) updates.studiedTopicIds = dataToSaveToDb.studiedTopicIds;
             if (!dbData.hasOwnProperty('studyLogs')) updates.studyLogs = dataToSaveToDb.studyLogs;
             if (!dbData.hasOwnProperty('questionLogs')) updates.questionLogs = dataToSaveToDb.questionLogs;
             if (!dbData.hasOwnProperty('revisionSchedules')) updates.revisionSchedules = dataToSaveToDb.revisionSchedules;
             if (!dbData.hasOwnProperty('activePlan')) updates.activePlan = dataToSaveToDb.activePlan;
             if (!dbData.hasOwnProperty('planDetails')) updates.planDetails = dataToSaveToDb.planDetails;
             
             if (!dbData.hasOwnProperty('avatarUrl') && !updates.hasOwnProperty('avatarUrl')) {
                updates.avatarUrl = dataToSaveToDb.avatarUrl;
             }

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
        if (updatedInfo.hasOwnProperty('avatarUrl')) {
            authUpdates.photoURL = updatedInfo.avatarUrl || null;
        }
        
        if (Object.keys(authUpdates).length > 0) {
          await updateProfile(firebaseCurrentUser, authUpdates);
        }
        
        const dbUpdates: Partial<Pick<AppUser, 'name'>> & { avatarUrl?: string | null } = {};
        if (updatedInfo.hasOwnProperty('name') && typeof updatedInfo.name === 'string') {
          dbUpdates.name = updatedInfo.name;
        }
        if (updatedInfo.hasOwnProperty('avatarUrl')) {
          dbUpdates.avatarUrl = updatedInfo.avatarUrl || null; 
        }

        if (Object.keys(dbUpdates).length > 0) {
          await update(ref(db, `users/${user.id}`), dbUpdates);
        }
        
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
      if (topicIndex > -1) {
        updatedStudiedTopicIds.splice(topicIndex, 1); 
      } else {
        updatedStudiedTopicIds.push(compositeTopicId); 
      }
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
      const newLog: StudyLogEntry = {
        compositeTopicId,
        date: new Date().toISOString(),
        duration,
      };
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
      const newQuestionLog: QuestionLogEntry = {
        ...logEntryData,
        date: new Date().toISOString(),
      };
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
      const newScheduleEntry: RevisionScheduleEntry = {
        compositeTopicId,
        scheduledDate,
        isReviewed: false,
        reviewedDate: null,
      };

      if (existingScheduleIndex > -1) {
        updatedRevisionSchedules[existingScheduleIndex] = newScheduleEntry;
      } else {
        updatedRevisionSchedules.push(newScheduleEntry);
      }
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
        updatedRevisionSchedules[scheduleIndex] = {
          ...updatedRevisionSchedules[scheduleIndex],
          isReviewed: !currentStatus,
          reviewedDate: !currentStatus ? new Date().toISOString() : null,
        };
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
      // EM PRODUÇÃO: Idealmente, você chamaria router.push('/login') aqui,
      // mas como estamos em um contexto que pode não ter o router pronto,
      // é melhor a página que chama subscribeToPlan lidar com o redirecionamento se necessário.
      return;
    }
    setLoading(true);

    // --- INÍCIO DA SEÇÃO PARA COMENTAR EM PRODUÇÃO ---
    // EM PRODUÇÃO:
    // 1. ANTES DE ATUALIZAR O BANCO DE DADOS LOCALMENTE:
    //    a. Chamar um endpoint no seu backend seguro (ex: Firebase Function).
    //    b. Seu backend se comunicaria com o gateway de pagamento (Stripe, PagSeguro, etc.)
    //       para criar uma sessão de checkout para o plano selecionado.
    //    c. O backend retornaria um ID de sessão de checkout ou uma URL para o frontend.
    //    d. O frontend redirecionaria o usuário para a página de pagamento do gateway.
    //
    // 2. APÓS O PAGAMENTO SER COMPLETADO NO GATEWAY:
    //    a. O gateway de pagamento enviaria um webhook para um endpoint no seu backend.
    //    b. Seu backend validaria o webhook e, SE O PAGAMENTO FOI BEM-SUCEDIDO:
    //       - Atualizaria o status da assinatura do usuário no Firebase Realtime Database
    //         (similar ao que está sendo feito abaixo, mas de forma segura no backend).
    //       - Poderia registrar a transação, enviar e-mail de confirmação, etc.
    //
    // 3. O frontend (via onAuthStateChanged ou recarregando dados do usuário)
    //    refletiria o novo status do plano.
    // --- FIM DA SEÇÃO PARA COMENTAR EM PRODUÇÃO ---

    // A lógica abaixo é uma SIMULAÇÃO de assinatura bem-sucedida,
    // atualizando o banco de dados diretamente do frontend.
    // NÃO FAÇA ISSO EM PRODUÇÃO PARA TRANSAÇÕES REAIS SEM UM BACKEND.

    const now = new Date();
    const startDate = formatISO(now);
    let expiryDate = '';
    
    switch (planId) {
      case 'plano_cargo':
      case 'plano_edital':
        expiryDate = formatISO(addDays(now, 365)); // MUDANÇA: Validade de 1 ano
        break;
      case 'plano_anual':
        expiryDate = formatISO(addDays(now, 365)); // Mantém validade de 1 ano
        break;
      default:
        toast({ title: "Plano Inválido", description: "O plano selecionado não é reconhecido.", variant: "destructive" });
        setLoading(false);
        return;
    }

    const newPlanDetails: PlanDetails = {
      planId,
      startDate,
      expiryDate,
      ...specificDetails,
    };

    try {
      await update(ref(db, `users/${user.id}`), { 
        activePlan: planId,
        planDetails: newPlanDetails 
      });
      setUser(prevUser => prevUser ? { ...prevUser, activePlan: planId, planDetails: newPlanDetails } : null);
      toast({ title: "Assinatura Realizada!", description: `Você assinou o ${planId}.`, variant: "default", className: "bg-accent text-accent-foreground" });
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

    // --- INÍCIO DA SEÇÃO PARA COMENTAR EM PRODUÇÃO ---
    // EM PRODUÇÃO:
    // O cancelamento de uma assinatura geralmente é gerenciado através do gateway de pagamento.
    // 1. O usuário solicitaria o cancelamento no seu app.
    // 2. Seu frontend chamaria um endpoint no backend.
    // 3. Seu backend se comunicaria com a API do gateway de pagamento para:
    //    a. Cancelar a assinatura (geralmente significa que não será renovada no próximo ciclo).
    //    b. Ou, dependendo da política, marcar para não renovar.
    // 4. O gateway de pagamento enviaria um webhook para o seu backend confirmando
    //    a alteração do status da assinatura (ex: 'canceled', 'active_until_end_of_period').
    // 5. Seu backend atualizaria o `activePlan` e `planDetails` no Firebase RTDB
    //    para refletir o novo status e a data de expiração real.
    // --- FIM DA SEÇÃO PARA COMENTAR EM PRODUÇÃO ---
    
    // A lógica abaixo é uma SIMULAÇÃO de cancelamento imediato,
    // atualizando o banco de dados diretamente do frontend.

    try {
      await update(ref(db, `users/${user.id}`), { 
        activePlan: null,
        planDetails: null 
      });
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
      user, 
      loading, 
      login, 
      register,
      sendPasswordReset,
      logout, 
      updateUser, 
      registerForCargo, 
      unregisterFromCargo, 
      toggleTopicStudyStatus, 
      addStudyLog, 
      addQuestionLog,
      addRevisionSchedule,
      toggleRevisionReviewedStatus,
      subscribeToPlan,
      cancelSubscription
    }}>
      {children}
    </AuthContext.Provider>
  );
};
