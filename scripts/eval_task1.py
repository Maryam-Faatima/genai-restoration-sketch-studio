import json
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from src.config import CKPT_ROOT
from src.models.autoencoder import build_ae
from src.training.common import get_device, make_manifest_loader, evaluate, summarize

dev = get_device()
ck = torch.load(CKPT_ROOT / "task1" / "best.pt", map_location=dev)
c = ck["cfg"]
model = build_ae(c).to(dev)
model.load_state_dict(ck["state_dict"]); model.eval()
print("config:", c)

out_dir = CKPT_ROOT / "task1" / "eval"; out_dir.mkdir(parents=True, exist_ok=True)
loader, manifest = make_manifest_loader("test", 128, 2)
m = evaluate(model, loader, dev)
summ = summarize(manifest, m)
json.dump(summ, open(out_dir / "test_summary.json", "w"), indent=2)
np.savez(out_dir / "per_sample.npz", **m)

# ---- table ----
print(f"\n{'group':26s} {'n':>6s} {'in_PSNR':>8s} {'out_PSNR':>9s} {'in_SSIM':>8s} {'out_SSIM':>9s} {'L1':>7s}")
order = ["overall", "clean"] + [f"{t}{s}" for t in ["salt_pepper", "blur", "occlusion"]
                                for s in ["", "/low", "/medium", "/high"]]
for k in order:
    if k in summ:
        r = summ[k]
        print(f"{k:26s} {r['n']:6d} {r['in_psnr']:8.2f} {r['psnr']:9.2f} "
              f"{r['in_ssim']:8.3f} {r['ssim']:9.3f} {r['l1']:7.4f}")

# ---- figures ----
ds = loader.dataset
types = np.array([e["type"] for e in manifest])
sev = np.array([e["severity"] for e in manifest])


@torch.no_grad()
def grid(ids, path, title):
    xs = torch.stack([ds[i][0] for i in ids]).to(dev)
    ys = torch.stack([ds[i][1] for i in ids]).to(dev)
    out = model(xs).clamp(0, 1)
    err = (out - ys).abs().mean(1).cpu()
    rows = [("clean target", ys.cpu()), ("corrupted input", xs.cpu()),
            ("reconstruction", out.cpu()), ("abs. error", err)]
    fig, ax = plt.subplots(4, len(ids), figsize=(2.4 * len(ids), 10.2))
    for r, (name, t) in enumerate(rows):
        for j in range(len(ids)):
            if r < 3:
                ax[r, j].imshow(t[j].permute(1, 2, 0).numpy())
            else:
                ax[r, j].imshow(t[j].numpy(), cmap="inferno", vmin=0, vmax=0.5)
            ax[r, j].set_xticks([]); ax[r, j].set_yticks([])
            if r == 0:
                e = manifest[ids[j]]
                ax[r, j].set_title(f"{e['type']}\n{e['severity']}\n"
                                   f"PSNR {m['psnr'][ids[j]]:.1f} SSIM {m['ssim'][ids[j]]:.2f}", fontsize=8)
        ax[r, 0].set_ylabel(name, fontsize=9)
    fig.suptitle(title); plt.tight_layout(); plt.savefig(path, dpi=110); plt.close(fig)


rng = np.random.default_rng(0)
picks = [int(rng.choice(np.where((types == t) & (sev == s))[0]))
         for t in ["salt_pepper", "blur", "occlusion"] for s in ["low", "medium", "high"]]
picks += [int(i) for i in rng.choice(np.where(types == "clean")[0], 3, replace=False)]
grid(picks[:6], out_dir / "examples_1.png", "Task 1 examples (1/2)")
grid(picks[6:], out_dir / "examples_2.png", "Task 1 examples (2/2)")

fails = [int(np.where(types == t)[0][np.argmin(m["ssim"][types == t])])
         for t in ["clean", "salt_pepper", "blur", "occlusion"]]
grid(fails, out_dir / "failure_cases.png", "Task 1 failure cases: worst SSIM per condition")
for i in fails:
    print("failure:", manifest[i]["type"], manifest[i]["severity"], manifest[i]["params"],
          f"PSNR {m['psnr'][i]:.2f} SSIM {m['ssim'][i]:.3f}")
print("saved to", out_dir)