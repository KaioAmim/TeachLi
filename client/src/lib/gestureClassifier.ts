import * as tf from "@tensorflow/tfjs";
import { FEATURE_SIZE } from "./handFeatures";

const MODEL_STORAGE_KEY = "indexeddb://libras-gesture-classifier";
const LABELS_STORAGE_KEY = "libras-gesture-classifier-labels";
const DATASET_STORAGE_KEY = "libras-gesture-training-dataset";

/**
 * Modelo base, treinado offline sobre os landmarks do dataset público
 * "Brazilian Sign Language Alphabet" (MIT). Cobre as 15 letras estáticas
 * do alfabeto e é carregado quando o usuário ainda não treinou o seu.
 */
const PRETRAINED_MODEL_URL = "/models/gesture-classifier/model.json";
const PRETRAINED_LABELS_URL = "/models/gesture-classifier/labels.json";

export interface TrainingSample {
  label: string;
  features: number[];
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
}

/** MLP simples sobre os 63 valores de landmarks normalizados de uma mão. */
function buildModel(numClasses: number): tf.Sequential {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [FEATURE_SIZE], units: 128, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 64, activation: "relu" }));
  model.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });
  return model;
}

export function loadDataset(): TrainingSample[] {
  try {
    const raw = localStorage.getItem(DATASET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrainingSample[]) : [];
  } catch {
    return [];
  }
}

export function saveDataset(samples: TrainingSample[]): void {
  localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(samples));
}

export function getSampleCountsByLabel(samples: TrainingSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sample of samples) {
    counts[sample.label] = (counts[sample.label] || 0) + 1;
  }
  return counts;
}

/**
 * Treina um classificador a partir do dataset rotulado coletado na webcam e
 * o persiste no IndexedDB do navegador, junto com a lista de labels (as
 * classes de saída do softmax dependem dessa ordem).
 */
export async function trainClassifier(
  samples: TrainingSample[],
  options: {
    epochs?: number;
    onProgress?: (progress: TrainingProgress) => void;
  } = {}
): Promise<{ labels: string[]; finalAccuracy: number }> {
  const labels = Array.from(new Set(samples.map(s => s.label))).sort();
  if (labels.length < 2) {
    throw new Error("São necessárias pelo menos 2 classes com amostras para treinar.");
  }

  const epochs = options.epochs ?? 60;
  const labelToIndex = new Map(labels.map((label, i) => [label, i]));

  const xs = tf.tensor2d(samples.map(s => s.features));
  const ys = tf.oneHot(
    tf.tensor1d(
      samples.map(s => labelToIndex.get(s.label)!),
      "int32"
    ),
    labels.length
  );

  const model = buildModel(labels.length);

  let finalAccuracy = 0;
  await model.fit(xs, ys, {
    epochs,
    batchSize: 16,
    shuffle: true,
    validationSplit: samples.length > 20 ? 0.15 : 0,
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

export interface LoadedClassifier {
  labels: string[];
  /** "user" = treinado pelo próprio usuário; "pretrained" = modelo base embutido. */
  source: "user" | "pretrained";
  predict: (features: Float32Array) => { label: string; confidence: number };
  dispose: () => void;
}

/** Tenta carregar o modelo que o usuário treinou e salvou no IndexedDB. */
async function loadUserModel(): Promise<{ model: tf.LayersModel; labels: string[] } | null> {
  const labelsRaw = localStorage.getItem(LABELS_STORAGE_KEY);
  if (!labelsRaw) return null;

  let labels: string[];
  try {
    labels = JSON.parse(labelsRaw);
  } catch {
    return null;
  }
  if (!Array.isArray(labels) || labels.length === 0) return null;

  try {
    return { model: await tf.loadLayersModel(MODEL_STORAGE_KEY), labels };
  } catch {
    return null;
  }
}

/** Carrega o modelo base servido junto com a aplicação. */
async function loadPretrainedModel(): Promise<{ model: tf.LayersModel; labels: string[] } | null> {
  try {
    const [model, labelsRes] = await Promise.all([
      tf.loadLayersModel(PRETRAINED_MODEL_URL),
      fetch(PRETRAINED_LABELS_URL),
    ]);
    if (!labelsRes.ok) {
      model.dispose();
      return null;
    }
    return { model, labels: await labelsRes.json() };
  } catch {
    return null;
  }
}

/**
 * Carrega o classificador ativo: o do usuário tem prioridade, e o modelo
 * base entra como fallback para que o reconhecimento funcione já no
 * primeiro acesso, sem exigir treinamento.
 */
export async function loadClassifier(): Promise<LoadedClassifier | null> {
  let source: LoadedClassifier["source"] = "user";
  let loaded = await loadUserModel();

  if (!loaded) {
    source = "pretrained";
    loaded = await loadPretrainedModel();
  }
  if (!loaded) return null;

  const { model, labels } = loaded;

  const predict = (features: Float32Array) => {
    const result = tf.tidy(() => {
      const input = tf.tensor2d([Array.from(features)]);
      const output = model.predict(input) as tf.Tensor;
      const data = output.dataSync();
      let bestIndex = 0;
      for (let i = 1; i < data.length; i++) {
        if (data[i] > data[bestIndex]) bestIndex = i;
      }
      return { label: labels[bestIndex], confidence: data[bestIndex] };
    });
    return result;
  };

  return {
    labels,
    source,
    predict,
    dispose: () => model.dispose(),
  };
}

/** True quando o próprio usuário já treinou um modelo (ignora o modelo base). */
export async function hasTrainedClassifier(): Promise<boolean> {
  return localStorage.getItem(LABELS_STORAGE_KEY) !== null;
}

export async function deleteClassifier(): Promise<void> {
  localStorage.removeItem(LABELS_STORAGE_KEY);
  try {
    await tf.io.removeModel(MODEL_STORAGE_KEY);
  } catch {
    // modelo já não existia
  }
}
