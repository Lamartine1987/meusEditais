
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import type { User } from '@/types';

export async function POST(req: NextRequest) {
  let uid: string | null = null; 
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[API /account/delete] LOG: Requisição recebida sem token de autorização.');
      return NextResponse.json({ error: "Token de autorização ausente ou malformado." }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    console.log('[API /account/delete] LOG: Verificando ID token...');
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    uid = decodedToken.uid;
    console.log(`[API /account/delete] LOG: Token verificado com sucesso para o UID: ${uid}`);

    if (!uid) {
        console.log('[API /account/delete] LOG: Token decodificado não contém UID.');
        return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    // --- NOVO: LÓGICA DE LOG ANTES DA EXCLUSÃO ---
    console.log(`[API /account/delete] LOG: Buscando dados do usuário ${uid} para registro de auditoria...`);
    const userDbRef = adminDb.ref(`users/${uid}`);
    const userSnapshot = await userDbRef.once('value');
    
    if (userSnapshot.exists()) {
      const userData: User = userSnapshot.val();
      const logData = {
        email: userData.email,
        cpf: userData.cpf || 'Não informado',
        lastActivePlan: userData.activePlan || 'Nenhum',
        deletedOn: new Date().toISOString(),
        originalUid: uid,
      };

      console.log(`[API /account/delete] LOG: Salvando registro de exclusão para o UID: ${uid}`);
      const deletedLogRef = adminDb.ref(`deletedAccountsLog/${uid}`);
      await deletedLogRef.set(logData);
      console.log(`[API /account/delete] LOG: Registro de exclusão salvo com sucesso.`);
    } else {
      console.warn(`[API /account/delete] AVISO: Dados do usuário não encontrados no RTDB para o UID: ${uid} para criar o log. Continuando com a exclusão do Auth.`);
    }
    // --- FIM DA LÓGICA DE LOG ---

    console.log(`[API /account/delete] LOG: Iniciando processo de exclusão de dados para o UID: ${uid}`);

    // 2. Excluir dados do usuário do Realtime Database.
    await userDbRef.remove();
    console.log(`[API /account/delete] LOG: Dados do RTDB removidos com sucesso do caminho 'users/${uid}'.`);
    
    // Remover o usuário da lista de administradores, se aplicável.
    const adminRef = adminDb.ref(`admins/${uid}`);
    await adminRef.remove();
    console.log(`[API /account/delete] LOG: Verificada e removida entrada de admin (se existente) para o UID: ${uid}`);

    // 3. Após a limpeza do banco de dados, excluir o usuário do Firebase Authentication.
    await adminAuth.deleteUser(uid);
    console.log(`[API /account/delete] LOG: Usuário do Auth removido com sucesso para o UID: ${uid}`);

    return NextResponse.json({ success: true, message: "Conta e dados associados excluídos com sucesso." });

  } catch (error: any) {
    console.error(`[API /account/delete] ERRO CRÍTICO ao excluir conta para o UID: ${uid || 'desconhecido'}:`, {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 300),
    });

    let errorMessage = "Ocorreu um erro interno no servidor ao excluir a conta.";
    let statusCode = 500;
    
    if (error.code === 'auth/id-token-expired') {
        errorMessage = "Sua sessão expirou. Por favor, faça login novamente para excluir sua conta.";
        statusCode = 401;
    } else if (error.code === 'auth/user-not-found') {
        // Isso pode acontecer se a exclusão falhar após remover o Auth, mas antes da resposta ser enviada.
        errorMessage = "Usuário não encontrado. A conta pode já ter sido excluída.";
        statusCode = 404;
    } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Esta é uma operação sensível e requer autenticação recente. Por favor, faça login novamente e tente de novo.";
        statusCode = 403; // Forbidden
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
