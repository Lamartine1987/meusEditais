// lib/secrets.ts
'use server';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const sm = new SecretManagerServiceClient();
const cache = new Map<string, string>();

function projectId() {
  try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return undefined; }
}

export async function getSecret(name: string): Promise<string> {
  if (cache.has(name)) return cache.get(name)!;
  const pid = projectId() || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!pid) {
    console.error('[secrets] PROJECT_ID não detectado nas variáveis de ambiente padrão.');
    throw new Error('PROJECT_ID não detectado');
  }
  
  const secretPath = `projects/${pid}/secrets/${name}/versions/latest`;
  console.log(`[secrets] Acessando segredo: ${secretPath}`);

  try {
    const [version] = await sm.accessSecretVersion({
      name: secretPath,
    });
    const val = version.payload?.data?.toString('utf8') || '';
    if (!val) {
      console.error(`[secrets] Segredo '${name}' está vazio ou não pôde ser decodificado.`);
      throw new Error(`Secret vazio: ${name}`);
    }
    cache.set(name, val);
    return val;
  } catch (error: any) {
     console.error(`[secrets] Falha ao acessar o segredo '${name}'. Verifique se o segredo existe e se o serviço tem a permissão 'Secret Manager Secret Accessor'. Erro:`, error.message);
     throw new Error(`Falha ao acessar o segredo: ${name}`);
  }
}

export async function getEnvOrSecret(name: string): Promise<string> {
  // Prioriza a variável de ambiente se ela existir, senão busca no Secret Manager.
  return process.env[name] ?? (await getSecret(name));
}
