import json
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pytorch_msssim import ssim
from src.config import CKPT_ROOT
from src.data.fs2k import FS2KDataset
from src.models.cgan import UNetGenerator
from src.training.common import get_device
from src.training.train_gan import to01

dev = get_device()
ck = torch.load(CKPT_ROOT / "task4" / "generator.pt", map_location=dev)
c = ck["cfg"]
G = UNetGenerator(c["base"], c["emb_dim"], c["dropout"]).to(dev)
G.load_state_dict(ck["state_dict"]); G.eval()
print("config:", c)
out = CKPT_ROOT / "task4" / "eval"; out.mkdir(parents=True, exist_ok=True)

ds = FS2KDataset("test")
styles = ds.style.numpy()
Tt = ds.sketch.float() / 255.0                      # (N,1,H,W) in [0,1]


@torch.no_grad()
def gen_all(force_style=None):
    res = []
    for i in range(0, len(ds), 64):
        x = (ds.photo[i:i + 64].float() / 127.5 - 1).to(dev)
        s = ds.style[i:i + 64].to(dev) if force_style is None else torch.full((len(x),), force_style, device=dev)
        res.append(to01(G(x, s)).cpu())
    return torch.cat(res)


A = gen_all()
l1 = (A - Tt).abs().mean((1, 2, 3))
psnr = 10 * torch.log10(1.0 / ((A - Tt) ** 2).mean((1, 2, 3)).clamp_min(1e-8))
ss = ssim(A, Tt, data_range=1.0, size_average=False)

print(f"\n{'group':10s} {'n':>5s} {'L1':>8s} {'PSNR':>8s} {'SSIM':>8s}")
groups = [("overall", np.ones(len(styles), bool))] + [(f"style {k + 1}", styles == k) for k in range(3)]
for name, mask in groups:
    m = torch.from_numpy(mask)
    print(f"{name:10s} {int(mask.sum()):5d} {l1[m].mean().item():8.4f} {psnr[m].mean().item():8.2f} {ss[m].mean().item():8.3f}")

# ---- does the style condition really matter? ----
As = [gen_all(k) for k in range(3)]
l1_k = torch.stack([(a - Tt).abs().mean((1, 2, 3)) for a in As], 1)
match = float((l1_k.argmin(1).numpy() == styles).mean())
sens = float(np.mean([(As[i] - As[j]).abs().mean().item() for i in range(3) for j in range(i + 1, 3)]))
print(f"\nstyle sensitivity (mean |diff| between styles, same photo): {sens:.4f}")
print(f"true-style output is closest to the target sketch in {match * 100:.1f}% of images (chance = 33.3%)")
json.dump({"l1": l1.mean().item(), "psnr": psnr.mean().item(), "ssim": ss.mean().item(),
           "style_sensitivity": sens, "style_match_rate": match,
           "per_style": {f"style {k + 1}": {"n": int((styles == k).sum()),
                         "l1": l1[torch.from_numpy(styles == k)].mean().item(),
                         "psnr": psnr[torch.from_numpy(styles == k)].mean().item(),
                         "ssim": ss[torch.from_numpy(styles == k)].mean().item()} for k in range(3)}},
          open(out / "test_summary.json", "w"), indent=2)


# ---- figures ----
def fig_rows(ids, path, title):
    n = len(ids)
    fig, ax = plt.subplots(3, n, figsize=(2.3 * n, 7.2), squeeze=False)
    for j, i in enumerate(ids):
        ax[0, j].imshow(ds.photo[i].permute(1, 2, 0).numpy())
        ax[1, j].imshow(Tt[i, 0].numpy(), cmap="gray", vmin=0, vmax=1)
        ax[2, j].imshow(A[i, 0].numpy(), cmap="gray", vmin=0, vmax=1)
        ax[0, j].set_title(f"style {int(styles[i]) + 1}\nSSIM {ss[i].item():.2f}", fontsize=8)
        for r in range(3):
            ax[r, j].axis("off")
    for r, t in enumerate(["photo", "real sketch", "generated"]):
        ax[r, 0].text(-0.08, 0.5, t, transform=ax[r, 0].transAxes, rotation=90, va="center", ha="right")
    fig.suptitle(title); plt.tight_layout(); plt.savefig(path, dpi=110); plt.close(fig)


rng = np.random.default_rng(0)
pick = [int(i) for i in rng.choice(len(ds), 12, replace=False)]
fig_rows(pick[:6], out / "examples_1.png", "Task 4 test examples (1/2)")
fig_rows(pick[6:], out / "examples_2.png", "Task 4 test examples (2/2)")
worst = [int(i) for i in torch.argsort(ss)[:4]]
fig_rows(worst, out / "failure_cases.png", "Task 4 failure cases: lowest SSIM on the test set")
print("failure cases (index, style, SSIM):", [(i, int(styles[i]) + 1, round(ss[i].item(), 3)) for i in worst])

ids = pick[:6]
fig, ax = plt.subplots(5, 6, figsize=(14, 12))
for j, i in enumerate(ids):
    ax[0, j].imshow(ds.photo[i].permute(1, 2, 0).numpy())
    ax[1, j].imshow(Tt[i, 0].numpy(), cmap="gray", vmin=0, vmax=1)
    for k in range(3):
        ax[2 + k, j].imshow(As[k][i, 0].numpy(), cmap="gray", vmin=0, vmax=1)
    for r in range(5):
        ax[r, j].axis("off")
for r, t in enumerate(["photo", "real sketch", "Style 1", "Style 2", "Style 3"]):
    ax[r, 0].text(-0.08, 0.5, t, transform=ax[r, 0].transAxes, rotation=90, va="center", ha="right")
fig.suptitle("Same photo, three style conditions"); plt.tight_layout()
plt.savefig(out / "style_comparison.png", dpi=110); plt.close(fig)
print("saved to", out)
