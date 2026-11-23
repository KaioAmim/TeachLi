import { twoHandLandmarksToFeatures, type HandsFrame } from "./handFeatures";
import { resampleSequence, sequenceToArray } from "./sequenceUtils";
import { SEQUENCE_LENGTH, type DynamicTrainingSample } from "./dynamicGestureClassifier";

export interface LibrasCorpusEntry {
  portuguese: string;
  gloss: string;
}

export interface DatasetImportProgress {
  current: number;
  total: number;
  label: string;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

export function parseDatasetCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(header => header.toLowerCase().replace(/^['"]|['"]$/g, ""));
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function importVLibrasBD(csv: string): LibrasCorpusEntry[] {
  return parseDatasetCsv(csv).flatMap(row => {
    const portuguese = row["pt-br"] ?? row["pt_br"] ?? row.portuguese ?? row.portugues ?? "";
    const gloss = row["libras-gloss"] ?? row.libras_gloss ?? row.gloss ?? "";
    return portuguese.trim() && gloss.trim() ? [{ portuguese: portuguese.trim(), gloss: gloss.trim() }] : [];
  });
}

const CORPUS_DB = "teachli-libras-corpus";
const CORPUS_STORE = "entries";

function openCorpusDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CORPUS_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(CORPUS_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVLibrasBD(csv: string): Promise<number> {
  const entries = importVLibrasBD(csv);
  if (!entries.length) throw new Error("Não encontrei as colunas pt-br e libras-gloss no CSV.");
  const db = await openCorpusDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CORPUS_STORE, "readwrite");
    tx.objectStore(CORPUS_STORE).put(entries, "vlibrasbd");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return entries.length;
}

export async function loadVLibrasBD(): Promise<LibrasCorpusEntry[]> {
  const db = await openCorpusDb();
  const entries = await new Promise<LibrasCorpusEntry[]>((resolve, reject) => {
    const request = db.transaction(CORPUS_STORE).objectStore(CORPUS_STORE).get("vlibrasbd");
    request.onsuccess = () => resolve((request.result as LibrasCorpusEntry[] | undefined) ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return entries;
}

export function getGlossPhraseSuggestion(
  entries: LibrasCorpusEntry[],
  recognizedLabels: string[],
): LibrasCorpusEntry | null {
  const normalize = (text: string) => text.toLocaleUpperCase("pt-BR").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9_ ]/g, " ").split(/\s+/).filter(Boolean);
  const observed = recognizedLabels.slice(-8).flatMap(normalize);
  if (!observed.length) return null;
  let best: LibrasCorpusEntry | null = null;
  let bestScore = 0;
  for (const entry of entries) {
    const tokens = normalize(entry.gloss);
    if (!tokens.length) continue;
    let matched = 0;
    let cursor = tokens.length - 1;
    for (let i = observed.length - 1; i >= 0 && cursor >= 0; i--) {
      const found = tokens.lastIndexOf(observed[i], cursor);
      if (found >= 0) {
        matched++;
        cursor = found - 1;
      }
    }
    const score = matched / Math.max(observed.length, tokens.length);
    if (matched && score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore >= 0.55 ? best : null;
}

export type DetectHands = (video: HTMLVideoElement, timestamp: number) => HandsFrame | null;

function waitForVideoEvent(video: HTMLVideoElement, event: "loadedmetadata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("O navegador não conseguiu decodificar este vídeo.")); };
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function annotationForFile(file: File, annotations: Array<Record<string, string>>): string {
  const fileName = file.name.toLocaleLowerCase();
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.toLocaleLowerCase() ?? "";
  const annotation = annotations.find(row => {
    const videoName = (row.video_name ?? row.filename ?? row.file ?? "").toLocaleLowerCase();
    const videoId = (row.video_id ?? "").toLocaleLowerCase();
    return (videoName && (videoName === fileName || videoName === relativePath || relativePath.endsWith(`/${videoName}`)))
      || (videoId && (fileName.includes(videoId) || relativePath.includes(videoId)));
  });
  const className = annotation?.class ?? annotation?.label ?? annotation?.sign ?? "";
  if (className.trim()) return className.trim().toLocaleUpperCase("pt-BR");
  return file.name.replace(/\.[^.]+$/, "").replace(/[_-](articulador|sinalizador|interpreter|interprete|user)\s*\d+$/i, "").trim().toLocaleUpperCase("pt-BR");
}

export async function importVLibrasilVideos(
  files: File[],
  annotations: Array<Record<string, string>>,
  detectHands: DetectHands,
  onProgress?: (progress: DatasetImportProgress) => void,
): Promise<DynamicTrainingSample[]> {
  const videos = files.filter(file => /\.mp4$|\.webm$|\.mov$|\.m4v$/i.test(file.name));
  if (!videos.length) throw new Error("Selecione os vídeos do V-Librasil em MP4, WebM, MOV ou M4V.");
  const samples: DynamicTrainingSample[] = [];
  for (const [index, file] of videos.entries()) {
    const label = annotationForFile(file, annotations);
    onProgress?.({ current: index + 1, total: videos.length, label });
    if (!label) continue;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    try {
      const loaded = waitForVideoEvent(video, "loadedmetadata");
      video.load();
      await loaded;
      if (!Number.isFinite(video.duration) || video.duration <= 0) continue;
      const sampled: Float32Array[] = [];
      const frameCount = 24;
      for (let frame = 0; frame < frameCount; frame++) {
        const time = Math.min(video.duration - 0.01, Math.max(0, (frame / (frameCount - 1)) * video.duration));
        if (Math.abs(video.currentTime - time) > 0.001) {
          const seeked = waitForVideoEvent(video, "seeked");
          video.currentTime = time;
          await seeked;
        }
        const result = detectHands(video, performance.now());
        if (result?.landmarks.length) sampled.push(twoHandLandmarksToFeatures(result));
      }
      if (sampled.length >= 8) {
        const resampled = resampleSequence(sampled, SEQUENCE_LENGTH);
        samples.push({ label, frames: sequenceToArray(resampled) });
      }
    } catch {
      // Arquivos individuais danificados ou codecs indisponíveis não cancelam o lote.
    } finally {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }
  return samples;
}
