import json
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pytorch_msssim import ssim
from src.config import CKPT_ROOT
from src.data.corruptions import CLASS_NAMES
from src.models.autoencoder import ConvAE
from src.models.classifier import CorruptionClassifier
from src.training.common import get_device, make_manifest_loader, psnr, summarize
from src.training.train_cls import cls_metrics

dev = get_device()
t2 = CKPT_ROOT / "task2"
out_dir = t2 / "eval"; out_dir.mkdir(parents=True, exist_ok=True)

ck = torch.load(t2 / "classifier.pt", map_location=dev)
clf = CorruptionClassifier(ck["cfg"]["channels"], ck["cfg"]["dropout"]).to(dev)
clf.load_state_dict(ck["state_dict"]); clf.eval()
specs = {}
for k, nm in [(1, "salt"), (2, "blur"), (3, "occ")]:
    s = torch.load(t2 / f"spec_{nm}.pt", map_location=dev); c = s["cfg"]
    m = ConvAE(c["base"], c["bottleneck"], c.get("dropout", 0.1)).to(dev)
    m.load_state_dict(s["state_dict"]); m.eval(); specs[k] = m


@torch.no_grad()
def all_branches(x):   # (4, B, 3, H, W): identity (clean bypass), salt, blur, occlusion
    return torch.stack([x] + [specs[k](x).clamp(0, 1) for k in (1, 2, 3)])


def select(outs, idx):
    return outs[idx, torch.arange(outs.shape[1], device=outs.device)]


loader, manifest = make_manifest_loader("test", 128, 2)
keys = ["in_psnr", "in_ssim", "o_psnr", "o_ssim", "o_l1", "p_psnr", "p_ssim", "p_l1"]
rec = {k: [] for k in keys}; Y, PR = [], []
with torch.no_grad():
    for x, y, lab in loader:
        x, y, lab = x.to(dev), y.to(dev), lab.to(dev)
        pred = clf(x).argmax(1)
        outs = all_branches(x)
        o, p = select(outs, lab), select(outs, pred)       # oracle / predicted routing
        rec["in_psnr"].append(psnr(x, y).cpu()); rec["in_ssim"].append(ssim(x, y, data_range=1.0, size_average=False).cpu())
        rec["o_psnr"].append(psnr(o, y).cpu());  rec["o_ssim"].append(ssim(o, y, data_range=1.0, size_average=False).cpu())
        rec["o_l1"].append((o - y).abs().mean((1, 2, 3)).cpu())
        rec["p_psnr"].append(psnr(p, y).cpu());  rec["p_ssim"].append(ssim(p, y, data_range=1.0, size_average=False).cpu())
        rec["p_l1"].append((p - y).abs().mean((1, 2, 3)).cpu())
        Y.append(lab.cpu()); PR.append(pred.cpu())
R = {k: torch.cat(v).numpy() for k, v in rec.items()}
Y, PR = torch.cat(Y).numpy(), torch.cat(PR).numpy()

summ_o = summarize(manifest, {"psnr": R["o_psnr"], "ssim": R["o_ssim"], "l1": R["o_l1"],
                              "in_psnr": R["in_psnr"], "in_ssim": R["in_ssim"]})
summ_p = summarize(manifest, {"psnr": R["p_psnr"], "ssim": R["p_ssim"], "l1": R["p_l1"],
                              "in_psnr": R["in_psnr"], "in_ssim": R["in_ssim"]})
summ_a = summarize(manifest, {"acc": (Y == PR).astype(np.float32)})
json.dump({"oracle": summ_o, "predicted": summ_p, "classifier_acc_by_group": summ_a},
          open(out_dir / "routing_summary.json", "w"), indent=2)

print(f"{'group':24s} {'n':>6s} {'inPSNR':>7s} {'oraPSNR':>8s} {'prdPSNR':>8s} "
      f"{'inSSIM':>7s} {'oraSSIM':>8s} {'prdSSIM':>8s} {'clsAcc':>7s}")
order = ["overall", "clean"] + [f"{t}{s}" for t in ["salt_pepper", "blur", "occlusion"]
                                for s in ["", "/low", "/medium", "/high"]]
for k in order:
    if k in summ_o:
        a, b = summ_o[k], summ_p[k]
        print(f"{k:24s} {a['n']:6d} {a['in_psnr']:7.2f} {a['psnr']:8.2f} {b['psnr']:8.2f} "
              f"{a['in_ssim']:7.3f} {a['ssim']:8.3f} {b['ssim']:8.3f} {summ_a[k]['acc']:7.3f}")

# ---- classifier metrics + normalized confusion matrix (official test set) ----
cm = cls_metrics(Y, PR)
json.dump(cm, open(out_dir / "classifier_test_metrics.json", "w"), indent=2)
print(f"\nclassifier: acc {cm['accuracy']:.4f} | macro P {cm['macro_precision']:.4f} "
      f"R {cm['macro_recall']:.4f} F1 {cm['macro_f1']:.4f}")
for k, v in cm["per_class"].items():
    print(f"  {k:12s} P {v['precision']:.3f} R {v['recall']:.3f} F1 {v['f1']:.3f} (n={v['support']})")
mat = np.array(cm["confusion_normalized"])
fig, ax = plt.subplots(figsize=(5.8, 5))
im = ax.imshow(mat, cmap="Blues", vmin=0, vmax=1)
ax.set_xticks(range(4)); ax.set_xticklabels(CLASS_NAMES, rotation=30)
ax.set_yticks(range(4)); ax.set_yticklabels(CLASS_NAMES)
for i in range(4):
    for j in range(4):
        ax.text(j, i, f"{mat[i, j]:.2f}", ha="center", va="center",
                color="white" if mat[i, j] > 0.5 else "black")
ax.set_xlabel("predicted"); ax.set_ylabel("true"); ax.set_title("Normalized confusion matrix (test)")
fig.colorbar(im); plt.tight_layout(); plt.savefig(out_dir / "confusion_matrix.png", dpi=150); plt.close(fig)

# ---- failures caused by misrouting ----
wrong = np.where(PR != Y)[0]
drop = R["o_ssim"] - R["p_ssim"]
print(f"\nmisrouted: {len(wrong)} / {len(Y)} | mean SSIM drop vs oracle on misrouted: "
      f"{drop[wrong].mean() if len(wrong) else 0:.4f}")
for t in range(4):
    for q in range(4):
        sel = np.where((Y == t) & (PR == q) & (t != q))[0]
        if len(sel):
            print(f"  true {CLASS_NAMES[t]:12s} -> routed to {CLASS_NAMES[q]:12s}: n={len(sel):5d} "
                  f"mean SSIM drop {drop[sel].mean():.3f}")

if len(wrong):
    ids = [int(i) for i in wrong[np.argsort(-drop[wrong])][:4]]
    ds = loader.dataset
    xs = torch.stack([ds[i][0] for i in ids]).to(dev); ys = torch.stack([ds[i][1] for i in ids]).to(dev)
    outs = all_branches(xs)
    o = select(outs, torch.tensor([manifest[i]["label"] for i in ids], device=dev))
    p = select(outs, torch.tensor([int(PR[i]) for i in ids], device=dev))
    rows = [("clean target", ys.cpu()), ("input", xs.cpu()), ("oracle routing", o.cpu()),
            ("predicted routing", p.cpu()), ("abs. error (predicted)", (p - ys).abs().mean(1).cpu())]
    fig, ax = plt.subplots(5, len(ids), figsize=(2.6 * len(ids), 12.5), squeeze=False)
    for r, (nm, t) in enumerate(rows):
        for j in range(len(ids)):
            if r < 4: ax[r, j].imshow(t[j].permute(1, 2, 0).numpy())
            else:     ax[r, j].imshow(t[j].numpy(), cmap="inferno", vmin=0, vmax=0.5)
            ax[r, j].set_xticks([]); ax[r, j].set_yticks([])
            if r == 0:
                e = manifest[ids[j]]
                ax[r, j].set_title(f"true: {e['type']} ({e['severity']})\nrouted to: {CLASS_NAMES[PR[ids[j]]]}\n"
                                   f"SSIM oracle {R['o_ssim'][ids[j]]:.2f} / pred {R['p_ssim'][ids[j]]:.2f}", fontsize=8)
        ax[r, 0].set_ylabel(nm, fontsize=9)
    fig.suptitle("Restoration failures caused by classifier errors"); plt.tight_layout()
    plt.savefig(out_dir / "misrouting_failures.png", dpi=110); plt.close(fig)
print("saved to", out_dir)
