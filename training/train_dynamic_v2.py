"""Treino do classificador dinâmico v2: com classe "nenhum sinal" e aumento realista.

Diferenças em relação a train_dynamic.py:
  * parte dos clipes brutos (comprimento variável), não de clipes já reamostrados;
  * exemplos positivos com recorte e "contaminação" (sobras do sinal vizinho) — é o
    que a janela deslizante vê ao vivo;
  * classe extra "__nenhum__" com transições entre sinais, recortes parciais e poses
    paradas, para que o modelo possa dizer "isto não é um sinal".

Uso: python train_dynamic_v2.py uece_raw.npz --holdout 5 --out dir [--no-none]
     python train_dynamic_v2.py uece_raw.npz --holdout 0 --out dir   (treina com todos)
"""
import argparse, json, os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers

SEQ = 40
NONE_LABEL = "__nenhum__"


def resample(frames, n=SEQ):
    t = np.linspace(0, len(frames) - 1, n)
    lo = np.floor(t).astype(int)
    hi = np.minimum(lo + 1, len(frames) - 1)
    f = (t - lo)[:, None]
    return (frames[lo] * (1 - f) + frames[hi] * f).astype(np.float32)


def load(path):
    d = np.load(path)
    frames, lengths = d["frames"], d["lengths"]  # um acesso só: cada d[...] descomprime o arquivo inteiro
    ends = np.cumsum(lengths)
    starts = ends - lengths
    clips = [frames[s:e] for s, e in zip(starts, ends)]
    return clips, d["y"], d["informant"], list(d["labels"])


def jitter(x, rng, noise=0.02, scale=0.05):
    return x * rng.normal(1, scale) + rng.normal(0, noise, x.shape).astype(np.float32)


def positive(clip, others, rng):
    n = len(clip)
    lo = int(n * rng.uniform(0, 0.08)); hi = n - int(n * rng.uniform(0, 0.08))
    seg = clip[lo:hi]
    if rng.random() < 0.5:  # sobra do sinal vizinho no começo e/ou no fim (até 15%)
        o = others[rng.integers(len(others))]
        k = max(1, int(len(seg) * rng.uniform(0.02, 0.15)))
        seg = np.concatenate([o[-k:], seg])
    if rng.random() < 0.5:
        o = others[rng.integers(len(others))]
        k = max(1, int(len(seg) * rng.uniform(0.02, 0.15)))
        seg = np.concatenate([seg, o[:k]])
    return jitter(resample(seg), rng)


def negative(clips, rng):
    kind = rng.integers(4)
    a = clips[rng.integers(len(clips))]
    if kind == 0:  # transição: fim de um sinal + começo de outro
        b = clips[rng.integers(len(clips))]
        ka = max(3, int(len(a) * rng.uniform(0.3, 0.7))); kb = max(3, int(len(b) * rng.uniform(0.3, 0.7)))
        seg = np.concatenate([a[-ka:], b[:kb]])
    elif kind == 1:  # trecho curto de um sinal (início, meio ou fim)
        k = max(4, int(len(a) * rng.uniform(0.12, 0.35)))
        s = rng.integers(0, len(a) - k + 1)
        seg = a[s:s + k]
    elif kind == 2:  # mão parada numa pose
        seg = np.repeat(a[rng.integers(len(a))][None], 12, axis=0)
    else:  # pose de preparação/recuperação (extremidades do clipe)
        k = max(3, int(len(a) * 0.1))
        seg = a[:k] if rng.random() < 0.5 else a[-k:]
    return jitter(resample(seg), rng, noise=0.01 if kind >= 2 else 0.02)


def build_model(n_cls, feat=126):
    m = keras.Sequential([
        layers.Input((SEQ, feat)),
        layers.Conv1D(96, 5, padding="same", activation="relu"), layers.BatchNormalization(), layers.MaxPooling1D(2),
        layers.Conv1D(192, 5, padding="same", activation="relu"), layers.BatchNormalization(), layers.MaxPooling1D(2),
        layers.Conv1D(256, 3, padding="same", activation="relu"), layers.BatchNormalization(),
        layers.GlobalAveragePooling1D(), layers.Dropout(0.45),
        layers.Dense(128, activation="relu"), layers.Dropout(0.3), layers.Dense(n_cls, activation="softmax")])
    m.compile(optimizer=keras.optimizers.Adam(1e-3), loss=keras.losses.SparseCategoricalCrossentropy(),
              metrics=["accuracy"])
    return m


def main():
    p = argparse.ArgumentParser()
    p.add_argument("data"); p.add_argument("--holdout", type=int, default=5)
    p.add_argument("--out", required=True); p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--no-none", action="store_true"); p.add_argument("--copies", type=int, default=3)
    a = p.parse_args()
    rng = np.random.default_rng(42)
    clips, y, who, labels = load(a.data)
    use_none = not a.no_none
    train_idx = [i for i in range(len(clips)) if who[i] != a.holdout]
    test_idx = [i for i in range(len(clips)) if who[i] == a.holdout]
    train_clips = [clips[i] for i in train_idx]
    n_cls = len(labels) + (1 if use_none else 0)

    X, Y = [], []
    for c in range(a.copies):
        for i in train_idx:
            X.append(resample(clips[i]) if c == 0 else positive(clips[i], train_clips, rng)); Y.append(y[i])
        if use_none:
            for _ in range(int(len(train_idx) * 0.6)):
                X.append(negative(train_clips, rng)); Y.append(len(labels))
    X = np.stack(X); Y = np.array(Y)
    print("treino:", X.shape, "classes:", n_cls, flush=True)

    model = build_model(n_cls)
    model.fit(X, Y, epochs=a.epochs, batch_size=64, verbose=2,
              callbacks=[keras.callbacks.ReduceLROnPlateau("loss", factor=0.5, patience=4, min_lr=1e-5)])

    os.makedirs(a.out, exist_ok=True)
    model.save(os.path.join(a.out, "model.keras"))
    json.dump(list(labels) + ([NONE_LABEL] if use_none else []), open(os.path.join(a.out, "labels.json"), "w", encoding="utf-8"), ensure_ascii=False)
    if test_idx:
        Xt = np.stack([resample(clips[i]) for i in test_idx]); yt = y[test_idx]
        pr = model.predict(Xt, verbose=0)
        print("RESULT isolado: top1 %.3f top5 %.3f" % ((pr.argmax(1) == yt).mean(), np.mean([yt[k] in np.argsort(-pr[k])[:5] for k in range(len(yt))])))
        if use_none:
            neg = np.stack([negative([clips[i] for i in test_idx], rng) for _ in range(len(test_idx))])
            pn = model.predict(neg, verbose=0)
            print("RESULT negativos de teste reconhecidos como 'nenhum': %.3f" % (pn.argmax(1) == len(labels)).mean())


if __name__ == "__main__":
    main()
