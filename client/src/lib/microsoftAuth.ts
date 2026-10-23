import { ClassroomRequestError, classroomRequest } from "./classroomApi";

export type AppRole = "aluno" | "professor";

export const MICROSOFT_ROLE_DOMAINS: Record<AppRole, string> = {
  aluno: "alunos.unibarretos.com.br",
  professor: "unibarretos.com.br",
};

// This is a frontend eligibility check, not an API authorization boundary.
// Protected APIs must validate tokens, institutional tenant and permissions separately.
export function roleForInstitutionalEmail(email: unknown): AppRole | null {
  if (typeof email !== "string") return null;
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase());
  if (!match) return null;
  if (match[1] === MICROSOFT_ROLE_DOMAINS.aluno) return "aluno";
  if (match[1] === MICROSOFT_ROLE_DOMAINS.professor) return "professor";
  return null;
}

interface PendingLogin {
  state: string;
  nonce: string;
  verifier: string;
  role: AppRole;
}

export interface MicrosoftSession {
  idToken: string;
  token?: string;
  role: AppRole;
  profile: {
    name: string;
    email: string | null;
    expiresAt: number;
  };
}

const PENDING_LOGIN_KEY = "teachli.microsoft.pending-login";
const SESSION_KEY = "teachli.microsoft.session";
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const tenant = (import.meta.env.VITE_MICROSOFT_TENANT_ID as string | undefined) || "organizations";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(hash));
}

function redirectUri(): string {
  return `${window.location.origin}/entrar`;
}

function getPendingLogin(): PendingLogin | null {
  const raw = sessionStorage.getItem(PENDING_LOGIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingLogin;
  } catch {
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
    return null;
  }
}

function readJwtPayload(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isMicrosoftLoginConfigured(): boolean {
  return Boolean(clientId);
}

export async function startMicrosoftLogin(role: AppRole): Promise<void> {
  if (!clientId) {
    throw new Error("O login Microsoft ainda precisa do Client ID configurado no ambiente.");
  }

  clearMicrosoftSession();

  const verifier = randomValue();
  const state = randomValue();
  const nonce = randomValue();
  sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify({ state, nonce, verifier, role }));

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: "openid profile email",
    prompt: "select_account",
    state,
    nonce,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
  });
  window.location.assign(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params}`);
}

export async function finishMicrosoftLogin(search: string): Promise<MicrosoftSession> {
  clearMicrosoftSession();
  if (!clientId) throw new Error("O Client ID do login Microsoft não está configurado.");

  const params = new URLSearchParams(search);
  const providerError = params.get("error_description") || params.get("error");
  if (providerError) throw new Error(`A Microsoft recusou o login: ${providerError}`);

  const code = params.get("code");
  const state = params.get("state");
  const pending = getPendingLogin();
  if (!code || !state || !pending || state !== pending.state) {
    throw new Error("Não foi possível validar o retorno do login Microsoft. Tente entrar novamente.");
  }
  sessionStorage.removeItem(PENDING_LOGIN_KEY);
  if (pending.role !== "aluno" && pending.role !== "professor") {
    throw new Error("Perfil de acesso inválido. Volte ao início e tente novamente.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: pending.verifier,
    scope: "openid profile email",
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenResult = await response.json() as { id_token?: string; error_description?: string };
  if (!response.ok) throw new Error(tokenResult.error_description || "Não foi possível concluir o login Microsoft.");

  const claims = readJwtPayload(tokenResult.id_token);
  const expiresAt = typeof claims?.exp === "number" ? claims.exp * 1000 : 0;
  if (claims?.aud !== clientId || claims?.nonce !== pending.nonce || expiresAt <= Date.now()) {
    throw new Error("A resposta do login Microsoft não passou pela validação da aplicação.");
  }

  const email = typeof claims.email === "string"
    ? claims.email
    : typeof claims.preferred_username === "string" ? claims.preferred_username : null;
  const role = roleForInstitutionalEmail(email);
  if (!email || role !== pending.role) {
    throw new Error(`Para entrar como ${pending.role}, use sua conta @${MICROSOFT_ROLE_DOMAINS[pending.role]}. Volte ao início para escolher outro perfil ou outra conta.`);
  }
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : "Usuário(a) Microsoft";
  const session: MicrosoftSession = {
    idToken: tokenResult.id_token!, role,
    profile: { name, email: email.trim().toLowerCase(), expiresAt },
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadMicrosoftSession(role: AppRole): MicrosoftSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as MicrosoftSession;
    if (
      typeof session.idToken !== "string" || !session.idToken ||
      (session.role !== "aluno" && session.role !== "professor") ||
      typeof session.profile?.name !== "string" ||
      typeof session.profile?.expiresAt !== "number" ||
      !Number.isFinite(session.profile.expiresAt) ||
      session.profile.expiresAt <= Date.now() ||
      roleForInstitutionalEmail(session.profile.email) !== session.role
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (session.role !== role) return null;
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearMicrosoftSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function logoutMicrosoftSession(): Promise<void> {
  const session = loadMicrosoftSession("aluno") || loadMicrosoftSession("professor");
  if (session?.token) {
    try { await classroomRequest("/auth/logout", session.token, {}); }
    catch (error) {
      // A rejected/expired token has no remote session left to revoke.
      if (!(error instanceof ClassroomRequestError) || error.status !== 401) throw error;
    }
  }
  clearMicrosoftSession();
}


let roomSessionRequest: { idToken: string; promise: Promise<MicrosoftSession & { token: string }> } | null = null;

// Room service connectivity is needed only after the original Microsoft login finishes.
export function prepareClassroomSession(): Promise<MicrosoftSession & { token: string }> {
  const session = loadMicrosoftSession("aluno") || loadMicrosoftSession("professor");
  if (!session) return Promise.reject(new Error("Entre novamente pela Microsoft."));
  if (roomSessionRequest?.idToken === session.idToken) return roomSessionRequest.promise;
  const promise = classroomRequest("/auth/microsoft/session", undefined, { idToken: session.idToken, role: session.role })
    .then(result => {
      const current = loadMicrosoftSession(session.role);
      if (current?.idToken !== session.idToken) throw new Error("A conta foi alterada. Entre novamente na sala.");
      const next = { ...current, token: result.token as string };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    }).finally(() => { if (roomSessionRequest?.promise === promise) roomSessionRequest = null; });
  roomSessionRequest = { idToken: session.idToken, promise };
  return promise;
}
