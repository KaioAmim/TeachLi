"""
Treina o classificador de gestos Libras sobre os landmarks extraidos.

Decisoes que importam:
  - split AGRUPADO por blocos contiguos de quadros (nao aleatorio), porque
    quadros vizinhos do dataset sao quase identicos e vazariam entre
    treino e teste, inflando a acuracia.
  - espelhamento como augmentation permanente: o modelo passa a funcionar
    para mao esquerda e direita, e deixa de depender de o video estar
    espelhado ou nao.
  - augmentation em tempo de treino: rotacao 3D pequena, jitter de escala
    e ruido gaussiano nos landmarks.
  - class weights, porque as classes ficaram desbalanceadas (N=111, I=200).
"""
import json
import os
import re
from collections import Counter, defaultdict

import numpy as np
import tensorflow as tf
from tensorflow import keras

SEED = 42
np.random.seed(SEED)
tf.random.set_seed(SEED)

WORK = "/home/claude/work"
N_LM = 21


# ---------------------------------------------------------------- dados
def mirror(feats):
    """Espelha a mao invertendo o eixo x (features ja centradas no pulso)."""
    f = feats.copy()
    f[:, 0::3] *= -1
    return f


def load():
    rows = json.load(open(f"{WORK}/features.json"))
    by_label = defaultdict(list)
    for r in rows:
        idx = int(re.findall(r"\d+", r["file"])[0])
        by_label[r["label"]].append((idx, r["features"]))
    for k in by_label:
        by_label[k].sort(key=lambda t: t[0])
    return by_label


def grouped_split(by_label, n_blocks=10, val_blocks=(3,), test_blocks=(7, 8)):
    """Divide cada classe em blocos contiguos e aloca blocos inteiros."""
    Xtr, ytr, Xva, yva, Xte, yte = [], [], [], [], [], []
    labels = sorted(by_label)
    for li, lab in enumerate(labels):
        feats = np.array([f for _, f in by_label[lab]], dtype=np.float32)
        blocks = np.array_split(feats, n_blocks)
        for bi, b in enumerate(blocks):
            if len(b) == 0:
                continue
            if bi in test_blocks:
                Xte.append(b); yte += [li] * len(b)
            elif bi in val_blocks:
                Xva.append(b); yva += [li] * len(b)
            else:
                Xtr.append(b); ytr += [li] * len(b)
    pack = lambda X, y: (np.concatenate(X).astype(np.float32), np.array(y, np.int32))
    return labels, pack(Xtr, ytr), pack(Xva, yva), pack(Xte, yte)


def add_mirrors(X, y):
    return np.concatenate([X, mirror(X)]), np.concatenate([y, y])


# ------------------------------------------------------- augmentation
def rot_matrix(rx, ry, rz):
    cx, sx = np.cos(rx), np.sin(rx)
    cy, sy = np.cos(ry), np.sin(ry)
    cz, sz = np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def augment(X, rng, n_copies=4):
    """Gera copias perturbadas: rotacao pequena, escala e ruido."""
    out = [X]
    for _ in range(n_copies):
        P = X.reshape(-1, N_LM, 3).copy()
        for i in range(len(P)):
            R = rot_matrix(*rng.normal(0, np.deg2rad(9), 3))
            P[i] = P[i] @ R.T
        P *= rng.normal(1.0, 0.07, (len(P), 1, 1))
        P += rng.normal(0, 0.020, P.shape)
        out.append(P.reshape(len(P), -1).astype(np.float32))
    return np.concatenate(out)


# ------------------------------------------------------------- modelo
def build(n_in, n_out):
    m = keras.Sequential([
        keras.layers.Input(shape=(n_in,)),
        keras.layers.Dense(256, activation="relu"),
        keras.layers.Dropout(0.35),
        keras.layers.Dense(128, activation="relu"),
        keras.layers.Dropout(0.35),
        keras.layers.Dense(64, activation="relu"),
        keras.layers.Dropout(0.20),
        keras.layers.Dense(n_out, activation="softmax"),
    ])
    m.compile(optimizer=keras.optimizers.Adam(1e-3),
              loss="sparse_categorical_crossentropy",
              metrics=["accuracy"])
    return m


def report(model, X, y, labels, title):
    probs = model.predict(X, verbose=0)
    pred = probs.argmax(1)
    acc = (pred == y).mean()
    print(f"\n=== {title} — acuracia global: {acc*100:.2f}%  (n={len(y)})")
    print(f"{'classe':>7} {'n':>5} {'acerto':>8}   confusoes principais")
    cm = np.zeros((len(labels), len(labels)), int)
    for t, p in zip(y, pred):
        cm[t, p] += 1
    for i, lab in enumerate(labels):
        n = cm[i].sum()
        if n == 0:
            continue
        a = cm[i, i] / n
        conf = sorted([(cm[i, j], labels[j]) for j in range(len(labels)) if j != i],
                      reverse=True)[:3]
        conf = ", ".join(f"{l}:{c}" for c, l in conf if c > 0) or "-"
        print(f"{lab:>7} {n:>5} {a*100:>7.1f}%   {conf}")
    return acc, cm


def main():
    by_label = load()
    labels, (Xtr, ytr), (Xva, yva), (Xte, yte) = grouped_split(by_label)
    print("classes:", labels)
    print(f"treino {len(ytr)} | validacao {len(yva)} | teste {len(yte)}")
    print("distribuicao treino:", dict(sorted(Counter(labels[i] for i in ytr).items())))

    # espelhamento em todos os conjuntos: modelo invariante a mao usada
    Xtr, ytr = add_mirrors(Xtr, ytr)
    Xva, yva = add_mirrors(Xva, yva)
    Xte, yte = add_mirrors(Xte, yte)

    rng = np.random.default_rng(SEED)
    Xtr_a = augment(Xtr, rng, n_copies=5)
    ytr_a = np.tile(ytr, 6)
    perm = rng.permutation(len(ytr_a))
    Xtr_a, ytr_a = Xtr_a[perm], ytr_a[perm]
    print(f"treino apos espelho + augmentation: {len(ytr_a)} amostras")

    counts = Counter(ytr_a.tolist())
    total = sum(counts.values())
    cw = {i: total / (len(labels) * counts[i]) for i in counts}

    model = build(Xtr_a.shape[1], len(labels))
    model.fit(
        Xtr_a, ytr_a,
        validation_data=(Xva, yva),
        epochs=180, batch_size=128, class_weight=cw, verbose=0,
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=30,
                                          restore_best_weights=True, mode="max"),
            keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5,
                                              patience=12, min_lr=1e-5),
        ],
    )

    report(model, Xva, yva, labels, "VALIDACAO")
    acc, cm = report(model, Xte, yte, labels, "TESTE (blocos nunca vistos)")

    # comparativo: quanto o split aleatorio teria inflado o numero
    Xall = np.concatenate([Xtr, Xva, Xte]); yall = np.concatenate([ytr, yva, yte])
    p = np.random.default_rng(0).permutation(len(yall))
    cut = int(len(yall) * 0.8)
    m2 = build(Xall.shape[1], len(labels))
    m2.fit(Xall[p[:cut]], yall[p[:cut]], epochs=80, batch_size=128, verbose=0)
    a2 = (m2.predict(Xall[p[cut:]], verbose=0).argmax(1) == yall[p[cut:]]).mean()
    print(f"\n[referencia] mesmo modelo com split ALEATORIO: {a2*100:.2f}% "
          f"(vs {acc*100:.2f}% no split honesto) — diferenca de {(a2-acc)*100:.1f} pts")

    model.save(f"{WORK}/model_nobn.keras")
    json.dump(labels, open(f"{WORK}/labels.json", "w"))
    np.save(f"{WORK}/confusion.npy", cm)
    print(f"\nmodelo salvo. parametros: {model.count_params():,}")


if __name__ == "__main__":
    main()
