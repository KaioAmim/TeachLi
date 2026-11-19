"""Treina o classificador dinâmico (mesma arquitetura de dynamicGestureClassifier.ts).

Avaliação honesta: o informante de teste nunca aparece no treino.
Uso: python train_dynamic.py uece.npz --test-informant 5 [--no-traj] [--final out_dir]
"""
import argparse, json
import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers

p = argparse.ArgumentParser()
p.add_argument("data"); p.add_argument("--test-informant", type=int, default=5)
p.add_argument("--no-traj", action="store_true"); p.add_argument("--epochs", type=int, default=40)
p.add_argument("--wide", action="store_true", help="arquitetura maior")
p.add_argument("--final", default=None, help="treina com todos os informantes e salva pesos aqui")
a = p.parse_args()

d = np.load(a.data)
X, y, who, labels = d["X"], d["y"], d["informant"], d["labels"]
if a.no_traj:
    X = X[:, :, :126]
n_cls, feat = len(labels), X.shape[2]


def build():
    if a.wide:
        m = keras.Sequential([
            layers.Input((40, feat)),
            layers.Conv1D(96, 5, padding="same", activation="relu"), layers.BatchNormalization(),
            layers.MaxPooling1D(2),
            layers.Conv1D(192, 5, padding="same", activation="relu"), layers.BatchNormalization(),
            layers.MaxPooling1D(2),
            layers.Conv1D(256, 3, padding="same", activation="relu"), layers.BatchNormalization(),
            layers.GlobalAveragePooling1D(), layers.Dropout(0.45),
            layers.Dense(128, activation="relu"), layers.Dropout(0.3), layers.Dense(n_cls, activation="softmax")])
        m.compile(optimizer=keras.optimizers.Adam(1e-3), loss=keras.losses.SparseCategoricalCrossentropy(), metrics=["accuracy", keras.metrics.SparseTopKCategoricalAccuracy(5, name="top5")])
        return m
    m = keras.Sequential([
        layers.Input((40, feat)),
        layers.Conv1D(64, 5, padding="same", activation="relu"), layers.BatchNormalization(),
        layers.MaxPooling1D(2),
        layers.Conv1D(128, 5, padding="same", activation="relu"), layers.BatchNormalization(),
        layers.GlobalAveragePooling1D(), layers.Dropout(0.35),
        layers.Dense(64, activation="relu"), layers.Dense(n_cls, activation="softmax")])
    m.compile(optimizer=keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy", keras.metrics.SparseTopKCategoricalAccuracy(5, name="top5")])
    return m


def augment(Xb):
    n, T, F = Xb.shape
    out = np.empty_like(Xb)
    for i in range(n):  # corte + reamostragem = variação de velocidade e de recorte do clipe
        lo = np.random.randint(0, 6); hi = T - np.random.randint(0, 6)
        t = np.linspace(lo, hi - 1, T); l = np.floor(t).astype(int); h = np.minimum(l + 1, T - 1)
        out[i] = Xb[i, l] * (1 - (t - l))[:, None] + Xb[i, h] * (t - l)[:, None]
    scale = np.random.normal(1, 0.05, (n, 1, 1)).astype(np.float32)  # jitter de escala/forma
    return out * scale + np.random.normal(0, 0.02, out.shape).astype(np.float32)


if a.final:
    tr = np.ones(len(X), bool); te = None
else:
    tr, te = who != a.test_informant, who == a.test_informant
Xtr, ytr = X[tr], y[tr]
Xaug = np.concatenate([Xtr, augment(Xtr), augment(Xtr)]); yaug = np.concatenate([ytr] * 3)
m = build()
m.fit(Xaug, yaug, epochs=a.epochs, batch_size=64, verbose=2,
      validation_data=(X[te], y[te]) if te is not None else None,
      callbacks=[keras.callbacks.ReduceLROnPlateau("loss", factor=0.5, patience=4, min_lr=1e-5)])
if te is not None:
    r = m.evaluate(X[te], y[te], verbose=0, return_dict=True)
    print("RESULT", "traj" if not a.no_traj else "no-traj", "test informant", a.test_informant, r)
if a.final:
    import os; os.makedirs(a.final, exist_ok=True)
    m.save(os.path.join(a.final, "model.keras"))
    json.dump(list(labels), open(os.path.join(a.final, "labels.json"), "w"), ensure_ascii=False)
