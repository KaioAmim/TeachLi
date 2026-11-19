"""Converte o dataset Libras-EQT-UECE (Hand Landmarks, .npy) em tensores de treino.

Uso: python convert_uece.py <pasta "Libras-EQT-UECE (Hand Landmarks)"> <saida.npz>

Cada clipe vira SEQUENCE_LENGTH quadros com FEATURES_PER_FRAME valores:
  [0:126]   duas mãos, normalizadas como em client/src/lib/handFeatures.ts
            (pulso na origem, escala pela distância pulso -> base do dedo médio),
            slots fixos [esquerda da imagem, direita da imagem]
  [126:130] trajetória: x,y do pulso de cada mão menos a média do clipe
O dataset guarda os slots na ordem inversa da do app (slot 1 = lado esquerdo
da imagem), por isso os slots são trocados aqui.
"""
import sys, re
from pathlib import Path
import numpy as np

SEQUENCE_LENGTH = 40
HAND = 63
FEATURES_PER_FRAME = HAND * 2 + 4


def hand_features(points):  # (21,3) -> (63,)
    c = points - points[0]
    scale = np.linalg.norm(c[9]) or 1.0
    return (c / scale).reshape(-1)


def clip_to_frames(arr):
    a = arr.reshape(-1, 2, 21, 3)[:, ::-1]  # troca de slots (ver docstring)
    present = np.abs(a).sum((2, 3)) > 0
    keep = present.any(1)  # o app só empilha quadros com mão visível
    a, present = a[keep], present[keep]
    if len(a) < 5:
        return None
    feats = np.zeros((len(a), FEATURES_PER_FRAME), np.float32)
    traj = np.zeros((len(a), 4), np.float32)
    for i in range(len(a)):
        for s in range(2):
            if present[i, s]:
                feats[i, s * HAND:(s + 1) * HAND] = hand_features(a[i, s])
                traj[i, s * 2:s * 2 + 2] = a[i, s, 0, :2]
    for s in range(2):
        m = present[:, s]
        if m.any():
            traj[m, s * 2:s * 2 + 2] -= traj[m, s * 2:s * 2 + 2].mean(0)
    feats[:, HAND * 2:] = traj
    return feats


def resample(frames, n=SEQUENCE_LENGTH):  # mesma interpolação linear de sequenceUtils.ts
    t = np.linspace(0, len(frames) - 1, n)
    lo = np.floor(t).astype(int)
    hi = np.minimum(lo + 1, len(frames) - 1)
    f = (t - lo)[:, None]
    return frames[lo] * (1 - f) + frames[hi] * f


def main(root, out):
    X, y, who, names, skipped = [], [], [], {}, 0
    for cls in sorted(Path(root).iterdir()):
        if not cls.is_dir():
            continue
        idx = int(cls.name.split("_", 1)[0])
        names[idx] = re.sub(r"^\d+_", "", cls.name)
        for inf in sorted(cls.iterdir()):
            for f in sorted(inf.glob("*.npy")):
                frames = clip_to_frames(np.load(f))
                if frames is None:
                    skipped += 1
                    continue
                X.append(resample(frames)); y.append(idx)
                who.append(int(inf.name.split()[-1]))
    order = sorted(names)
    remap = {old: new for new, old in enumerate(order)}
    np.savez_compressed(out, X=np.asarray(X, np.float32), y=np.array([remap[v] for v in y]),
                        informant=np.array(who), labels=np.array([names[i] for i in order]))
    print(f"{len(X)} clipes, {len(order)} sinais, {skipped} ignorados -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
