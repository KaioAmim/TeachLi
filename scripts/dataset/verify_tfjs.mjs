/** Verify exported probabilities using the same TF.js dependency as the app.
 * node scripts/dataset/verify_tfjs.mjs /path/to/experiment
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(resolve(root, "client/package.json"));
const tf = require("@tensorflow/tfjs");
const directory = process.argv[2];
assert.ok(directory, "Pass the experiment directory");
const readJSON = async path => JSON.parse(await readFile(resolve(directory, path), "utf8"));
const config = await readJSON("model/model.json");
const labels = await readJSON("model/labels.json");
const probe = await readJSON("probe.json");
const weights = await readFile(resolve(directory, "model/weights.bin"));
const model = await tf.loadLayersModel(tf.io.fromMemory({
  modelTopology: config.modelTopology,
  weightSpecs: config.weightsManifest[0].weights,
  weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength),
}));
assert.equal(model.inputs[0].shape[1], 63);
assert.equal(model.outputs[0].shape[1], labels.length);
const input = tf.tensor2d(probe.inputs);
const output = model.predict(input);
const actual = await output.array();
let maxError = 0;
for (let i = 0; i < actual.length; i++) {
  assert.ok(Math.abs(actual[i].reduce((a, b) => a + b, 0) - 1) < 1e-5);
  for (let j = 0; j < labels.length; j++) {
    assert.ok(Number.isFinite(actual[i][j]));
    maxError = Math.max(maxError, Math.abs(actual[i][j] - probe.expected[i][j]));
  }
}
assert.ok(maxError < 1e-4, `Export mismatch: ${maxError}`);
// Also check offline normalization against the application's real implementation.
let normalizationError = null;
try {
  const { transformWithEsbuild } = require("vite");
  const source = await readFile(resolve(root, "client/src/lib/handFeatures.ts"), "utf8");
  const { code } = await transformWithEsbuild(source, "handFeatures.ts", { loader: "ts", format: "esm" });
  const { landmarksToFeatures } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const normalization = await readJSON("normalization-probe.json");
  normalizationError = 0;
  for (const sample of normalization) {
    const points = Array.from({ length: 21 }, (_, i) => ({
      x: sample.raw[i * 3], y: sample.raw[i * 3 + 1], z: sample.raw[i * 3 + 2],
    }));
    const features = landmarksToFeatures(points);
    for (let i = 0; i < 63; i++) normalizationError = Math.max(normalizationError, Math.abs(features[i] - sample.expected[i]));
  }
  assert.ok(normalizationError < 1e-5, `Normalization mismatch: ${normalizationError}`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
input.dispose();
output.dispose();
model.dispose();
console.log(JSON.stringify({ examples: actual.length, classes: labels.length, maxError, normalizationError }));
