
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Get and verify the ID token from the client
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[API /account/delete] LOG: Requisição recebida sem token de autorização.');
      return NextResponse.json({ error: "Token de autorização ausente ou malformado." }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    console.log('[API /account/delete] LOG: Verificando ID token...');
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    console.log(`[API /account/delete] LOG: Token verificado com sucesso para o UID: ${uid}`);

    if (!uid) {
        console.log('[API /account/delete] LOG: Token decodificado não contém UID.');
        return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    console.log(`[API /account/delete] LOG: Iniciando processo de exclusão para o UID: ${uid}`);

    // 2. Delete user data from Realtime Database first.
    // The `usedTrialsByCpf` record is intentionally NOT deleted to prevent abuse of the free trial.
    const userDbRef = adminDb.ref(`users/${uid}`);
    await userDbRef.remove();
    console.log(`[API /account/delete] LOG: Dados do RTDB removidos com sucesso do caminho 'users/${uid}'.`);
    
    // If user is an admin, remove them from the admin list as well
    const adminRef = adminDb.ref(`admins/${uid}`);
    await adminRef.remove();
    console.log(`[API /account/delete] LOG: Verificada e removida entrada de admin (se existente) para o UID: ${uid}`);


    // 3. After successful database cleanup, delete the user from Firebase Authentication.
    await adminAuth.deleteUser(uid);
    console.log(`[API /account/delete] LOG: Usuário do Auth removido com sucesso para o UID: ${uid}`);

    return NextResponse.json({ success: true, message: "Conta excluída com sucesso." });

  } catch (error: any) {
    console.error("[API /account/delete] ERRO CRÍTICO ao excluir conta:", {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 300), // Log a short stack trace
    });

    let errorMessage = "Ocorreu um erro interno no servidor ao excluir a conta.";
    let statusCode = 500;
    
    if (error.code === 'auth/id-token-expired') {
        errorMessage = "Sua sessão expirou. Por favor, faça login novamente para excluir sua conta.";
        statusCode = 401;
    } else if (error.code === 'auth/user-not-found') {
        errorMessage = "Usuário não encontrado. A conta pode já ter sido excluída.";
        statusCode = 404;
    } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Esta é uma operação sensível e requer autenticação recente. Por favor, faça login novamente e tente de novo.";
        statusCode = 403; // Forbidden
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
