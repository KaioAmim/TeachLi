import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { landmarksToFeatures } from "./handFeatures";
import type { TrainingSample } from "./gestureClassifier";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URLS = [
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  "/models/hand_landmarker.task",
];

const DATASET_BASE_URL = "/datasets/libras-alphabet";
const MANIFEST_URL = `${DATASET_BASE_URL}/manifest.json`;

export interface ImportProgress {
  processed: number;
  total: number;
  currentLabel: string;
  skipped: number;
}

/**
 * Dataset público "Brazilian Sign Language Alphabet" (licença MIT), com fotos
 * estáticas de 15 letras do alfabeto Libras que não envolvem movimento.
 * https://github.com/biankatpas/Brazilian-Sign-Language-Alphabet-Dataset
 */
export async function loadDatasetManifest(): Promise<Record<string, string[]>> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error("Manifesto do dataset não encontrado em /datasets/libras-alphabet/manifest.json");
  }
  return response.json();
}

async function createImageLandmarker(): Promise<HandLandmarker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  let lastError: unknown;

  for (const modelAssetPath of MODEL_URLS) {
    try {
      return await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath },
        runningMode: "IMAGE",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao carregar modelo MediaPipe");
}

function loadImageBitmap(url: string): Promise<ImageBitmap> {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Falha ao buscar ${url}`);
      return res.blob();
    })
    .then(blob => createImageBitmap(blob));
}

/**
 * Baixa (do dataset já servido em /public), roda o HandLandmarker em modo
 * IMAGE sobre cada foto e converte para features normalizadas — o mesmo
 * pipeline usado no treino/inferência em tempo real, só que sobre fotos
 * em vez de frames de webcam.
 */
export async function importPretrainedAlphabetDataset(options: {
  maxPerLabel?: number;
  onProgress?: (progress: ImportProgress) => void;
} = {}): Promise<TrainingSample[]> {
  const { maxPerLabel = 150, onProgress } = options;

  const manifest = await loadDatasetManifest();
  const entries = Object.entries(manifest).flatMap(([label, files]) =>
    files.slice(0, maxPerLabel).map(file => ({ label, file }))
  );

  const landmarker = await createImageLandmarker();
  const samples: TrainingSample[] = [];
  let skipped = 0;

  try {
    for (let i = 0; i < entries.length; i++) {
      const { label, file } = entries[i];
      try {
        const bitmap = await loadImageBitmap(`${DATASET_BASE_URL}/${label}/${file}`);
        const result = landmarker.detect(bitmap);
        if (result.landmarks?.[0]) {
          samples.push({
            label,
            features: Array.from(landmarksToFeatures(result.landmarks[0] as any)),
          });
        } else {
          skipped++;
        }
        bitmap.close();
      } catch {
        skipped++;
      }

      onProgress?.({ processed: i + 1, total: entries.length, currentLabel: label, skipped });
    }
  } finally {
    landmarker.close();
  }

  return samples;
}
