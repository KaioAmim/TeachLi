"""
Exporta o modelo Keras para o formato LayersModel do TensorFlow.js
(model.json + weights.bin), que e o que tf.loadLayersModel() consome.
Escrito a mao para nao depender do pacote tensorflowjs, que conflita
com a versao do TF instalada.
"""
import json
import os

import numpy as np
from tensorflow import keras

WORK = "/home/claude/work"
OUT = f"{WORK}/tfjs_model"
os.makedirs(OUT, exist_ok=True)

model = keras.models.load_model(f"{WORK}/model_nobn.keras")
labels = json.load(open(f"{WORK}/labels.json"))

layers_cfg = []
weight_entries = []
weight_blobs = []
n_in = model.inputs[0].shape[1]

dense_i = 0
drop_i = 0
for li, layer in enumerate(model.layers):
    cls = layer.__class__.__name__
    if cls == "Dense":
        dense_i += 1
        name = f"dense_{dense_i}"
        cfg = {
            "name": name,
            "trainable": True,
            "dtype": "float32",
            "units": int(layer.units),
            "activation": layer.activation.__name__,
            "use_bias": True,
            "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
            "bias_initializer": {"class_name": "Zeros", "config": {}},
            "kernel_regularizer": None,
            "bias_regularizer": None,
            "activity_regularizer": None,
            "kernel_constraint": None,
            "bias_constraint": None,
        }
        if not layers_cfg:  # primeira camada carrega o shape de entrada
            cfg["batch_input_shape"] = [None, int(n_in)]
        layers_cfg.append({"class_name": "Dense", "config": cfg})

        k, b = layer.get_weights()
        weight_entries.append({"name": f"{name}/kernel", "shape": list(k.shape), "dtype": "float32"})
        weight_blobs.append(k.astype("<f4").tobytes())
        weight_entries.append({"name": f"{name}/bias", "shape": list(b.shape), "dtype": "float32"})
        weight_blobs.append(b.astype("<f4").tobytes())

    elif cls == "Dropout":
        drop_i += 1
        cfg = {"name": f"dropout_{drop_i}", "trainable": True, "dtype": "float32",
               "rate": float(layer.rate), "noise_shape": None, "seed": None}
        if not layers_cfg:
            cfg["batch_input_shape"] = [None, int(n_in)]
        layers_cfg.append({"class_name": "Dropout", "config": cfg})

model_json = {
    "format": "layers-model",
    "generatedBy": "keras v3 (treino offline sobre landmarks do dataset Libras)",
    "convertedBy": "export_tfjs.py",
    "modelTopology": {
        "keras_version": "2.15.0",
        "backend": "tensorflow",
        "model_config": {
            "class_name": "Sequential",
            "config": {"name": "libras_gesture_classifier", "layers": layers_cfg},
        },
    },
    "weightsManifest": [{"paths": ["weights.bin"], "weights": weight_entries}],
}

with open(f"{OUT}/model.json", "w") as f:
    json.dump(model_json, f)
with open(f"{OUT}/weights.bin", "wb") as f:
    f.write(b"".join(weight_blobs))
with open(f"{OUT}/labels.json", "w") as f:
    json.dump(labels, f, ensure_ascii=False)

# amostras de referencia para conferir a equivalencia no TF.js
X = np.load(f"{WORK}/probe_X.npy")
probs = model.predict(X, verbose=0)
json.dump({"inputs": X.tolist(), "expected": probs.tolist()},
          open(f"{WORK}/probe.json", "w"))

print("model.json  :", os.path.getsize(f"{OUT}/model.json"), "bytes")
print("weights.bin :", os.path.getsize(f"{OUT}/weights.bin"), "bytes")
print("labels      :", labels)
print("camadas     :", [l["class_name"] for l in layers_cfg])
