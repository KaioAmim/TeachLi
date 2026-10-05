import type { TrainingSample } from "./gestureClassifier";

/**
 * Dataset público "Brazilian Sign Language Alphabet" (licença MIT), com fotos
 * estáticas de 15 letras do alfabeto Libras que não envolvem movimento.
 * https://github.com/biankatpas/Brazilian-Sign-Language-Alphabet-Dataset
 *
 * As fotos NÃO são baixadas pelo navegador. A extração de landmarks foi feita
 * uma única vez, offline (ver scripts/dataset/), e o que é servido aqui é só o
 * resultado: vetores de 63 floats já normalizados pelo mesmo
 * landmarksToFeatures() usado na webcam. Isso troca ~39 MB de JPEG e vários
 * minutos de processamento no cliente por ~1 MB e um único fetch.
 */
const LANDMARKS_URL = "/datasets/libras-landmarks.json";

export interface ImportProgress {
  processed: number;
  total: number;
  currentLabel: string;
  skipped: number;
}

interface LandmarkDataset {
  featureSize: number;
  labels: string[];
  samples: Record<string, number[][]>;
}

export async function importPretrainedAlphabetDataset(
  options: {
    maxPerLabel?: number;
    onProgress?: (progress: ImportProgress) => void;
  } = {}
): Promise<TrainingSample[]> {
  const { maxPerLabel = 200, onProgress } = options;

  const response = await fetch(LANDMARKS_URL);
  if (!response.ok) {
    throw new Error(`Dataset de landmarks não encontrado em ${LANDMARKS_URL}`);
  }

  const dataset: LandmarkDataset = await response.json();
  const labels = dataset.labels ?? Object.keys(dataset.samples);

  const total = labels.reduce(
    (sum, label) => sum + Math.min(dataset.samples[label]?.length ?? 0, maxPerLabel),
    0
  );

  const samples: TrainingSample[] = [];
  let skipped = 0;

  for (const label of labels) {
    const rows = (dataset.samples[label] ?? []).slice(0, maxPerLabel);
    for (const features of rows) {
      if (features.length !== dataset.featureSize) {
        skipped++;
        continue;
      }
      samples.push({ label, features });
    }
    onProgress?.({ processed: samples.length, total, currentLabel: label, skipped });
  }

  return samples;
}
