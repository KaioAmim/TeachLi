"""
Extrai features de landmarks de todas as imagens do dataset Libras.
Replica exatamente client/src/lib/handFeatures.ts:
  - translada para a origem no pulso (landmark 0)
  - divide pela distancia pulso -> base do dedo medio (landmark 9)
  - vetor plano de 63 floats
"""
import json
import math
import os
import sys
from multiprocessing import Pool

import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

ROOT = "/home/claude/projeto-libras/client/public"
DATASET = f"{ROOT}/datasets/libras-alphabet"
MODEL = f"{ROOT}/models/hand_landmarker.task"

WRIST = 0
MIDDLE_MCP = 9


def landmarks_to_features(lms):
    """Igual a landmarksToFeatures() do TypeScript."""
    w = lms[WRIST]
    r = lms[MIDDLE_MCP]
    scale = math.sqrt((r.x - w.x) ** 2 + (r.y - w.y) ** 2 + (r.z - w.z) ** 2) or 1.0
    out = []
    for p in lms:
        out.append((p.x - w.x) / scale)
        out.append((p.y - w.y) / scale)
        out.append((p.z - w.z) / scale)
    return out


_landmarker = None


def get_landmarker():
    global _landmarker
    if _landmarker is None:
        opts = vision.HandLandmarkerOptions(
            base_options=mpp.BaseOptions(model_asset_path=MODEL),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=0.5,
        )
        _landmarker = vision.HandLandmarker.create_from_options(opts)
    return _landmarker


def process(job):
    label, path = job
    try:
        lm = get_landmarker()
        img = mp.Image.create_from_file(path)
        res = lm.detect(img)
        if not res.hand_landmarks:
            return {"label": label, "file": os.path.basename(path), "ok": False}
        hand = res.hand_landmarks[0]
        handed = res.handedness[0][0].category_name
        score = float(res.handedness[0][0].score)
        return {
            "label": label,
            "file": os.path.basename(path),
            "ok": True,
            "handedness": handed,
            "handedness_score": score,
            "features": landmarks_to_features(hand),
        }
    except Exception as e:  # imagem corrompida etc.
        return {"label": label, "file": os.path.basename(path), "ok": False, "error": str(e)}


def main():
    jobs = []
    for label in sorted(os.listdir(DATASET)):
        d = os.path.join(DATASET, label)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                jobs.append((label, os.path.join(d, f)))

    print(f"{len(jobs)} imagens em {len(set(j[0] for j in jobs))} classes", flush=True)

    results = []
    with Pool(processes=4) as pool:
        for i, r in enumerate(pool.imap_unordered(process, jobs, chunksize=16), 1):
            results.append(r)
            if i % 250 == 0:
                print(f"  {i}/{len(jobs)}", flush=True)

    with open("/home/claude/work/raw_features.json", "w") as fh:
        json.dump(results, fh)

    ok = [r for r in results if r["ok"]]
    print(f"\nextraidas: {len(ok)}/{len(results)}")
    from collections import Counter
    print("por classe:", dict(sorted(Counter(r['label'] for r in ok).items())))
    print("handedness:", dict(Counter(r['handedness'] for r in ok)))
    falhas = Counter(r["label"] for r in results if not r["ok"])
    print("sem mao detectada:", dict(sorted(falhas.items())))


if __name__ == "__main__":
    main()
