import * as tf from "@tensorflow/tfjs";
import { FEATURE_SIZE, HAND_SEQUENCE_FEATURE_SIZE, TWO_HAND_FEATURE_SIZE } from "./handFeatures";
import { resampleSequence, sequenceToArray } from "./sequenceUtils";

// v2 adiciona a posição global do pulso a cada mão. Os clipes v1 são migrados
// mantendo zeros nessa posição; o modelo v1 segue carregável com os landmarks antigos.
const MODEL_STORAGE_KEY = "indexeddb://libras-dynamic-classifier-v2";
const LABELS_STORAGE_KEY = "libras-dynamic-classifier-labels-v2";
const LEGACY_MODEL_STORAGE_KEY = "indexeddb://libras-dynamic-classifier";
const LEGACY_LABELS_STORAGE_KEY = "libras-dynamic-classifier-labels";
const TRAINING_DB = "teachli-libras-training";
const TRAINING_STORE = "datasets";
const TRAINING_KEY = "dynamic-v2";
const LEGACY_TRAINING_KEY = "libras-dynamic-training-dataset";

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

function openTrainingDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRAINING_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TRAINING_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDataset(): Promise<DynamicTrainingSample[]> {
  const db = await openTrainingDb();
  let samples = await new Promise<DynamicTrainingSample[]>((resolve, reject) => {
    const request = db.transaction(TRAINING_STORE).objectStore(TRAINING_STORE).get(TRAINING_KEY);
    request.onsuccess = () => resolve((request.result as DynamicTrainingSample[] | undefined) ?? []);
    request.onerror = () => reject(request.error);
  });
  if (!samples.length) {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_TRAINING_KEY);
      const legacy = legacyRaw ? JSON.parse(legacyRaw) as DynamicTrainingSample[] : [];
      samples = legacy.map(sample => ({
        label: sample.label,
        frames: sample.frames.map(frame => {
          if (frame.length === TWO_HAND_FEATURE_SIZE) return frame;
          const upgraded = new Array<number>(TWO_HAND_FEATURE_SIZE).fill(0);
          for (let i = 0; i < FEATURE_SIZE; i++) {
            upgraded[i] = frame[i] ?? 0;
            upgraded[HAND_SEQUENCE_FEATURE_SIZE + i] = frame[FEATURE_SIZE + i] ?? 0;
          }
          return upgraded;
        }),
      }));
      if (samples.length) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(TRAINING_STORE, "readwrite");
          tx.objectStore(TRAINING_STORE).put(samples, TRAINING_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        localStorage.removeItem(LEGACY_TRAINING_KEY);
      }
    } catch {
      samples = [];
    }
  }
  db.close();
  return samples;
}

export async function saveDataset(samples: DynamicTrainingSample[]): Promise<void> {
  const db = await openTrainingDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRAINING_STORE, "readwrite");
    tx.objectStore(TRAINING_STORE).put(samples, TRAINING_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
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
 * escala e ruído — no mesmo espírito do augmentation offline de
 * training/train_dynamic.py, mas aplicando a MESMA rotação/escala a todos os
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
      const base = h * HAND_SEQUENCE_FEATURE_SIZE;
      for (let lm = 0; lm < 21; lm++) {
        const xi = base + lm * 3;
        const x = frame[xi];
        const y = frame[xi + 1];
        const z = frame[xi + 2];
        out[xi] = (x * cos - y * sin) * scale + (rng() - 0.5) * 0.02;
        out[xi + 1] = (x * sin + y * cos) * scale + (rng() - 0.5) * 0.02;
        out[xi + 2] = z * scale + (rng() - 0.5) * 0.02;
      }
      const position = base + FEATURE_SIZE;
      const px = frame[position];
      const py = frame[position + 1];
      out[position] = (px * cos - py * sin) * scale + (rng() - 0.5) * 0.02;
      out[position + 1] = (px * sin + py * cos) * scale + (rng() - 0.5) * 0.02;
      out[position + 2] = frame[position + 2] * scale + (rng() - 0.5) * 0.02;
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

/** Modelo base treinado offline (training/), servido de public/. */
const PRETRAINED_MODEL_URL = "/models/gesture-classifier-dynamic/model.json";
const PRETRAINED_LABELS_URL = "/models/gesture-classifier-dynamic/labels.json";

export type DynamicSource = "user" | "pretrained";

export interface DynamicPrediction {
  label: string;
  confidence: number;
  margin: number;
  /** Qual modelo produziu esta predição. */
  source: DynamicSource;
}

export interface LoadedDynamicClassifier {
  /** Modelos carregados; "user" = treinado pelo usuário, "pretrained" = base Libras-EQT-UECE. */
  sources: DynamicSource[];
  labels: string[];
  predict: (frames: Float32Array[]) => DynamicPrediction;
  dispose: () => void;
}

/** O modelo base tem 178 classes e nenhuma classe "nenhum sinal": limiares mais rígidos. */
const ACCEPT_THRESHOLDS: Record<DynamicSource, { confidence: number; margin: number }> = {
  user: { confidence: 0.75, margin: 0.15 },
  pretrained: { confidence: 0.85, margin: 0.3 },
};

export function isDynamicConfident(prediction: DynamicPrediction): boolean {
  const limits = ACCEPT_THRESHOLDS[prediction.source];
  return prediction.confidence > limits.confidence && prediction.margin > limits.margin;
}

/**
 * Carrega o classificador dinâmico com os dois modelos juntos: o treinado pelo
 * usuário e o base pré-treinado. Um modelo pessoal não desliga os sinais do
 * base — a cada consulta vale a predição aceita de maior confiança.
 */
export async function loadDynamicClassifier(): Promise<LoadedDynamicClassifier | null> {
  const [user, base] = await Promise.all([loadUserModel(), loadPretrainedModel()]);
  const parts: LoadedDynamicClassifier[] = [];
  if (user) parts.push(buildClassifier("user", user.labels, user.model, user.usesLegacyFeatures));
  if (base) parts.push(buildClassifier("pretrained", base.labels, base.model, true));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  return {
    sources: parts.flatMap(part => part.sources),
    labels: [...new Set(parts.flatMap(part => part.labels))],
    predict: frames => {
      const predictions = parts.map(part => part.predict(frames));
      const accepted = predictions.filter(isDynamicConfident);
      const pool = accepted.length > 0 ? accepted : predictions;
      return pool.reduce((best, current) => (current.confidence > best.confidence ? current : best));
    },
    dispose: () => parts.forEach(part => part.dispose()),
  };
}

interface LoadedModel {
  labels: string[];
  model: tf.LayersModel;
  /** Modelo treinado com 126 valores por quadro (sem a posição do pulso). */
  usesLegacyFeatures: boolean;
}

async function loadUserModel(): Promise<LoadedModel | null> {
  let usesLegacyFeatures = false;
  let labelsRaw = localStorage.getItem(LABELS_STORAGE_KEY);
  if (!labelsRaw) {
    labelsRaw = localStorage.getItem(LEGACY_LABELS_STORAGE_KEY);
    usesLegacyFeatures = Boolean(labelsRaw);
  }
  if (!labelsRaw) return null;

  try {
    const labels = JSON.parse(labelsRaw);
    if (!Array.isArray(labels) || labels.length === 0) return null;
    const model = await tf.loadLayersModel(usesLegacyFeatures ? LEGACY_MODEL_STORAGE_KEY : MODEL_STORAGE_KEY);
    usesLegacyFeatures = usesLegacyFeatures || model.inputs[0].shape?.[2] === 126;
    return { labels, model, usesLegacyFeatures };
  } catch {
    return null;
  }
}

async function loadPretrainedModel(): Promise<LoadedModel | null> {
  try {
    const response = await fetch(PRETRAINED_LABELS_URL);
    if (!response.ok) return null;
    const labels = await response.json();
    if (!Array.isArray(labels) || labels.length === 0) return null;
    // O modelo base foi treinado com 126 valores por quadro (as duas mãos, sem a posição do pulso).
    return { labels, model: await tf.loadLayersModel(PRETRAINED_MODEL_URL), usesLegacyFeatures: true };
  } catch {
    return null;
  }
}

function buildClassifier(
  source: DynamicSource,
  labels: string[],
  model: tf.LayersModel,
  usesLegacyFeatures: boolean,
): LoadedDynamicClassifier {
  const predict = (frames: Float32Array[]): DynamicPrediction => {
    const resampled = resampleSequence(frames, SEQUENCE_LENGTH);
    return tf.tidy(() => {
      const compatible = usesLegacyFeatures
        ? resampled.map(frame => {
            const oldFrame = new Float32Array(126);
            oldFrame.set(frame.subarray(0, 63), 0);
            oldFrame.set(frame.subarray(66, 129), 63);
            return oldFrame;
          })
        : resampled;
      const input = tf.tensor3d([sequenceToArray(compatible)]);
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
      return { label: labels[bestIndex], confidence: data[bestIndex], margin: data[bestIndex] - secondBest, source };
    });
  };

  return { sources: [source], labels, predict, dispose: () => model.dispose() };
}

export async function hasDynamicClassifier(): Promise<boolean> {
  return localStorage.getItem(LABELS_STORAGE_KEY) !== null ||
    localStorage.getItem(LEGACY_LABELS_STORAGE_KEY) !== null;
}

export async function deleteDynamicClassifier(): Promise<void> {
  localStorage.removeItem(LABELS_STORAGE_KEY);
  localStorage.removeItem(LEGACY_LABELS_STORAGE_KEY);
  try {
    await tf.io.removeModel(MODEL_STORAGE_KEY);
  } catch {
    // modelo ja nao existia
  }
  try {
    await tf.io.removeModel(LEGACY_MODEL_STORAGE_KEY);
  } catch {
    // modelo antigo ja nao existia
  }
}
