"""Extrai os pesos de um model.keras para weights.json (lido por export_tfjs.mjs).
Uso: python export_weights.py <model.keras> <weights.json>
"""
import json, sys
from tensorflow import keras

model = keras.models.load_model(sys.argv[1])
weights = model.get_weights()  # ordem: kernel/bias, gamma/beta/mean/var — igual à do TF.js
json.dump({"shapes": [list(w.shape) for w in weights],
           "data": [w.flatten().tolist() for w in weights]}, open(sys.argv[2], "w"))
print(len(weights), "tensores")
