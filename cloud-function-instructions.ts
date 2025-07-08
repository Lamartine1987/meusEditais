/*
INSTRUÇÕES PARA IMPLEMENTAR A VALIDAÇÃO DE CPF COM CLOUD FUNCTION

Este arquivo contém o código e as etapas para criar uma Cloud Function segura que
verifica se um CPF já existe no banco de dados antes de permitir um novo cadastro.

POR QUE USAR UMA CLOUD FUNCTION?
A verificação precisa ser feita no backend (servidor) porque o código do frontend
(executado no navegador do usuário) não tem permissão para ler os dados de todos os
outros usuários por motivos de segurança. A Cloud Function roda em um ambiente
seguro do Google e pode receber permissões de administrador para consultar o banco de dados.

ETAPA 1: INICIALIZAR O FIREBASE FUNCTIONS
Se você ainda não fez isso, abra um terminal na raiz do seu projeto e execute:
1. Instale as ferramentas do Firebase: npm install -g firebase-tools
2. Faça login: firebase login
3. Inicialize as Functions: firebase init functions

   - Selecione "Use an existing project" e escolha seu projeto "meuseditais".
   - Escolha "TypeScript" como a linguagem.
   - Diga "Y" para usar o ESLint.
   - Diga "Y" para instalar as dependências com npm.

Isso criará uma pasta `functions` no seu projeto com alguns arquivos dentro.

ETAPA 2: ADICIONAR O CÓDIGO DA FUNÇÃO
Abra o arquivo `functions/src/index.ts` que foi criado e substitua todo o seu
conteúdo pelo código abaixo:
*/

// Cole este código em 'functions/src/index.ts'
// =================================================================================

import { https, logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// Inicializa o Firebase Admin SDK
initializeApp();

/**
 * Verifica se um CPF já está cadastrado no Realtime Database.
 * Esta é uma função "chamável" (onCall), o que significa que ela lida
 * com a autenticação do usuário e outros detalhes de segurança automaticamente.
 */
export const checkCpfUniqueness = https.onCall(async (data, context) => {
  const cpf = data.cpf;

  // Validação básica da entrada
  if (typeof cpf !== "string" || cpf.length !== 11) {
    throw new https.HttpsError(
      "invalid-argument",
      "O CPF fornecido é inválido. Ele deve ser uma string de 11 dígitos numéricos."
    );
  }

  const db = getDatabase();
  const usersRef = db.ref("users");

  try {
    // Realiza a consulta no banco de dados para encontrar um usuário com o CPF fornecido
    const snapshot = await usersRef.orderByChild("cpf").equalTo(cpf).once("value");

    if (snapshot.exists()) {
      // Se o snapshot existe, significa que um usuário com este CPF foi encontrado
      logger.info(`Verificação de CPF: CPF ${cpf} já está em uso.`);
      return { isUnique: false };
    } else {
      // Se não existe, o CPF está disponível
      logger.info(`Verificação de CPF: CPF ${cpf} está disponível.`);
      return { isUnique: true };
    }
  } catch (error) {
    logger.error("Erro ao verificar a unicidade do CPF:", error);
    // Lança um erro que será enviado de volta ao cliente
    throw new https.HttpsError(
      "internal",
      "Ocorreu um erro interno ao verificar o CPF. Tente novamente."
    );
  }
});

// =================================================================================
/*
ETAPA 3: FAZER O DEPLOY DA FUNÇÃO
Volte ao seu terminal, navegue para a pasta `functions` e execute o comando:
cd functions
firebase deploy --only functions

Aguarde a conclusão do deploy.

ETAPA 4: APLICAÇÃO CLIENTE
Eu já modifiquei o código do seu aplicativo Next.js para chamar essa função.
As alterações foram feitas em:
- `src/lib/firebase.ts`: Para habilitar o serviço de Functions.
- `src/app/register/page.tsx`: Para chamar a função `checkCpfUniqueness` antes de registrar o usuário.

Com a função implantada e o código do cliente atualizado, seu sistema agora
validará o CPF de forma segura e eficiente!
*/
