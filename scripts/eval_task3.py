import json, os
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from src.config import CKPT_ROOT
from src.models.softmoe import load_softmoe, BRANCHES
from src.training.common import get_device, make_manifest_loader, summarize
from src.training.train_moe import eval_moe

dev = get_device()
model, ck = load_softmoe(CKPT_ROOT / "task3" / "softmoe.pt", dev)
print("config:", ck["cfg"], "| best epoch", ck["epoch"], "| val score", round(ck["score"], 4))
out_dir = CKPT_ROOT / "task3" / "eval"; out_dir.mkdir(parents=True, exist_ok=True)

loader, manifest = make_manifest_loader("test", 128, 2)
m, W, Y = eval_moe(model, loader, dev)
summ = summarize(manifest, m)
json.dump(summ, open(out_dir / "test_summary.json", "w"), indent=2)
np.savez(out_dir / "per_sample.npz", weights=W, labels=Y, **m)

hard = None
if os.path.exists("reports/task2/routing_summary.json"):
    hard = json.load(open("reports/task2/routing_summary.json"))["predicted"]

print(f"\n{'group':22s} {'n':>6s} {'inPSNR':>7s} {'hardPSNR':>9s} {'softPSNR':>9s} "
      f"{'inSSIM':>7s} {'hardSSIM':>9s} {'softSSIM':>9s}")
order = ["overall", "clean"] + [f"{t}{s}" for t in ["salt_pepper", "blur", "occlusion"]
                                for s in ["", "/low", "/medium", "/high"]]
for k in order:
    if k in summ:
        r = summ[k]; h = hard[k] if hard and k in hard else None
        print(f"{k:22s} {r['n']:6d} {r['in_psnr']:7.2f} {(h['psnr'] if h else float('nan')):9.2f} "
              f"{r['psnr']:9.2f} {r['in_ssim']:7.3f} {(h['ssim'] if h else float('nan')):9.3f} {r['ssim']:9.3f}")

# ---------------- gate behaviour ----------------
types = np.array([e["type"] for e in manifest]); sev = np.array([e["severity"] for e in manifest])
groups = ["clean"] + [f"{t}/{s}" for t in ["salt_pepper", "blur", "occlusion"] for s in ["low", "medium", "high"]]


def gmask(g):
    if g == "clean":
        return types == "clean"
    t, s = g.split("/")
    return (types == t) & (sev == s)


M = np.array([W[gmask(g)].mean(0) for g in groups])
print("\naverage gate weights per true condition and severity")
print(f"{'group':22s} " + " ".join(f"{b:>9s}" for b in BRANCHES))
for g, row in zip(groups, M):
    print(f"{g:22s} " + " ".join(f"{v:9.3f}" for v in row))

amax = W.argmax(1)
print(f"\ngate accuracy (argmax weight == true class): {(amax == Y).mean():.4f}")
print(f"{'branch':10s} {'mean w':>7s} {'argmax share':>13s} {'mean w on other types':>22s}")
health = {}
for j, b in enumerate(BRANCHES):
    health[b] = {"mean_w": float(W[:, j].mean()), "argmax_share": float((amax == j).mean()),
                 "mean_w_unrelated": float(W[Y != j, j].mean())}
    print(f"{b:10s} {health[b]['mean_w']:7.3f} {health[b]['argmax_share']:13.3f} {health[b]['mean_w_unrelated']:22.3f}")
conf = W.max(1)
print(f"samples where one branch has weight > 0.95: {(conf > 0.95).mean():.3f} | "
      f"weight < 0.60 (spread): {(conf < 0.60).mean():.4f}")
json.dump({"groups": groups, "matrix": M.tolist(), "health": health,
           "gate_acc": float((amax == Y).mean())}, open(out_dir / "gate_analysis.json", "w"), indent=2)

fig, ax = plt.subplots(figsize=(6.2, 5.6))
im = ax.imshow(M, cmap="viridis", vmin=0, vmax=1)
ax.set_xticks(range(4)); ax.set_xticklabels(BRANCHES)
ax.set_yticks(range(len(groups))); ax.set_yticklabels(groups)
for i in range(len(groups)):
    for j in range(4):
        ax.text(j, i, f"{M[i, j]:.2f}", ha="center", va="center", color="white" if M[i, j] < 0.6 else "black")
ax.set_xlabel("branch"); ax.set_title("Mean routing weights by true condition")
fig.colorbar(im); plt.tight_layout(); plt.savefig(out_dir / "routing_heatmap.png", dpi=150); plt.close(fig)


# ---------------- example figures ----------------
@torch.no_grad()
def show(ids, path, title):
    ds = loader.dataset
    xs = torch.stack([ds[i][0] for i in ids]).to(dev); ys = torch.stack([ds[i][1] for i in ids]).to(dev)
    out, w, _ = model(xs, return_all=True); out = out.clamp(0, 1)
    fig, ax = plt.subplots(4, len(ids), figsize=(2.6 * len(ids), 10.4), squeeze=False)
    for j, i in enumerate(ids):
        for r, t in enumerate([ys, xs, out]):
            ax[r, j].imshow(t[j].cpu().permute(1, 2, 0).numpy()); ax[r, j].set_xticks([]); ax[r, j].set_yticks([])
        ax[3, j].bar(range(4), w[j].cpu().numpy(), color=["gray", "tab:red", "tab:blue", "tab:green"])
        ax[3, j].set_ylim(0, 1); ax[3, j].set_xticks(range(4))
        ax[3, j].set_xticklabels(["id", "salt", "blur", "occ"], fontsize=7)
        e = manifest[i]
        ax[0, j].set_title(f"{e['type']}\n{e['severity']}\nSSIM {m['ssim'][i]:.2f}", fontsize=8)
    for r, t in enumerate(["clean target", "corrupted input", "soft-MoE output", "gate weights"]):
        ax[r, 0].set_ylabel(t, fontsize=9)
    fig.suptitle(title); plt.tight_layout(); plt.savefig(path, dpi=110); plt.close(fig)


rng = np.random.default_rng(0)
dom = np.where(conf > 0.95)[0]
dom_ids = [int(i) for i in rng.choice(dom, 4, replace=False)] if len(dom) >= 4 else [int(i) for i in np.argsort(-conf)[:4]]
spread_ids = [int(i) for i in np.argsort(conf)[:4]]
show(dom_ids, out_dir / "weights_dominated.png", "One expert dominates")
show(spread_ids, out_dir / "weights_spread.png", "Weights spread across experts")
fails = [int(np.where(types == t)[0][np.argmin(m["ssim"][types == t])])
         for t in ["clean", "salt_pepper", "blur", "occlusion"]]
show(fails, out_dir / "failure_cases.png", "Task 3 failure cases: worst SSIM per condition")
for i in fails:
    print("failure:", manifest[i]["type"], manifest[i]["severity"], f"SSIM {m['ssim'][i]:.3f}",
          "weights", np.round(W[i], 2).tolist())
print("saved to", out_dir)
