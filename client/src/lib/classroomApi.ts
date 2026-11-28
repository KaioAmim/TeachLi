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

export interface LessonMaterial {
  id: string;
  kind: 'link' | 'file';
  title: string;
  url?: string;
  name?: string;
  size?: number;
  author: string;
  createdAt: number;
}

/** Envia um arquivo do professor para a sala em que a sessão está conectada. */
export async function uploadMaterial(file: File, token: string): Promise<LessonMaterial> {
  let response: Response;
  let result;
  try {
    response = await fetch(new URL(`/materials?name=${encodeURIComponent(file.name)}`, apiUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: file,
      signal: AbortSignal.timeout(120000),
    });
    result = await response.json();
  } catch {
    throw new Error('Não foi possível enviar o arquivo. Confira a conexão e tente novamente.');
  }
  if (!response.ok) throw new ClassroomRequestError(typeof result?.error === 'string' ? result.error : 'Não foi possível enviar o arquivo.', response.status);
  return result.material;
}

/** Baixa um arquivo da sala; a sessão precisa estar conectada à mesma sala. */
export async function downloadMaterial(id: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(new URL(`/materials/${encodeURIComponent(id)}`, apiUrl), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error('Não foi possível baixar o arquivo. Confira a conexão e tente novamente.');
  }
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new ClassroomRequestError(typeof result?.error === 'string' ? result.error : 'Não foi possível baixar o arquivo.', response.status);
  }
  return response.blob();
}
