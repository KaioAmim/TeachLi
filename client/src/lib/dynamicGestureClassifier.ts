import * as tf from "@tensorflow/tfjs";
import { TWO_HAND_FEATURE_SIZE } from "./handFeatures";
import { resampleSequence, sequenceToArray } from "./sequenceUtils";

const MODEL_STORAGE_KEY = "indexeddb://libras-dynamic-classifier";
const LABELS_STORAGE_KEY = "libras-dynamic-classifier-labels";
const DATASET_STORAGE_KEY = "libras-dynamic-training-dataset";

/** Todo clipe é reamostrado para este número de quadros antes de treinar/prever. */
export const SEQUENCE_LENGTH = 40;

export interface DynamicTrainingSample {
  label: string;
  /** SEQUENCE_LENGTH x TWO_HAND_FEATURE_SIZE, já reamostrado. */
  frames: number[][];
}

export interface DynamicTrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
}

/**
 * Conv1D sobre a sequência de landmarks: cada filtro aprende um padrão de
 * movimento numa janela curta de quadros, e o pooling global no fim torna a
 * classificação invariante a exatamente em que ponto do clipe o movimento
 * acontece. É mais leve que LSTM/GRU e roda melhor em tempo real no
 * navegador via TF.js — trade-off deliberado sobre fidelidade temporal, que
 * abre mão de "lembrar" a ordem exata de eventos muito distantes entre si em
 * troca de velocidade de inferência.
 */
function buildModel(numClasses: number): tf.Sequential {
  const model = tf.sequential();
  model.add(
    tf.layers.conv1d({
      inputShape: [SEQUENCE_LENGTH, TWO_HAND_FEATURE_SIZE],
      filters: 64,
      kernelSize: 5,
      padding: "same",
      activation: "relu",
    })
  );
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(tf.layers.conv1d({ filters: 128, kernelSize: 5, padding: "same", activation: "relu" }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.globalAveragePooling1d());
  model.add(tf.layers.dropout({ rate: 0.35 }));
  model.add(tf.layers.dense({ units: 64, activation: "relu" }));
  model.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });
  return model;
}

export function loadDataset(): DynamicTrainingSample[] {
  try {
    const raw = localStorage.getItem(DATASET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DynamicTrainingSample[]) : [];
  } catch {
    return [];
  }
}

export function saveDataset(samples: DynamicTrainingSample[]): void {
  localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(samples));
}

export function getSampleCountsByLabel(samples: DynamicTrainingSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sample of samples) counts[sample.label] = (counts[sample.label] || 0) + 1;
  return counts;
}

/** Gerador pseudo-aleatório determinístico (sem depender de Math.random em testes/replays). */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Perturba um clipe inteiro: pequena rotação no plano da imagem, jitter de
 * escala e ruído — no mesmo espírito do augmentation offline em
 * scripts/dataset/train.py, mas aplicando a MESMA rotação/escala a todos os
 * quadros do clipe. Perturbar cada quadro de forma independente destruiria
 * a trajetória (o "formato" do movimento), que é justamente o que este
 * classificador precisa aprender.
 */
function augmentSample(frames: number[][], rng: () => number): number[][] {
  const angle = (rng() - 0.5) * (Math.PI / 18); // ate +-10 graus
  const scale = 1 + (rng() - 0.5) * 0.12;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return frames.map(frame => {
    const out = new Array<number>(frame.length);
    for (let h = 0; h < 2; h++) {
      const base = h * 63;
      for (let lm = 0; lm < 21; lm++) {
        const xi = base + lm * 3;
        const x = frame[xi];
        const y = frame[xi + 1];
        const z = frame[xi + 2];
        out[xi] = (x * cos - y * sin) * scale + (rng() - 0.5) * 0.02;
        out[xi + 1] = (x * sin + y * cos) * scale + (rng() - 0.5) * 0.02;
        out[xi + 2] = z * scale + (rng() - 0.5) * 0.02;
      }
    }
    return out;
  });
}

export async function trainDynamicClassifier(
  samples: DynamicTrainingSample[],
  options: {
    epochs?: number;
    augmentCopies?: number;
    onProgress?: (progress: DynamicTrainingProgress) => void;
  } = {}
): Promise<{ labels: string[]; finalAccuracy: number }> {
  const labels = Array.from(new Set(samples.map(s => s.label))).sort();
  if (labels.length < 2) {
    throw new Error("São necessários pelo menos 2 sinais dinâmicos com amostras para treinar.");
  }

  const epochs = options.epochs ?? 80;
  const augmentCopies = options.augmentCopies ?? 6;
  const labelToIndex = new Map(labels.map((l, i) => [l, i]));
  const rng = makeRng(42);

  const allFrames: number[][][] = [];
  const allLabels: number[] = [];
  for (const s of samples) {
    const idx = labelToIndex.get(s.label)!;
    allFrames.push(s.frames);
    allLabels.push(idx);
    for (let c = 0; c < augmentCopies; c++) {
      allFrames.push(augmentSample(s.frames, rng));
      allLabels.push(idx);
    }
  }

  const xs = tf.tensor3d(allFrames);
  const ys = tf.oneHot(tf.tensor1d(allLabels, "int32"), labels.length);

  const model = buildModel(labels.length);

  let finalAccuracy = 0;
  await model.fit(xs, ys, {
    epochs,
    batchSize: 16,
    shuffle: true,
    validationSplit: allFrames.length > 30 ? 0.15 : 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        finalAccuracy = (logs?.acc as number) ?? (logs?.accuracy as number) ?? finalAccuracy;
        options.onProgress?.({
          epoch: epoch + 1,
          totalEpochs: epochs,
          loss: logs?.loss ?? 0,
          accuracy: finalAccuracy,
        });
      },
    },
  });

  xs.dispose();
  ys.dispose();

  await model.save(MODEL_STORAGE_KEY);
  localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
  model.dispose();

  return { labels, finalAccuracy };
}

export interface LoadedDynamicClassifier {
  labels: string[];
  predict: (frames: Float32Array[]) => { label: string; confidence: number; margin: number };
  dispose: () => void;
}

/** Carrega o classificador dinâmico treinado pelo usuário (não há modelo base pré-treinado ainda). */
export async function loadDynamicClassifier(): Promise<LoadedDynamicClassifier | null> {
  const labelsRaw = localStorage.getItem(LABELS_STORAGE_KEY);
  if (!labelsRaw) return null;

  let labels: string[];
  try {
    labels = JSON.parse(labelsRaw);
  } catch {
    return null;
  }
  if (!Array.isArray(labels) || labels.length === 0) return null;

  let model: tf.LayersModel;
  try {
    model = await tf.loadLayersModel(MODEL_STORAGE_KEY);
  } catch {
    return null;
  }

  const predict = (frames: Float32Array[]) => {
    const resampled = resampleSequence(frames, SEQUENCE_LENGTH);
    return tf.tidy(() => {
      const input = tf.tensor3d([sequenceToArray(resampled)]);
      const output = model.predict(input) as tf.Tensor;
      const data = output.dataSync();
      let bestIndex = 0;
      let secondBest = 0;
      for (let i = 1; i < data.length; i++) {
        if (data[i] > data[bestIndex]) {
          secondBest = data[bestIndex];
          bestIndex = i;
        } else if (data[i] > secondBest) {
          secondBest = data[i];
        }
      }
      // Mesma lógica de margem do classificador estático (ver
      // gestureClassifier.ts): sem ela, dois sinais dinâmicos parecidos
      // passariam no limiar de confiança mesmo quase empatados.
      return { label: labels[bestIndex], confidence: data[bestIndex], margin: data[bestIndex] - secondBest };
    });
  };

  return { labels, predict, dispose: () => model.dispose() };
}

export async function hasDynamicClassifier(): Promise<boolean> {
  return localStorage.getItem(LABELS_STORAGE_KEY) !== null;
}

export async function deleteDynamicClassifier(): Promise<void> {
  localStorage.removeItem(LABELS_STORAGE_KEY);
  try {
    await tf.io.removeModel(MODEL_STORAGE_KEY);
  } catch {
    // modelo ja nao existia
  }
}
