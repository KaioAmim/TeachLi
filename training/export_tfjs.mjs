// Converte os pesos do Keras (model.keras exportado como weights.json por export_weights.py)
// para o formato TF.js (model.json + weights.bin) usado pelo app.
// Uso: node export_tfjs.mjs <weights.json> <labels.json> <pasta-de-saida>
import * as tf from "@tensorflow/tfjs";
import fs from "node:fs";
import path from "node:path";

const [weightsPath, labelsPath, outDir] = process.argv.slice(2);
const { shapes, data } = JSON.parse(fs.readFileSync(weightsPath, "utf8"));
const labels = JSON.parse(fs.readFileSync(labelsPath, "utf8"));
const FEATURES = 126;

// Mesma arquitetura do train_dynamic.py --wide
const model = tf.sequential();
model.add(tf.layers.conv1d({ inputShape: [40, FEATURES], filters: 96, kernelSize: 5, padding: "same", activation: "relu" }));
model.add(tf.layers.batchNormalization());
model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
model.add(tf.layers.conv1d({ filters: 192, kernelSize: 5, padding: "same", activation: "relu" }));
model.add(tf.layers.batchNormalization());
model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
model.add(tf.layers.conv1d({ filters: 256, kernelSize: 3, padding: "same", activation: "relu" }));
model.add(tf.layers.batchNormalization());
model.add(tf.layers.globalAveragePooling1d());
model.add(tf.layers.dropout({ rate: 0.45 }));
model.add(tf.layers.dense({ units: 128, activation: "relu" }));
model.add(tf.layers.dropout({ rate: 0.3 }));
model.add(tf.layers.dense({ units: labels.length, activation: "softmax" }));

// Keras entrega os pesos camada a camada (kernel, bias, gamma, beta, média, variância);
// o TF.js espera primeiro todos os treináveis e depois todos os não treináveis.
const trainable = [];
const frozen = [];
let cursor = 0;
for (const layer of model.layers) {
  const own = layer.weights.length;
  const nTrainable = layer.trainableWeights.length;
  for (let k = 0; k < own; k++, cursor++) {
    (k < nTrainable ? trainable : frozen).push(tf.tensor(data[cursor], shapes[cursor]));
  }
}
if (cursor !== shapes.length) throw new Error(`pesos não casam: ${cursor} vs ${shapes.length}`);
model.setWeights([...trainable, ...frozen]);

fs.mkdirSync(outDir, { recursive: true });
await model.save(
  tf.io.withSaveHandler(async artifacts => {
    fs.writeFileSync(path.join(outDir, "model.json"), JSON.stringify({
      modelTopology: artifacts.modelTopology,
      format: "layers-model",
      generatedBy: "TeachLi training/export_tfjs.mjs",
      convertedBy: null,
      weightsManifest: [{ paths: ["weights.bin"], weights: artifacts.weightSpecs }],
    }));
    fs.writeFileSync(path.join(outDir, "weights.bin"), Buffer.from(artifacts.weightData));
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
  }),
);
fs.writeFileSync(path.join(outDir, "labels.json"), JSON.stringify(labels));
console.log(`modelo TF.js salvo em ${outDir}`);
