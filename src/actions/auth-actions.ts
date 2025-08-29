
'use server';

import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import { type User as AppUser } from '@/types';

interface RegisterUserInput {
  name: string;
  email: string;
  cpf: string;
  password: string;
}

interface RegisterUserResult {
  uid?: string;
  error?: string;
}

export async function registerUser(input: RegisterUserInput): Promise<RegisterUserResult> {
  const { name, email, cpf, password } = input;

  try {
    // 1. Check for CPF uniqueness in Realtime Database using Admin SDK syntax
    const usersRef = adminDb.ref('users');
    const snapshot = await usersRef.orderByChild('cpf').equalTo(cpf).once('value');

    if (snapshot.exists()) {
      return { error: 'Este CPF já está cadastrado.' };
    }

    // 2. Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });
    
    // 3. Check if this CPF has used a trial before
    const trialUsedRef = adminDb.ref(`usedTrialsByCpf/${cpf.replace(/\D/g, '')}`);
    const trialSnapshot = await trialUsedRef.once('value');
    const hasHadTrialBefore = trialSnapshot.exists();


    // 4. Save user data (including CPF) in Realtime Database
    const newUserDbData: Omit<AppUser, 'id'> = {
      name: name,
      email: email,
      cpf: cpf,
      registeredCargoIds: [],
      studiedTopicIds: [],
      studyLogs: [],
      questionLogs: [],
      revisionSchedules: [],
      notes: [],
      activePlan: null,
      activePlans: [],
      stripeCustomerId: null,
      hasHadFreeTrial: hasHadTrialBefore, // Set based on the check
      planHistory: [],
      isRankingParticipant: null,
      termsAcceptedOn: new Date().toISOString(), // Salva a data de aceite
    };
    
    await adminDb.ref(`users/${userRecord.uid}`).set(newUserDbData);
    
    return { uid: userRecord.uid };
  } catch (error: any) {
    let errorMessage = 'Não foi possível realizar o cadastro.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Este e-mail já está em uso.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'O formato do e-mail é inválido.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'A senha é muito fraca. Tente uma senha mais forte.';
    }
    console.error('[AuthAction Register] Error:', error);
    return { error: errorMessage };
  }
}


export async function registerUsedTrialByCpf(cpf: string): Promise<{ success?: true, error?: string }> {
    if (!cpf) {
        return { error: "CPF não fornecido." };
    }
    const sanitizedCpf = cpf.replace(/\D/g, '');

    try {
        const trialRef = adminDb.ref(`usedTrialsByCpf/${sanitizedCpf}`);
        const snapshot = await trialRef.once('value');

        if (snapshot.exists()) {
            return { error: 'Este CPF já utilizou o período de teste gratuito.' };
        }

        await trialRef.set(true);
        return { success: true };

    } catch (error: any) {
        console.error("[AuthAction registerUsedTrialByCpf] Error:", error);
        return { error: "Ocorreu um erro no servidor ao verificar o teste gratuito." };
    }
}
