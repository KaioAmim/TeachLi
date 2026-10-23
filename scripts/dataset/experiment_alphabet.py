"""Train/evaluate a candidate without replacing the application's model.

Python 3.12; numpy==2.2.6, scikit-learn==1.7.2.
Input ZIP: https://www.kaggle.com/datasets/heitorccf/librasign (v1, GPL 3).
Outputs include a TF.js candidate, provenance, split manifest and evaluation.
No webcam, download, application write, or model activation happens here.
"""
import argparse
import copy
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
from sklearn.neural_network import MLPClassifier

ROOT = Path(__file__).resolve().parents[2]
ADDITIONS = list("FGPQTY")
ZIP_SHA256 = "f1ca1f53d47bbba99b64c6f5815f740a200b354a6ddf7f939f6b78655313b8dd"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize(raw):
    points = np.asarray(raw, dtype=np.float32).reshape(-1, 21, 3)
    centered = points - points[:, :1]
    scale = np.linalg.norm(centered[:, 9], axis=1)
    if not np.isfinite(points).all() or np.any(scale < 1e-6):
        raise ValueError("Invalid hand coordinates or degenerate hand scale")
    return (centered / scale[:, None, None]).reshape(-1, 63)


def load_data(archive, legacy_path, labels):
    rows, manifest = [], []
    legacy = json.loads(legacy_path.read_text())["samples"]
    with zipfile.ZipFile(archive) as z:
        for source in ("legacy", "librasign"):
            for label in labels:
                if source == "legacy" and label not in legacy:
                    continue
                if source == "legacy":
                    features = np.asarray(legacy[label], dtype=np.float32)
                else:
                    raw = list(csv.reader(io.StringIO(z.read(f"landmarks/{label}.csv").decode())))
                    features = normalize(raw)
                if features.shape[1:] != (63,) or not np.isfinite(features).all():
                    raise ValueError("Invalid features")
                # CSV order is retained; this is NOT a split by signer/session.
                # A small gap excludes training rows adjacent to holdout blocks.
                blocks = np.minimum(np.arange(len(features)) * 10 // len(features), 9)
                splits = np.where(np.isin(blocks, [7, 8]), "test",
                                  np.where(blocks == 3, "validation", "train"))
                for idx in np.flatnonzero(splits != "train"):
                    lo, hi = max(0, idx - 5), min(len(features), idx + 6)
                    for near in range(lo, hi):
                        if splits[near] == "train":
                            splits[near] = "gap"
                for i, (feat, split) in enumerate(zip(features, splits)):
                    identity = f"{source}/{label}/{i}"
                    manifest.append({"id": identity, "split": str(split)})
                    if split != "gap":
                        rows.append((feat, labels.index(label), source, split, identity))
    # Do not allow exact duplicate representations to cross split boundaries.
    owners = {}
    for feat, _, _, split, identity in rows:
        key = tuple(np.round(feat, 4))
        if key in owners and owners[key][0] != split:
            raise ValueError(f"Duplicate crosses splits: {identity}, {owners[key]}")
        owners[key] = (split, identity)
    return rows, manifest


def pack(rows, split):
    subset = [r for r in rows if r[3] == split]
    return (np.asarray([r[0] for r in subset]), np.asarray([r[1] for r in subset]),
            np.asarray([r[2] for r in subset]))


def mirror(x):
    out = x.copy()
    out[:, 0::3] *= -1
    return out


def augment(x, rng, rotation_3d=False):
    p = x.reshape(-1, 21, 3).copy()
    if rotation_3d:
        # Small viewpoint variations, matching the original model's training.
        for axis in range(3):
            angles = rng.normal(0, np.deg2rad(7), len(p))
            c, s = np.cos(angles)[:, None], np.sin(angles)[:, None]
            i, j = (axis + 1) % 3, (axis + 2) % 3
            a, b = p[:, :, i].copy(), p[:, :, j].copy()
            p[:, :, i], p[:, :, j] = a * c - b * s, a * s + b * c
    angles = rng.uniform(-np.pi / 36, np.pi / 36, len(p))
    c, s = np.cos(angles)[:, None], np.sin(angles)[:, None]
    a, b = p[:, :, 0].copy(), p[:, :, 1].copy()
    p[:, :, 0], p[:, :, 1] = a * c - b * s, a * s + b * c
    p *= rng.uniform(.95, 1.05, (len(p), 1, 1))
    p += rng.normal(0, .01, p.shape)
    p[:, 0] = 0
    return p.reshape(-1, 63)


def balanced_weights(y, sources, labels=None, legacy_weight=1., focus_weight=1.):
    # Each letter contributes equally; within a letter, equal source weight.
    weights = np.empty(len(y), dtype=np.float32)
    for label in np.unique(y):
        source_names = np.unique(sources[y == label])
        for source in source_names:
            mask = (y == label) & (sources == source)
            weights[mask] = 1 / (len(source_names) * mask.sum())
    weights[sources == "legacy"] *= legacy_weight
    if labels is not None:
        for letter in ("O", "M", "C"):
            weights[y == labels.index(letter)] *= focus_weight
    return weights / weights.mean()


def initialize_from_base(model, x, y, labels, old_labels, base_dir):
    """Initialize estimator metadata, then transfer the verified 15-class weights.

    The existing logits retain their label mapping. New logits start small.
    Adam state is reset after transfer; its private class is version-pinned.
    """
    from sklearn.neural_network._stochastic_optimizers import AdamOptimizer
    model.partial_fit(x[:256], y[:256], classes=np.arange(len(labels)))
    kernels, biases = load_base(base_dir)
    for index in range(len(kernels) - 1):
        model.coefs_[index] = kernels[index].copy()
        model.intercepts_[index] = biases[index].copy()
    model.coefs_[-1] *= .01
    model.intercepts_[-1][:] = -4
    for old_index, label in enumerate(old_labels):
        new_index = labels.index(label)
        model.coefs_[-1][:, new_index] = kernels[-1][:, old_index]
        model.intercepts_[-1][new_index] = biases[-1][old_index]
    model._optimizer = AdamOptimizer(model.coefs_ + model.intercepts_, learning_rate_init=model.learning_rate_init)


def forward(x, kernels, biases):
    out = x
    for i, (kernel, bias) in enumerate(zip(kernels, biases)):
        out = out @ kernel + bias
        if i < len(kernels) - 1:
            out = np.maximum(out, 0)
    out = np.exp(out - out.max(axis=1, keepdims=True))
    return out / out.sum(axis=1, keepdims=True)


def load_base(path):
    config = json.loads((path / "model.json").read_text())
    blob = (path / "weights.bin").read_bytes()
    offset, weights = 0, []
    for spec in config["weightsManifest"][0]["weights"]:
        count = int(np.prod(spec["shape"]))
        weights.append(np.frombuffer(blob, dtype="<f4", count=count, offset=offset).reshape(spec["shape"]))
        offset += count * 4
    assert offset == len(blob)
    return weights[::2], weights[1::2]


def metrics(probs, y, labels):
    pred = probs.argmax(axis=1)
    top = np.sort(probs, axis=1)[:, -2:]
    accepted = (top[:, 1] > .75) & (top[:, 1] - top[:, 0] > .15)
    correct = pred == y
    cm = np.zeros((len(labels), len(labels)), dtype=int)
    np.add.at(cm, (y, pred), 1)
    return {
        "n": len(y), "accuracy": float(correct.mean()),
        "coverage": float(accepted.mean()),
        "accepted_precision": float(correct[accepted].mean()) if accepted.any() else None,
        "correct_accepted_rate": float((correct & accepted).mean()),
        "per_class": {label: {
            "n": int((y == i).sum()),
            "recall": float(correct[y == i].mean()),
            "correct_accepted_rate": float((correct & accepted)[y == i].mean()),
            "confusions": {labels[j]: int(cm[i, j]) for j in range(len(labels)) if j != i and cm[i, j]},
        } for i, label in enumerate(labels) if (y == i).any()},
        "confusion_matrix": cm.tolist(),
    }


def export(model, labels, directory):
    directory.mkdir(parents=True, exist_ok=True)
    layers, specs, blobs = [], [], []
    for i, (kernel, bias) in enumerate(zip(model.coefs_, model.intercepts_)):
        name = f"dense_{i + 1}"
        config = {"name": name, "trainable": True, "dtype": "float32",
                  "units": int(bias.size), "activation": "softmax" if i == len(model.coefs_) - 1 else "relu",
                  "use_bias": True}
        if i == 0:
            config["batch_input_shape"] = [None, 63]
        layers.append({"class_name": "Dense", "config": config})
        for suffix, array in (("kernel", kernel), ("bias", bias)):
            specs.append({"name": f"{name}/{suffix}", "shape": list(array.shape), "dtype": "float32"})
            blobs.append(array.astype("<f4").tobytes())
    config = {"format": "layers-model", "generatedBy": "scikit-learn 1.7.2 MLPClassifier",
              "convertedBy": "TeachLi experiment_alphabet.py",
              "modelTopology": {"keras_version": "2.15.0", "backend": "tensorflow", "model_config": {
                  "class_name": "Sequential", "config": {"name": "libras_candidate", "layers": layers}}},
              "weightsManifest": [{"paths": ["weights.bin"], "weights": specs}]}
    (directory / "model.json").write_text(json.dumps(config))
    (directory / "weights.bin").write_bytes(b"".join(blobs))
    (directory / "labels.json").write_text(json.dumps(labels))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--base-model", type=Path, default=ROOT / "client/public/models/gesture-classifier")
    parser.add_argument("--initialize-from-base", action="store_true")
    parser.add_argument("--learning-rate", type=float, default=.001)
    parser.add_argument("--legacy-weight", type=float, default=1.)
    parser.add_argument("--focus-weight", type=float, default=1.)
    parser.add_argument("--rotation-3d", action="store_true")
    parser.add_argument("--additions", default="".join(ADDITIONS), help="Extra pose labels; motion itself is not learned from isolated frames")
    args = parser.parse_args()
    additions = sorted(set(args.additions.upper()))
    if not additions or any(letter not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" for letter in additions):
        parser.error("Additions must be letters A-Z present in LibraSign")
    if (ROOT / "client").resolve() in args.output.resolve().parents or args.output.resolve() == (ROOT / "client").resolve():
        parser.error("Use an experiment directory outside client; deployment is a separate step.")
    if digest(args.zip) != ZIP_SHA256:
        raise ValueError("Unexpected dataset ZIP checksum; review this version before training")
    args.output.mkdir(parents=True, exist_ok=True)
    base_dir = args.base_model
    legacy_path = ROOT / "client/public/datasets/libras-landmarks.json"
    old_labels = json.loads((base_dir / "labels.json").read_text())
    labels = sorted(set(old_labels + additions))
    rows, manifest = load_data(args.zip, legacy_path, labels)
    (args.output / "splits.json").write_text(json.dumps(manifest))
    x, y, src = pack(rows, "train")
    vx, vy, vs = pack(rows, "validation")
    x, y, src = np.concatenate([x, mirror(x)]), np.tile(y, 2), np.tile(src, 2)
    vx, vy, vs = np.concatenate([vx, mirror(vx)]), np.tile(vy, 2), np.tile(vs, 2)
    weights = balanced_weights(y, src, labels, args.legacy_weight, args.focus_weight)
    val_weights = balanced_weights(vy, vs)
    rng = np.random.default_rng(42)
    model = MLPClassifier(hidden_layer_sizes=(256, 128, 64), batch_size=256,
                          learning_rate_init=args.learning_rate, alpha=.01, random_state=42)
    if args.initialize_from_base:
        initialize_from_base(model, x, y, labels, old_labels, base_dir)
    best, best_score, stale, best_epoch = None, -1, 0, 0
    history = []
    print(f"Classes {labels}; train {len(y)}, validation {len(vy)} (including mirrors)", flush=True)
    for epoch in range(args.epochs):
        model.partial_fit(augment(x, rng, args.rotation_3d), y, classes=np.arange(len(labels)), sample_weight=weights)
        score = float(np.average(model.predict(vx) == vy, weights=val_weights))
        history.append({"epoch": epoch + 1, "balanced_validation_accuracy": score, "loss": float(model.loss_)})
        if score > best_score + 1e-5:
            best, best_score, stale, best_epoch = copy.deepcopy(model), score, 0, epoch + 1
        else:
            stale += 1
        if epoch % 5 == 0:
            print(f"Epoch {epoch + 1}: validation {score:.4f}; best {best_score:.4f}", flush=True)
        if stale >= 20:
            break
    model = best
    tx, ty, ts = pack(rows, "test")
    tx, ty, ts = np.concatenate([tx, mirror(tx)]), np.tile(ty, 2), np.tile(ts, 2)
    probs = model.predict_proba(tx)
    reports = {source: metrics(probs[ts == source], ty[ts == source], labels)
               for source in ("legacy", "librasign")}
    new_mask = np.isin(ty, [labels.index(label) for label in additions])
    reports["additions"] = metrics(probs[new_mask], ty[new_mask], labels)
    base_k, base_b = load_base(base_dir)
    legacy_mask = ts == "legacy"
    old_y = np.array([old_labels.index(labels[i]) for i in ty[legacy_mask]])
    reports["baseline_legacy"] = metrics(forward(tx[legacy_mask], base_k, base_b), old_y, old_labels)
    old, new, added = reports["baseline_legacy"], reports["legacy"], reports["additions"]
    gates = {
        "legacy_overall_drop_at_most_3pp": new["accuracy"] >= old["accuracy"] - .03,
        "legacy_per_letter_drop_at_most_10pp": all(new["per_class"][l]["recall"] >= old["per_class"][l]["recall"] - .10 for l in old_labels),
        "new_letters_overall_at_least_90pct": added["accuracy"] >= .90,
        "new_letters_each_at_least_80pct": all(r["recall"] >= .80 for r in added["per_class"].values()),
        "accepted_precision_at_least_95pct_each_source": all((r["accepted_precision"] or 0) >= .95 for r in (new, reports["librasign"])),
        "legacy_correct_accepted_drop_at_most_3pp": new["correct_accepted_rate"] >= old["correct_accepted_rate"] - .03,
    }
    report = {"seed": 42, "labels": labels, "additions": additions, "best_epoch": best_epoch,
              "pose_only_motion_labels": [letter for letter in "HJKXZ" if letter in labels],
              "configuration": {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()},
              "history": history, "metrics": reports, "gates": gates, "eligible_for_camera_trial": all(gates.values()),
              "provenance": {"dataset_url": "https://www.kaggle.com/datasets/heitorccf/librasign",
                             "dataset_license": "GPL 3 (Kaggle metadata)", "zip_sha256": digest(args.zip),
                             "legacy_sha256": digest(legacy_path), "baseline_weights_sha256": digest(base_dir / "weights.bin")},
              "limitations": ["No signer/session identifiers. Block holdout is not signer-independent evaluation.",
                              "Legacy baseline may already have seen legacy holdout; this is a regression check.",
                              "This development split has been inspected previously; it is not a fresh independent test.",
                              "When initializing from the baseline, its pretraining also carries prior exposure to legacy data.",
                              "Isolated poses only: no temporal motion recognition, Ç, negatives, live camera or linguistic validation.",
                              "Mirrors are paired with originals in the same split; they are not independent samples."]}
    (args.output / "report.json").write_text(json.dumps(report, indent=2))
    export(model, labels, args.output / "model")
    (args.output / "probe.json").write_text(json.dumps({"inputs": tx[::100].tolist(), "expected": probs[::100].tolist()}))
    normalization_probe = []
    with zipfile.ZipFile(args.zip) as archive:
        for label in labels:
            raw_rows = list(csv.reader(io.StringIO(archive.read(f"landmarks/{label}.csv").decode())))
            raw = [[float(v) for v in raw_rows[i]] for i in [0, 333, 999]]
            normalization_probe.extend({"raw": row, "expected": feat.tolist()} for row, feat in zip(raw, normalize(raw)))
    (args.output / "normalization-probe.json").write_text(json.dumps(normalization_probe))
    for name, result in reports.items():
        print(name, {k: result[k] for k in ("n", "accuracy", "accepted_precision", "coverage")}, flush=True)
    print("Gates", gates, flush=True)
    print("Candidate saved; application was not changed.", flush=True)


if __name__ == "__main__":
    main()
