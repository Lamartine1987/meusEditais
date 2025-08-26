
'use server';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const sm = new SecretManagerServiceClient();
const cache = new Map<string, string>();

function projectId() {
  try { 
    const pid = JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
    console.log(`[secrets] projectId from FIREBASE_CONFIG: ${pid}`);
    return pid;
  } catch(e) { 
    console.warn('[secrets] Could not parse FIREBASE_CONFIG for projectId.');
    return undefined; 
  }
}

export async function getSecret(name: string): Promise<string> {
  if (cache.has(name)) {
    console.log(`[secrets] Retornando segredo '${name}' do cache.`);
    return cache.get(name)!;
  }

  const pid = projectId() || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!pid) {
    console.error('[secrets] ERRO CRÍTICO: PROJECT_ID não detectado em nenhuma variável de ambiente padrão (FIREBASE_CONFIG, GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT).');
    throw new Error('PROJECT_ID não detectado no ambiente do servidor.');
  }
  
  const secretPath = `projects/${pid}/secrets/${name}/versions/latest`;
  console.log(`[secrets] Buscando segredo do Secret Manager: ${secretPath}`);

  try {
    const [version] = await sm.accessSecretVersion({
      name: secretPath,
    });
    
    const val = version.payload?.data?.toString() || '';
    if (!val) {
      console.error(`[secrets] ERRO: Segredo '${name}' foi encontrado, mas está vazio ou não pôde ser decodificado.`);
      throw new Error(`Secret '${name}' está vazio.`);
    }

    console.log(`[secrets] SUCESSO: Segredo '${name}' carregado e adicionado ao cache.`);
    cache.set(name, val);
    return val;
  } catch (error: any) {
     console.error(`[secrets] ERRO CRÍTICO ao acessar o segredo '${name}'. Verifique se o segredo existe no Secret Manager e se o serviço ('meuseditaisbackend') tem a permissão 'Secret Manager Secret Accessor'. Erro original:`, error.message);
     throw new Error(`Falha ao acessar o segredo: ${name}. Verifique os logs do servidor.`);
  }
}

export async function getEnvOrSecret(name: string): Promise<string> {
  console.log(`[getEnvOrSecret] Solicitando variável/segredo: '${name}'`);
  const envVar = process.env[name];
  if (envVar) {
    console.log(`[getEnvOrSecret] Encontrada variável de ambiente '${name}'. Usando seu valor.`);
    return envVar;
  }
  
  console.log(`[getEnvOrSecret] Variável de ambiente '${name}' não encontrada. Tentando buscar no Secret Manager...`);
  return getSecret(name);
}
