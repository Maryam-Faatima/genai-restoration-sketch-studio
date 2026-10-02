import json, collections
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from src.config import MANIFEST_DIR
from src.data.corruptions import CLASS_NAMES, sample_params
from src.data.pets import load_pets, PetRestorationDataset

imgs, tr_idx = load_pets("train")
_, va_idx = load_pets("val")
print("train", len(tr_idx), "val", len(va_idx), "overlap:", len(set(tr_idx) & set(va_idx)))

# 1) Runtime class balance + parameter ranges
ds = PetRestorationDataset(imgs, tr_idx)
counts = collections.Counter(ds[i % len(ds)][2] for i in range(2000))
print("class counts (2000 draws):", {CLASS_NAMES[k]: v for k, v in sorted(counts.items())})
rng = np.random.default_rng(0)
cov = [sample_params(rng, "occlusion")["actual_frac"] for _ in range(2000)]
print(f"occlusion coverage: min {min(cov):.3f} max {max(cov):.3f} (target 0.10-0.35)")

# 2) Visual grid: one row per condition
fig, ax = plt.subplots(4, 6, figsize=(14, 9.5))
for r in range(4):
    d = PetRestorationDataset(imgs, tr_idx, force_type=r)
    for c in range(6):
        x, _, _ = d[c]
        ax[r, c].imshow(x.permute(1, 2, 0).numpy()); ax[r, c].axis("off")
    ax[r, 0].set_title(CLASS_NAMES[r], loc="left")
plt.tight_layout(); plt.savefig("check_grid.png", dpi=90)

# 3) Manifest checks
val_m = json.load(open(MANIFEST_DIR / "val_manifest.json"))
test_m = json.load(open(MANIFEST_DIR / "test_manifest.json"))
print("val:", collections.Counter(e["type"] for e in val_m))
print("test:", collections.Counter((e["type"], e["severity"]) for e in test_m))
timgs, _ = load_pets("test")
dt = PetRestorationDataset(timgs, None, manifest=test_m)
a, b = dt[17][0], dt[17][0]
print("deterministic (same entry twice identical):", torch.equal(a, b))
print("test entry 1 example:", test_m[1])
