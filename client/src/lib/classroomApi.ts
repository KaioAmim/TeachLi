const signalingUrl = (import.meta.env.VITE_SIGNALING_URL as string | undefined) ?? 'ws://localhost:8787';
export const CLASSROOM_WS_URL = new URL('/classroom', signalingUrl).toString();
const apiUrl = signalingUrl.replace(/^ws/, 'http');

export class ClassroomRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ClassroomRequestError"; }
}

export async function classroomRequest(path: string, token?: string, body?: unknown, timeoutMs = 15000) {
  let response: Response;
  let result;
  try {
    response = await fetch(new URL(path, apiUrl), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    result = await response.json();
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('O servidor TeachLi demorou para responder. Tente novamente em instantes.');
    }
    throw new Error('Não foi possível conectar ao servidor TeachLi. Verifique se o servidor de salas está iniciado e se sua conexão está disponível.');
  }
  if (!response.ok) throw new ClassroomRequestError(typeof result?.error === 'string' ? result.error : 'Não foi possível conectar à sala. Tente novamente.', response.status);
  return result;
}

/** Pede um áudio ao servidor (ex.: voz neural). Devolve o MP3 como Blob. */
export async function classroomAudio(path: string, token: string, body: unknown, timeoutMs = 10000): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(new URL(path, apiUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error('Não foi possível obter o áudio do servidor.');
  }
  if (!response.ok) throw new ClassroomRequestError('Áudio indisponível.', response.status);
  return response.blob();
}
