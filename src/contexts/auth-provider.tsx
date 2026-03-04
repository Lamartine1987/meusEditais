
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, PlanId, PlanDetails, NoteEntry } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User as FirebaseUser 
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; 
import { ref, update, onValue, get, type Unsubscribe, remove, push, set } from "firebase/database";
import { addDays, formatISO, isPast, parseISO as datefnsParseISO } from 'date-fns';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';

import { registerUsedTrialByCpf } from '@/actions/auth-actions';

import { isWithinGracePeriod } from '@/lib/utils';

const TRIAL_DURATION_DAYS = 7;

const planRank: Record<PlanId, number> = {
  plano_trial: 0,
  plano_cargo: 1,
  plano_edital: 2,
  plano_mensal: 3,
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, cpf: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => Promise<void>; 
  registerForCargo: (editalId: string, cargoId: string) => Promise<void>;
  unregisterFromCargo: (editalId: string, cargoId: string) => Promise<void>;
  toggleTopicStudyStatus: (compositeTopicId: string) => Promise<void>;
  addStudyLog: (compositeTopicId: string, logData: { duration?: number; pdfName?: string; startPage?: number; endPage?: number; }) => Promise<void>;
  deleteStudyLog: (logId: string) => Promise<void>;
  addQuestionLog: (logEntry: Omit<QuestionLogEntry, 'id' | 'date'>) => Promise<void>;
  deleteQuestionLog: (logId: string) => Promise<void>;
  addRevisionSchedule: (compositeTopicId: string, daysToReview: number) => Promise<void>;
  toggleRevisionReviewedStatus: (revisionId: string, nextValue?: boolean) => Promise<void>;
  addNote: (compositeTopicId: string, text: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  startFreeTrial: () => Promise<void>;
  changeItemForPlan: (paymentIntentId: string, newItemId: string) => Promise<void>;
  setRankingParticipation: (participate: boolean) => Promise<void>;
  requestPlanRefund: (paymentIntentId: string) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const cleanProgressForCargo = (user: AppUser, cargoCompositeIdPrefix: string): Partial<AppUser> => {
  const updates: Partial<AppUser> = {};
  updates.studiedTopicIds = (user.studiedTopicIds || []).filter(id => !id.startsWith(cargoCompositeIdPrefix));
  updates.studyLogs = (user.studyLogs || []).filter(log => !log.compositeTopicId.startsWith(cargoCompositeIdPrefix));
  updates.questionLogs = (user.questionLogs || []).filter(log => !log.compositeTopicId.startsWith(cargoCompositeIdPrefix));
  updates.revisionSchedules = (user.revisionSchedules || []).filter(rs => !rs.compositeTopicId.startsWith(cargoCompositeIdPrefix));
  return updates;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const dbUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const router = useRouter();


  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      setLoading(true);

      if (dbUnsubscribeRef.current) {
        dbUnsubscribeRef.current();
        dbUnsubscribeRef.current = null;
      }

      if (firebaseUser) {
        if (!db) {
            setUser(null);
            setLoading(false);
            return;
        }

        const userRef = ref(db, `users/${firebaseUser.uid}`);
        
        dbUnsubscribeRef.current = onValue(userRef, async (snapshot) => {
          try {
            if (!snapshot.exists()) {
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }

            let dbData = snapshot.val();
            
            const adminRef = ref(db, `admins/${firebaseUser.uid}`);
            const adminSnapshot = await get(adminRef);
            const isAdmin = adminSnapshot.exists();

            let appUser: AppUser = {
              id: firebaseUser.uid,
              name: dbData.name || firebaseUser.displayName || 'Usuário',
              email: dbData.email || firebaseUser.email || '',
              cpf: dbData.cpf,
              avatarUrl: dbData.avatarUrl || firebaseUser.photoURL || undefined,
              registeredCargoIds: dbData.registeredCargoIds || [],
              studiedTopicIds: dbData.studiedTopicIds || [],
              studyLogs: Object.entries(dbData.studyLogs || {}).map(([id, data]: any) => ({ id, ...data })),
              questionLogs: Object.entries(dbData.questionLogs || {}).map(([id, data]: any) => ({ id, ...data })),
              revisionSchedules: Object.entries(dbData.revisionSchedules || {}).map(([id, data]: any) => ({ id, ...data })),
              notes: Object.entries(dbData.notes || {}).map(([id, data]: any) => ({ id, ...data })),
              activePlan: dbData.activePlan || null,
              activePlans: dbData.activePlans || [],
              stripeCustomerId: dbData.stripeCustomerId || null,
              hasHadFreeTrial: dbData.hasHadFreeTrial || false,
              planHistory: dbData.planHistory || [],
              paymentHistory: dbData.paymentHistory || [],
              isRankingParticipant: dbData.isRankingParticipant ?? null,
              isAdmin: isAdmin,
              termsAcceptedOn: dbData.termsAcceptedOn,
            };

            let trialExpiredToastShown = false;
            const trialPlan = appUser.activePlans?.find(p => p.planId === 'plano_trial');
            if (trialPlan && trialPlan.expiryDate && isPast(datefnsParseISO(trialPlan.expiryDate))) {
                const updatedActivePlans = appUser.activePlans?.filter(p => p.planId !== 'plano_trial') || [];
                
                let highestPlan: PlanDetails | null = null;
                const activePlansOnly = updatedActivePlans.filter(p => p.status === 'active');
                if (activePlansOnly.length > 0) {
                    highestPlan = activePlansOnly.reduce((max, plan) => {
                      return planRank[plan.planId] > planRank[max.planId] ? plan : max;
                    });
                }
                const newActivePlanId = highestPlan ? highestPlan.planId : null;

                const dbUpdatesForExpiredTrial = { 
                  activePlans: updatedActivePlans,
                  activePlan: newActivePlanId,
                };

                await update(userRef, dbUpdatesForExpiredTrial);
                
                appUser = { ...appUser, ...dbUpdatesForExpiredTrial };
                trialExpiredToastShown = true; 
            }
            setUser(appUser);

            if (trialExpiredToastShown) {
               toast({
                  title: "Teste Gratuito Expirado",
                  description: `Seu período de teste gratuito de ${TRIAL_DURATION_DAYS} dias terminou.`,
                  variant: "default",
                  duration: 9000,
                });
            }

          } catch (error: any) {
            console.error("[AuthProvider] Erro ao ler dados do usuário do DB:", error);
            setUser(null);
          } finally {
            setLoading(false);
          }
        });

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (dbUnsubscribeRef.current) {
        dbUnsubscribeRef.current();
      }
    };
  }, [toast]);

  const login = async (email: string, pass: string) => {
    if (!auth) throw new Error("Serviço de autenticação indisponível.");
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (name: string, email: string, cpf: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };
  
  const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error("Serviço de autenticação indisponível.");
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    if (!auth) throw new Error("Serviço de autenticação indisponível.");
    await signOut(auth);
    router.push('/login'); 
  };
  
  const updateUser = async (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => {
    if (!auth || !db || !user) throw new Error("Dados insuficientes para atualização.");
    setLoading(true);
    try {
      const authUpdates: { displayName?: string; photoURL?: string | null } = {};
      if (updatedInfo.hasOwnProperty('name') && updatedInfo.name !== user.name) authUpdates.displayName = updatedInfo.name;
      if (updatedInfo.hasOwnProperty('avatarUrl') && updatedInfo.avatarUrl !== user.avatarUrl) authUpdates.photoURL = updatedInfo.avatarUrl || null;
      
      if (Object.keys(authUpdates).length > 0) await updateProfile(auth.currentUser!, authUpdates);
      
      const dbUpdates: any = {};
      if (authUpdates.displayName) dbUpdates.name = authUpdates.displayName;
      if (authUpdates.photoURL !== undefined) dbUpdates.avatarUrl = authUpdates.photoURL;

      if (Object.keys(dbUpdates).length > 0) {
          await update(ref(db, `users/${user.id}`), dbUpdates);
      }
    } catch (error) {
      toast({ title: "Erro ao Atualizar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const registerForCargo = async (editalId: string, cargoId: string) => {
    if (!user || !db) throw new Error("Usuário ou Banco de Dados indisponível.");

    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    let canRegister = false;
    let reason = "";

    // Verifica se o usuário tem algum plano ATIVO que cubra o cargo
    const activePlans = user.activePlans?.filter(p => p.status === 'active' || p.planId === 'plano_trial') || [];

    if (activePlans.some(p => p.planId === 'plano_mensal' || p.planId === 'plano_trial')) {
      canRegister = true;
    } else if (activePlans.some(p => p.planId === 'plano_edital' && p.selectedEditalId === editalId)) {
      canRegister = true;
    } else if (activePlans.some(p => p.planId === 'plano_cargo' && p.selectedCargoCompositeId === currentCargoCompositeId)) {
      canRegister = true;
    } else {
      reason = "Você não possui um plano ativo que cubra este cargo. Verifique sua assinatura.";
    }

    if (!canRegister) {
      throw new Error(reason);
    }

    const updatedRegisteredCargoIds = Array.from(new Set([...(user.registeredCargoIds || []), currentCargoCompositeId]));
    
    try {
      await update(ref(db, `users/${user.id}`), { registeredCargoIds: updatedRegisteredCargoIds });
    } catch (error) {
      throw error; 
    }
  };

  const unregisterFromCargo = async (editalId: string, cargoId: string) => {
    if (!user || !db) return;
    const cargoCompositeId = `${editalId}_${cargoId}`;

    const isCargoTiedToPlan = user.activePlans?.some(p => p.planId === 'plano_cargo' && p.selectedCargoCompositeId === cargoCompositeId && p.status === 'active');

    if (isCargoTiedToPlan) {
        toast({
            title: "Ação Não Permitida",
            description: "Este cargo está vinculado a um Plano Cargo ativo. Você deve gerenciar isso através do seu perfil.",
            variant: "destructive",
        });
        return;
    }

    const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== cargoCompositeId);
    const progressUpdates = cleanProgressForCargo(user, `${cargoCompositeId}_`); 

    try {
      await update(ref(db, `users/${user.id}`), { 
        registeredCargoIds: updatedRegisteredCargoIds,
        ...progressUpdates
      });
    } catch (error) {
      toast({ title: "Erro ao Cancelar", variant: "destructive" });
    } 
  };

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user && db) {
      let updatedStudiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = updatedStudiedTopicIds.indexOf(compositeTopicId);
      if (topicIndex > -1) updatedStudiedTopicIds.splice(topicIndex, 1); 
      else updatedStudiedTopicIds.push(compositeTopicId); 
      try {
        await update(ref(db, `users/${user.id}`), { studiedTopicIds: updatedStudiedTopicIds });
      } catch (error) {
        toast({ title: "Erro ao Atualizar", variant: "destructive" });
      } 
    }
  };

  const addStudyLog = async (compositeTopicId: string, logData: { duration?: number, pdfName?: string, startPage?: number, endPage?: number }) => {
    if (user && db) {
        const newLogRef = push(ref(db, `users/${user.id}/studyLogs`));
        const newLogId = newLogRef.key!;
        const newLog: StudyLogEntry = {
            id: newLogId,
            compositeTopicId,
            date: new Date().toISOString(),
            duration: logData.duration || 0,
            ...(logData.pdfName && { pdfName: logData.pdfName }),
            ...(logData.startPage !== undefined && { startPage: logData.startPage }),
            ...(logData.endPage !== undefined && { endPage: logData.endPage }),
        };
        try {
            await set(newLogRef, newLog);
        } catch (error) {
            toast({ title: "Erro ao Salvar Log", variant: "destructive" });
        }
    }
  };

  const deleteStudyLog = async (logId: string) => {
    if (user && db) {
        try {
            await remove(ref(db, `users/${user.id}/studyLogs/${logId}`));
        } catch (error) {
            toast({ title: "Erro ao Excluir", variant: "destructive" });
        }
    }
  };

  const addQuestionLog = async (logEntryData: Omit<QuestionLogEntry, 'id' | 'date'>) => {
    if (user && db) {
      const newQuestionLogRef = push(ref(db, `users/${user.id}/questionLogs`));
      const newQuestionLog: Omit<QuestionLogEntry, 'id'> = { 
        ...logEntryData, 
        date: new Date().toISOString() 
      };
      try {
        await set(newQuestionLogRef, newQuestionLog);
      } catch (error) {
        throw error;
      } 
    }
  };

  const deleteQuestionLog = async (logId: string) => {
    if (user && db) {
      try {
        await remove(ref(db, `users/${user.id}/questionLogs/${logId}`));
      } catch (error) {
        throw error;
      }
    }
  };

  const addRevisionSchedule = async (compositeTopicId: string, daysToReview: number) => {
    if (user && db) {
      const newScheduleRef = push(ref(db, `users/${user.id}/revisionSchedules`));
      const newScheduleId = newScheduleRef.key!;
      const scheduledDate = formatISO(addDays(new Date(), daysToReview));
      const newScheduleEntry: RevisionScheduleEntry = {
        id: newScheduleId,
        compositeTopicId,
        scheduledDate,
        isReviewed: false,
        reviewedDate: null,
      };
      try {
        await set(newScheduleRef, newScheduleEntry);
      } catch (error) {
        toast({ title: "Erro ao Agendar", variant: "destructive" });
      }
    }
  };

  const toggleRevisionReviewedStatus = async (revisionId: string, nextValue?: boolean) => {
    if (!(user && db)) return;
    const revisionRef = ref(db, `users/${user.id}/revisionSchedules/${revisionId}`);
    let newStatus = nextValue;
    if (typeof newStatus === 'undefined') {
        const snap = await get(revisionRef);
        if (!snap.exists()) return;
        const current = snap.val() as RevisionScheduleEntry;
        newStatus = !current.isReviewed;
    }
    const reviewedDate = newStatus ? new Date().toISOString() : null;
    await update(revisionRef, { isReviewed: newStatus, reviewedDate });
  };
  
    const addNote = async (compositeTopicId: string, text: string) => {
        if (user && db) {
            const newNoteRef = push(ref(db, `users/${user.id}/notes`));
            const newNoteId = newNoteRef.key!;
            const newNote: NoteEntry = {
                id: newNoteId,
                compositeTopicId,
                date: new Date().toISOString(),
                text,
            };
            try {
                await set(newNoteRef, newNote);
            } catch (error) {
                toast({ title: "Erro ao Salvar Anotação", variant: "destructive" });
            }
        }
    };

    const deleteNote = async (noteId: string) => {
      if (user && db) {
          try {
              await remove(ref(db, `users/${user.id}/notes/${noteId}`));
          } catch (err) {
              toast({ title: "Erro ao Excluir", variant: "destructive" });
          }
      }
    };

    const changeItemForPlan = async (paymentIntentId: string, newItemId: string) => {
        if (!user || !user.activePlans || !db) throw new Error("Usuário ou planos não encontrados.");
        
        const planIndex = user.activePlans.findIndex(p => p.stripePaymentIntentId === paymentIntentId);
        if (planIndex === -1) throw new Error("Plano não encontrado.");

        const planToChange = user.activePlans[planIndex];
        if (!isWithinGracePeriod(planToChange.startDate, 7)) throw new Error("Período de troca expirou.");

        const updatedPlans = [...user.activePlans];
        const oldItemId = planToChange.planId === 'plano_cargo' ? planToChange.selectedCargoCompositeId : planToChange.selectedEditalId;

        if (planToChange.planId === 'plano_cargo') {
            updatedPlans[planIndex].selectedCargoCompositeId = newItemId;
        } else if (planToChange.planId === 'plano_edital') {
            updatedPlans[planIndex].selectedEditalId = newItemId;
        }

        const updates: any = { activePlans: updatedPlans };
        let registeredCargos = user.registeredCargoIds || [];

        if (planToChange.planId === 'plano_cargo' && oldItemId) {
            Object.assign(updates, cleanProgressForCargo(user, `${oldItemId}_`));
            registeredCargos = registeredCargos.filter(id => id !== oldItemId);
            registeredCargos.push(newItemId);
        } else if (planToChange.planId === 'plano_edital' && oldItemId) {
            registeredCargos = registeredCargos.filter(id => !id.startsWith(`${oldItemId}_`));
            Object.assign(updates, cleanProgressForCargo(user, `${oldItemId}_`));
        }
        updates.registeredCargoIds = Array.from(new Set(registeredCargos));
        
        try {
            await update(ref(db, `users/${user.id}`), updates);
            toast({ title: "Troca Realizada!", variant: "default", className: "bg-accent text-accent-foreground" });
        } catch (error) {
            throw error;
        }
    };

  const cancelSubscription = async (subscriptionId: string) => {
    if (!user || !db) throw new Error("Sessão inválida.");

    if (subscriptionId === 'plano_trial') {
        const updatedActivePlans = user.activePlans?.filter(p => p.planId !== 'plano_trial') || [];
        const updates: any = { activePlans: updatedActivePlans };
        if (updatedActivePlans.length === 0) updates.activePlan = null;
        
        try {
            await update(ref(db, `users/${user.id}`), updates);
            toast({ title: "Teste Cancelado" });
        } catch(e) {
            throw e;
        }
        return;
    }
    
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error("Token não encontrado.");

      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) throw new Error('Falha ao cancelar.');
      
      toast({
        title: "Cancelamento Agendado",
        description: "Seu acesso continuará até o fim do período já pago.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
      });

    } catch (error: any) {
      toast({ title: "Erro ao Cancelar", variant: "destructive" });
      throw error;
    }
  };

  const startFreeTrial = async () => {
    if (!user || !user.cpf || !user.email || !db) {
        toast({ title: "Informação Faltando", variant: "destructive" });
        return;
    }
    if (user.hasHadFreeTrial) {
        toast({ title: "Teste Já Utilizado" });
        return;
    }

    try {
        const result = await registerUsedTrialByCpf({
            cpf: user.cpf,
            email: user.email,
            name: user.name,
        });

        if (result.error) throw new Error(result.error);

        const now = new Date();
        const trialPlanDetails: PlanDetails = {
            planId: 'plano_trial',
            startDate: formatISO(now),
            expiryDate: formatISO(addDays(now, TRIAL_DURATION_DAYS)),
            status: 'active', // Define status ativo explicitamente
        };
        const updatedActivePlans = [...(user.activePlans || []), trialPlanDetails];
        const userUpdates = {
            activePlan: 'plano_trial',
            activePlans: updatedActivePlans,
            hasHadFreeTrial: true,
        };

        await update(ref(db, `users/${user.id}`), userUpdates);
        toast({ title: "Teste Ativado!", variant: "default", className: "bg-accent text-accent-foreground" });
        router.push('/');
    } catch (error: any) {
        toast({ title: "Erro ao Ativar Teste", variant: "destructive" });
    }
  };


  const setRankingParticipation = async (participate: boolean) => {
    if (user && db) {
      try {
        await update(ref(db, `users/${user.id}`), { isRankingParticipant: participate });
      } catch (error) {
        throw error;
      }
    }
  };
  
  const requestPlanRefund = async (paymentIntentId: string) => {
    if (!user || !user.activePlans || !db) return;
    
    const planIndex = user.activePlans.findIndex(p => p.stripePaymentIntentId === paymentIntentId);
    if (planIndex === -1) return;

    const updatedPlans = [...user.activePlans];
    updatedPlans[planIndex] = {
      ...updatedPlans[planIndex],
      status: 'refundRequested',
      requestDate: new Date().toISOString(),
    };
    
    try {
      await update(ref(db, `users/${user.id}`), { activePlans: updatedPlans });
      toast({ title: "Solicitação Enviada", variant: "default", className: "bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ title: "Erro ao Solicitar", variant: "destructive" });
    }
  };

  const deleteUserAccount = async () => {
    if (!auth?.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!response.ok) throw new Error("Falha ao excluir.");
      toast({ title: "Conta Excluída" });
    } catch (error: any) {
      toast({ title: "Erro na Exclusão", variant: "destructive" });
      throw error;
    }
  };

  const contextValue: AuthContextType = {
      user, loading, login, register, sendPasswordReset, logout, updateUser, 
      registerForCargo, unregisterFromCargo, toggleTopicStudyStatus, addStudyLog, deleteStudyLog,
      addQuestionLog, deleteQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus,
      addNote, deleteNote, cancelSubscription, startFreeTrial, changeItemForPlan,
      setRankingParticipation, requestPlanRefund, deleteUserAccount
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
