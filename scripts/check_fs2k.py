import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from src.config import DATA_ROOT

d = DATA_ROOT / "fs2k"
P = np.load(d / "train_photo.npy"); S = np.load(d / "train_sketch.npy")
st = np.load(d / "train_style.npy")

fig, ax = plt.subplots(3, 8, figsize=(16, 6.4))
for s in range(3):
    ids = np.where(st == s)[0][:4]
    for k, i in enumerate(ids):
        ax[s, 2 * k].imshow(P[i]);     ax[s, 2 * k].axis("off")
        ax[s, 2 * k + 1].imshow(S[i]); ax[s, 2 * k + 1].axis("off")
    ax[s, 0].set_title(f"style {s}: photo | sketch pairs", loc="left")
plt.tight_layout(); plt.savefig("check_fs2k.png", dpi=80)
print("saved check_fs2k.png")