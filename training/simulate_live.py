"""Simula o reconhecimento ao vivo sobre fala contínua e mede acertos e falsos sinais.

Cada fluxo concatena clipes de um informante que não entrou no treino, na ordem da
fala, com ou sem pausas (mão fora do quadro) entre os sinais. O laço reproduz o do app:
quadro a quadro, janela deslizante, estabilidade, intervalo mínimo e limpeza do buffer.

Algoritmos:
  baseline  — o que o app fazia: janela fixa de 60 quadros, buffer mantido nas pausas.
  novo      — janelas de vários tamanhos, buffer limpo nas pausas, classe "nenhum sinal".

Uso: python simulate_live.py uece_raw.npz --model dir --algo baseline|novo [--gaps] [--holdout 5]
"""
import argparse, json, os
import numpy as np
import tensorflow as tf
from tensorflow import keras

SEQ = 40
COOLDOWN = 36          # ~1,2 s a 30 fps
GAP = 15               # quadros sem mão entre sinais, nos fluxos com pausa


def resample(frames, n=SEQ):
    frames = np.asarray(frames)
    t = np.linspace(0, len(frames) - 1, n)
    lo = np.floor(t).astype(int)
    hi = np.minimum(lo + 1, len(frames) - 1)
    f = (t - lo)[:, None]
    return (frames[lo] * (1 - f) + frames[hi] * f).astype(np.float32)


def top2(p):
    order = np.argsort(-p)
    return order[0], p[order[0]], p[order[1]]


class Baseline:
    """Janela fixa de 60 quadros; thresholds do modelo base (0,85 / 0,30)."""
    def __init__(self, model, labels, conf=0.85, margin=0.30):
        self.model, self.labels, self.conf, self.margin = model, labels, conf, margin
        self.buf, self.counter, self.stable, self.last_commit = [], 0, ["", 0], -10**9

    def absent(self):
        self.stable = ["", 0]  # o app só zera a estabilidade; o buffer fica

    def push(self, frame, t):
        self.buf.append(frame)
        self.buf = self.buf[-60:]
        self.counter += 1
        if self.counter % 5 or len(self.buf) < 30:
            return None
        p = self.model(resample(self.buf)[None], training=False).numpy()[0]
        i, top, second = top2(p)
        label = self.labels[i]
        self.stable = [label, self.stable[1] + 1 if label == self.stable[0] else 1]
        if top > self.conf and top - second > self.margin and self.stable[1] >= 3 and t - self.last_commit > COOLDOWN:
            self.last_commit, self.stable, self.buf = t, [label, 0], []
            return label
        return None


class Novo:
    """Várias janelas, buffer limpo nas pausas e rejeição pela classe 'nenhum sinal'."""
    WINDOWS = (20, 30, 45, 60, 90, 120)

    def __init__(self, model, labels, conf=0.8, margin=0.25, stable_calls=2, every=4):
        self.model, self.labels, self.conf, self.margin = model, labels, conf, margin
        self.stable_calls, self.every = stable_calls, every
        self.none = labels.index("__nenhum__") if "__nenhum__" in labels else -1
        self.buf, self.counter, self.stable, self.last_commit, self.gap = [], 0, ["", 0], -10**9, 0

    def absent(self):
        self.gap += 1
        self.stable = ["", 0]
        if self.gap >= 6:
            self.buf = []  # pausa de verdade: o próximo sinal começa do zero

    def push(self, frame, t):
        self.gap = 0
        self.buf.append(frame)
        self.buf = self.buf[-max(self.WINDOWS):]
        self.counter += 1
        if self.counter % self.every or len(self.buf) < min(self.WINDOWS):
            return None
        sizes = [w for w in self.WINDOWS if w <= len(self.buf)]
        if len(self.buf) not in sizes:
            sizes.append(len(self.buf))
        batch = np.stack([resample(self.buf[-w:]) for w in sizes])
        probs = self.model(batch, training=False).numpy()
        best = None
        for p in probs:
            if self.none >= 0:
                p = p.copy()
            i, top, second = top2(p)
            if i == self.none:
                continue
            if best is None or top > best[1]:
                best = (i, top, second)
        if best is None:
            self.stable = ["", 0]
            return None
        i, top, second = best
        label = self.labels[i]
        ok = top > self.conf and top - second > self.margin
        if not ok:
            self.stable = ["", 0]
            return None
        self.stable = [label, self.stable[1] + 1 if label == self.stable[0] else 1]
        if self.stable[1] >= self.stable_calls and t - self.last_commit > COOLDOWN:
            self.last_commit, self.stable, self.buf = t, [label, 0], []
            return label
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("data"); p.add_argument("--model", required=True)
    p.add_argument("--algo", choices=["baseline", "novo"], required=True)
    p.add_argument("--holdout", type=int, default=5); p.add_argument("--gaps", action="store_true")
    p.add_argument("--streams", type=int, default=30); p.add_argument("--signs", type=int, default=8)
    p.add_argument("--conf", type=float, default=None); p.add_argument("--margin", type=float, default=None)
    a = p.parse_args()

    raw = np.load(a.data)
    d = {k: raw[k] for k in raw.files}  # um acesso por chave: cada raw[...] descomprime o arquivo inteiro
    ends = np.cumsum(d["lengths"]); starts = ends - d["lengths"]
    idx = [i for i in range(len(starts)) if d["informant"][i] == a.holdout]
    model = keras.models.load_model(os.path.join(a.model, "model.keras"))
    labels = json.load(open(os.path.join(a.model, "labels.json"), encoding="utf-8"))
    names = list(d["labels"])
    kwargs = {k: v for k, v in (("conf", a.conf), ("margin", a.margin)) if v is not None}
    rng = np.random.default_rng(7)

    signs = hits = emitted = correct = spurious_wrong = 0
    for _ in range(a.streams):
        chosen = list(rng.choice(idx, a.signs, replace=False))
        algo = (Baseline if a.algo == "baseline" else Novo)(model, labels, **kwargs)
        spans, t, got = [], 0, {}
        emissions = []
        for ci in chosen:
            clip = d["frames"][starts[ci]:ends[ci]]
            spans.append((t, t + len(clip), names[d["y"][ci]]))
            for fr in clip:
                out = algo.push(fr, t)
                if out:
                    emissions.append((t, out))
                t += 1
            if a.gaps:
                for _g in range(GAP):
                    algo.absent(); t += 1
        # atribuição: a emissão vale para o clipe em curso; tolera atraso de até 20 quadros no seguinte
        matched = set()
        for et, lab in emissions:
            emitted += 1
            ok = False
            tail = GAP if a.gaps else 0
            cur = next((k for k, (s, e, _n) in enumerate(spans) if s <= et < e + tail), len(spans) - 1)
            for k in (cur, cur - 1):
                if k >= 0 and spans[k][2] == lab and k not in matched and et - spans[k][0] >= 0 and (k == cur or et - spans[k][1] < 20):
                    matched.add(k); ok = True; break
            correct += ok
        signs += len(spans); hits += len(matched)
    print(f"RESULT {a.algo} gaps={a.gaps} model={os.path.basename(a.model)} sinais={signs} "
          f"reconhecidos={hits/signs:.3f} precisao={correct/max(emitted,1):.3f} emissoes/sinal={emitted/signs:.2f}")


if __name__ == "__main__":
    main()
