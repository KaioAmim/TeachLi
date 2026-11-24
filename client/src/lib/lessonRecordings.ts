/**
 * Gravação de aulas: registra o conteúdo (falas do professor e mensagens dos alunos) com horário.
 * Fica só no navegador do professor (localStorage); nada é enviado ao servidor.
 */

export interface RecordedEntry {
  id: string;
  at: number;
  role: "aluno" | "professor";
  author: string;
  text: string;
}

export interface LessonRecording {
  id: string;
  roomName: string;
  startedAt: number;
  endedAt: number | null;
  entries: RecordedEntry[];
}

const KEY = "teachli.lessonRecordings.v1";
/** Limite de aulas guardadas (as mais antigas saem primeiro) e de entradas por aula. */
const MAX_RECORDINGS = 30;
export const MAX_ENTRIES = 5000;

function read(): LessonRecording[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: LessonRecording[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_RECORDINGS)));
    return true;
  } catch {
    return false; // armazenamento cheio ou bloqueado
  }
}

export const listRecordings = (): LessonRecording[] => read().sort((a, b) => b.startedAt - a.startedAt);

export function saveRecording(recording: LessonRecording): boolean {
  const list = read().filter(item => item.id !== recording.id);
  list.push(recording);
  return write(list);
}

export function deleteRecording(id: string): void {
  write(read().filter(item => item.id !== id));
}

const clock = (at: number) => new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const stamp = (at: number) => new Date(at).toLocaleString("pt-BR");

export function recordingDuration(recording: LessonRecording): string {
  const end = recording.endedAt ?? recording.entries.at(-1)?.at ?? recording.startedAt;
  const minutes = Math.max(0, Math.round((end - recording.startedAt) / 60000));
  return minutes < 1 ? "menos de 1 min" : `${minutes} min`;
}

/** Texto legível da aula, no formato baixado pelo professor. */
export function recordingToText(recording: LessonRecording): string {
  const header = [
    `Aula gravada — ${recording.roomName}`,
    `Início: ${stamp(recording.startedAt)}`,
    recording.endedAt ? `Fim: ${stamp(recording.endedAt)}` : "Fim: gravação interrompida",
    `Duração: ${recordingDuration(recording)}`,
    "",
  ];
  const lines = recording.entries.map(entry => `[${clock(entry.at)}] ${entry.role === "professor" ? "Professor" : `Aluno (${entry.author || "sem nome"})`}: ${entry.text}`);
  return [...header, ...lines, ""].join("\n");
}

function fileName(recording: LessonRecording, extension: "txt" | "json"): string {
  const d = new Date(recording.startedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const safeRoom = recording.roomName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `aula-${safeRoom || "sala"}-${when}.${extension}`;
}

export function downloadRecording(recording: LessonRecording, format: "txt" | "json") {
  const content = format === "txt" ? recordingToText(recording) : JSON.stringify(recording, null, 2);
  const blob = new Blob([content], { type: format === "txt" ? "text/plain;charset=utf-8" : "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(recording, format);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------------------
 * Salvar numa pasta do computador (por exemplo, a pasta do OneDrive).
 * Usa a File System Access API (Chrome/Edge). O OneDrive instalado no PC sincroniza a pasta
 * com a nuvem. A pasta escolhida é guardada no IndexedDB, pois o localStorage não guarda handles.
 * ------------------------------------------------------------------------- */

const DB_NAME = "teachli-files";
const STORE = "handles";
const FOLDER_KEY = "recordingsFolder";

export const supportsFolderSave = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getSavedFolder(): Promise<{ name: string } | null> {
  try {
    const handle = await dbGet<any>(FOLDER_KEY);
    return handle ? { name: handle.name } : null;
  } catch {
    return null;
  }
}

/** Abre o seletor de pastas (precisa de um clique do usuário) e guarda a escolhida. */
export async function chooseFolder(): Promise<{ name: string } | null> {
  if (!supportsFolderSave()) return null;
  try {
    const handle = await (window as any).showDirectoryPicker({ id: "teachli-aulas", mode: "readwrite" });
    await dbPut(FOLDER_KEY, handle);
    return { name: handle.name };
  } catch {
    return null; // seletor cancelado
  }
}

export type FolderSaveResult = "saved" | "no-folder" | "needs-permission" | "error";

/**
 * Grava o texto da aula na pasta escolhida. Fora de um clique (salvamento automático) só funciona
 * se a permissão já estiver ativa; com `interactive` pede a permissão de novo, se preciso.
 */
export async function saveRecordingToFolder(recording: LessonRecording, interactive: boolean): Promise<FolderSaveResult> {
  try {
    const handle = await dbGet<any>(FOLDER_KEY);
    if (!handle) return "no-folder";
    let permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted" && interactive) permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") return "needs-permission";
    const file = await handle.getFileHandle(fileName(recording, "txt"), { create: true });
    const writable = await file.createWritable();
    await writable.write(recordingToText(recording));
    await writable.close();
    return "saved";
  } catch {
    return "error";
  }
}
