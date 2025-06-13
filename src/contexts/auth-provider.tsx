
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry } from '@/types';
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
        // Fetch user-specific data from Realtime Database
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
          };
          setUser(appUser);

          // Save basic profile info if not in DB or different from Auth
          if (!dbData.name || !dbData.email || dbData.name !== appUser.name || dbData.email !== appUser.email) {
             await update(ref(db, `users/${firebaseUser.uid}`), {
                name: appUser.name,
                email: appUser.email,
                avatarUrl: appUser.avatarUrl || null
             });
          }

        } catch (error) {
          console.error("Error fetching user data from RTDB:", error);
          toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar seus dados salvos.", variant: "destructive" });
          // Fallback to basic user from Auth
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
    // Save initial user data to Realtime Database
    await set(ref(db, `users/${userCredential.user.uid}`), {
      name: name,
      email: email,
      avatarUrl: null,
      registeredCargoIds: [],
      studiedTopicIds: [],
      studyLogs: [],
      questionLogs: [],
      revisionSchedules: [],
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
        if (updatedInfo.name) authUpdates.displayName = updatedInfo.name;
        if (updatedInfo.avatarUrl) authUpdates.photoURL = updatedInfo.avatarUrl;
        
        if (Object.keys(authUpdates).length > 0) {
          await updateProfile(firebaseCurrentUser, authUpdates);
        }
        
        const dbUpdates = {
            name: updatedInfo.name || user.name,
            avatarUrl: updatedInfo.avatarUrl || user.avatarUrl || null,
        };
        await update(ref(db, `users/${user.id}`), dbUpdates);

        setUser(prevUser => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            name: dbUpdates.name,
            avatarUrl: dbUpdates.avatarUrl || undefined,
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
      const updatedRegisteredCargoIds = [...(user.registeredCargoIds || [])];
      if (!updatedRegisteredCargoIds.includes(compositeId)) {
        updatedRegisteredCargoIds.push(compositeId);
      }
      try {
        await set(ref(db, `users/${user.id}/registeredCargoIds`), updatedRegisteredCargoIds);
        setUser({ ...user, registeredCargoIds: updatedRegisteredCargoIds });
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
        await set(ref(db, `users/${user.id}/registeredCargoIds`), updatedRegisteredCargoIds);
        setUser({ ...user, registeredCargoIds: updatedRegisteredCargoIds });
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
        await set(ref(db, `users/${user.id}/studiedTopicIds`), updatedStudiedTopicIds);
        setUser({ ...user, studiedTopicIds: updatedStudiedTopicIds });
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
        await set(ref(db, `users/${user.id}/studyLogs`), updatedStudyLogs);
        setUser({ ...user, studyLogs: updatedStudyLogs });
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
        await set(ref(db, `users/${user.id}/questionLogs`), updatedQuestionLogs);
        setUser({ ...user, questionLogs: updatedQuestionLogs });
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
        await set(ref(db, `users/${user.id}/revisionSchedules`), updatedRevisionSchedules);
        setUser({ ...user, revisionSchedules: updatedRevisionSchedules });
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
          await set(ref(db, `users/${user.id}/revisionSchedules`), updatedRevisionSchedules);
          setUser({ ...user, revisionSchedules: updatedRevisionSchedules });
        } catch (error) {
          console.error("Error toggling revision status:", error);
          toast({ title: "Erro ao Atualizar Revisão", description: "Não foi possível salvar o status da revisão.", variant: "destructive" });
        }
      }
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
      toggleRevisionReviewedStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};
