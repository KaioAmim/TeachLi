import * as tf from "@tensorflow/tfjs";
import { FEATURE_SIZE } from "./handFeatures";

const MODEL_STORAGE_KEY = "indexeddb://libras-gesture-classifier";
const LABELS_STORAGE_KEY = "libras-gesture-classifier-labels";
const DATASET_STORAGE_KEY = "libras-gesture-training-dataset";

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
  predict: (features: Float32Array) => { label: string; confidence: number };
  dispose: () => void;
}

/** Carrega o classificador treinado e salvo anteriormente, se existir. */
export async function loadClassifier(): Promise<LoadedClassifier | null> {
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
    predict,
    dispose: () => model.dispose(),
  };
}

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
