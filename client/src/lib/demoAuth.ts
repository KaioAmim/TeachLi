import { DEMO_AUTH_URL } from "@/lib/webrtc/config";

const SESSION_STORAGE_KEY = "teachli-demo-professor-session";

export interface ProfessorDemoSession {
  token: string;
  profile: {
    name: string;
    email: string;
    role: "professor";
    expiresAt: number;
  };
}

export function loadProfessorDemoSession(): ProfessorDemoSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as ProfessorDemoSession;
    if (
      !session?.token ||
      session.profile?.role !== "professor" ||
      typeof session.profile.expiresAt !== "number" ||
      session.profile.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearProfessorDemoSession() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function signInProfessorDemo(input: {
  name: string;
  email: string;
  accessCode: string;
}): Promise<ProfessorDemoSession> {
  const response = await fetch(DEMO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Não foi possível iniciar a sessão demo.");
  }

  const session = body as ProfessorDemoSession;
  if (!session?.token || session.profile?.role !== "professor") {
    throw new Error("A resposta de autenticação é inválida.");
  }
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}
