"""
Segunda passada: reprocessa as imagens onde nenhuma mao foi detectada,
com limiar mais baixo e tentando variacoes da imagem (espelhada, com
aumento de contraste). Isso recupera principalmente as maos fechadas
(M, N, O, S), que o detector rejeita com o limiar padrao.
"""
import json
import math
import os
from collections import Counter
from multiprocessing import Pool

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

ROOT = "/home/claude/projeto-libras/client/public"
DATASET = f"{ROOT}/datasets/libras-alphabet"
MODEL = f"{ROOT}/models/hand_landmarker.task"

WRIST, MIDDLE_MCP = 0, 9


def landmarks_to_features(lms):
    w, r = lms[WRIST], lms[MIDDLE_MCP]
    scale = math.sqrt((r.x - w.x) ** 2 + (r.y - w.y) ** 2 + (r.z - w.z) ** 2) or 1.0
    out = []
    for p in lms:
        out += [(p.x - w.x) / scale, (p.y - w.y) / scale, (p.z - w.z) / scale]
    return out


_lm = None


def get_lm():
    global _lm
    if _lm is None:
        _lm = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=mpp.BaseOptions(model_asset_path=MODEL),
                running_mode=vision.RunningMode.IMAGE,
                num_hands=1,
                min_hand_detection_confidence=0.15,  # bem mais permissivo
                min_hand_presence_confidence=0.15,
            )
        )
    return _lm


def variants(bgr):
    """Variacoes da imagem para dar mais chances ao detector."""
    yield "orig", bgr
    yield "flip", cv2.flip(bgr, 1)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(l)
    eq = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    yield "clahe", eq
    yield "clahe_flip", cv2.flip(eq, 1)
    big = cv2.resize(bgr, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
    yield "upscale", big


def process(job):
    label, path = job
    bgr = cv2.imread(path)
    if bgr is None:
        return {"label": label, "file": os.path.basename(path), "ok": False}
    lm = get_lm()
    for name, var in variants(bgr):
        rgb = cv2.cvtColor(var, cv2.COLOR_BGR2RGB)
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        res = lm.detect(img)
        if res.hand_landmarks:
            hand = res.hand_landmarks[0]
            handed = res.handedness[0][0].category_name
            # se veio de imagem espelhada, a lateralidade reportada esta invertida
            if "flip" in name:
                handed = "Left" if handed == "Right" else "Right"
            return {
                "label": label,
                "file": os.path.basename(path),
                "ok": True,
                "handedness": handed,
                "handedness_score": float(res.handedness[0][0].score),
                "features": landmarks_to_features(hand),
                "via": name,
            }
    return {"label": label, "file": os.path.basename(path), "ok": False}


def main():
    prev = json.load(open("/home/claude/work/raw_features.json"))
    failed = [(r["label"], os.path.join(DATASET, r["label"], r["file"]))
              for r in prev if not r["ok"]]
    print(f"reprocessando {len(failed)} imagens que falharam", flush=True)

    recovered = []
    with Pool(processes=4) as pool:
        for i, r in enumerate(pool.imap_unordered(process, failed, chunksize=8), 1):
            recovered.append(r)
            if i % 100 == 0:
                print(f"  {i}/{len(failed)}", flush=True)

    ok = [r for r in recovered if r["ok"]]
    print(f"\nrecuperadas: {len(ok)}/{len(failed)}")
    print("por classe:", dict(sorted(Counter(r['label'] for r in ok).items())))
    print("via:", dict(Counter(r['via'] for r in ok)))

    merged = [r for r in prev if r["ok"]] + ok
    json.dump(merged, open("/home/claude/work/features.json", "w"))
    print("\nTOTAL final por classe:",
          dict(sorted(Counter(r['label'] for r in merged).items())))
    print("total:", len(merged))


if __name__ == "__main__":
    main()
