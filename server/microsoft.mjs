import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

// Reuse the public application ID already used by the existing Microsoft login.
// A separately deployed server can supply MICROSOFT_CLIENT_ID instead.
export function microsoftClientId(env = process.env) {
  if (env.MICROSOFT_CLIENT_ID) return env.MICROSOFT_CLIENT_ID;
  if (env.VITE_MICROSOFT_CLIENT_ID) return env.VITE_MICROSOFT_CLIENT_ID;
  let value;
  const mode = env.NODE_ENV === 'production' ? 'production' : 'development';
  for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    try {
      const parsed = parseEnv(readFileSync(new URL(`../client/${name}`, import.meta.url), 'utf8'));
      value = parsed.VITE_MICROSOFT_CLIENT_ID || value;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return value;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tenant ID da instituição: obrigatório. Somente tokens desse tenant são aceitos.
export function microsoftTenantId(env = process.env) {
  let value = env.MICROSOFT_TENANT_ID || env.VITE_MICROSOFT_TENANT_ID;
  if (!value) {
    const mode = env.NODE_ENV === 'production' ? 'production' : 'development';
    for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
      try {
        const parsed = parseEnv(readFileSync(new URL(`../client/${name}`, import.meta.url), 'utf8'));
        value = parsed.VITE_MICROSOFT_TENANT_ID || value;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  value = value?.trim();
  if (!value) throw new Error('Configure MICROSOFT_TENANT_ID (ou VITE_MICROSOFT_TENANT_ID) com o GUID do tenant da instituição.');
  if (!GUID.test(value)) throw new Error('MICROSOFT_TENANT_ID deve ser o GUID do tenant da instituição.');
  return value.toLowerCase();
}

export function createMicrosoftVerifier(env = process.env, keySet) {
  const audience = microsoftClientId(env);
  const tenant = microsoftTenantId(env);
  const keys = keySet ?? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
  return async token => {
    if (!audience) throw new Error('Configure o mesmo Client ID público já usado pelo login Microsoft.');
    // Unverified tid only constructs the expected issuer. It never selects a network host.
    const { tid } = decodeJwt(token);
    if (typeof tid !== 'string' || !GUID.test(tid) || tid === '9188040d-6c67-4c5b-b112-36a304b66dad') throw new Error('Use uma conta organizacional Microsoft.');
    if (tid.toLowerCase() !== tenant) throw new Error('Use uma conta do tenant institucional configurado.');
    const issuer = `https://login.microsoftonline.com/${tid}/v2.0`;
    const resolveKey = async (header, jwt) => {
      const key = await keys(header, jwt);
      const matching = keys.jwks().keys.filter(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
      if (matching.length !== 1 || typeof matching[0].issuer !== 'string' || matching[0].issuer.replace('{tenantid}', tid) !== issuer) throw new Error('Emissor da chave Microsoft inválido.');
      return key;
    };
    const { payload } = await jwtVerify(token, resolveKey, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'oid', 'tid'] });
    if (typeof payload.oid !== 'string' || !payload.oid) throw new Error('Identidade inválida.');
    const email = String(payload.email ?? payload.preferred_username ?? '').trim().toLowerCase();
    // Preserve the prototype's existing role/domain rule; no new Entra assignment required.
    let role;
    if (/^[^\s@]+@alunos\.unibarretos\.com\.br$/.test(email)) role = 'aluno';
    if (/^[^\s@]+@unibarretos\.com\.br$/.test(email)) role = 'professor';
    if (!role) throw new Error('Use a conta institucional correspondente ao perfil escolhido.');
    return { id: `${tid}:${payload.oid}`, role, email, name: String(payload.name || email).slice(0, 100), exp: payload.exp };
  };
}
