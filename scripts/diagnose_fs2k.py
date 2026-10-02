import json
import numpy as np
from src.config import DATA_ROOT

d = DATA_ROOT / "fs2k"
P = np.load(d / "train_photo.npy"); S = np.load(d / "train_sketch.npy")
st = np.load(d / "train_style.npy")
names = json.load(open(d / "split.json"))["train_names"]
folder = np.array([int(n.split("/")[0].replace("photo", "")) - 1 for n in names])

print("Crosstab: rows = folder (photo1..3), cols = JSON style label")
ct = np.zeros((3, 3), int)
for f, s in zip(folder, st):
    ct[f, s] += 1
print(ct)

sk = S[..., 0].astype(np.float32) / 255
def stats(mask):
    m = sk[mask]
    return f"n={mask.sum():4d} brightness={m.mean():.3f} contrast(std)={m.std(axis=(1, 2)).mean():.3f}"
print("\nSketch appearance grouped by JSON style label:")
for s in range(3): print(f"  style {s}: {stats(st == s)}")
print("Sketch appearance grouped by folder number:")
for f in range(3): print(f"  folder {f + 1}: {stats(folder == f)}")

# Pairing check: matched pairs should correlate far more than shifted/shuffled pairs
def small(a):
    return a.reshape(len(a), 16, 8, 16, 8).mean((2, 4)).reshape(len(a), -1)
def corr(a, b):
    a = a - a.mean(1, keepdims=True); b = b - b.mean(1, keepdims=True)
    return (a * b).sum(1) / (np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1) + 1e-8)

a = small(P.astype(np.float32).mean(-1) / 255)
b = small(sk)
rng = np.random.default_rng(0)
print("\nPairing check (mean |correlation| between photo and sketch layout):")
print(f"  matched pairs : {np.abs(corr(a, b)).mean():.3f}")
print(f"  shifted by 1  : {np.abs(corr(a, np.roll(b, 1, 0))).mean():.3f}")
print(f"  random shuffle: {np.abs(corr(a, b[rng.permutation(len(b))])).mean():.3f}")
