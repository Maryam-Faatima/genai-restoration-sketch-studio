import argparse, json
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from pytorch_msssim import ssim
from src.config import CKPT_ROOT
from src.data.corruptions import CLASS_NAMES
from src.data.pets import load_pets
from src.data.balanced import BalancedCorruptionDataset
from src.models.softmoe import SoftMoE, load_task2_parts, BRANCHES
from src.training.common import (set_seed, get_device, psnr, make_manifest_loader,
                                 summarize, score, sample_grid)

DEFAULT_CFG = dict(lr_joint=5e-5, T=1.0, lam_cls=0.1, lam_bal=0.01, alpha=0.8, batch_size=32)
WARM_LR = 5e-4


@torch.no_grad()
def eval_moe(model, loader, dev):
    model.eval()
    acc = {k: [] for k in ["psnr", "ssim", "l1", "in_psnr", "in_ssim"]}
    W, Y = [], []
    for x, y, lab in loader:
        x, y = x.to(dev), y.to(dev)
        out, w, _ = model(x, return_all=True)
        out = out.clamp(0, 1)
        acc["psnr"].append(psnr(out, y).cpu())
        acc["ssim"].append(ssim(out, y, data_range=1.0, size_average=False).cpu())
        acc["l1"].append((out - y).abs().mean((1, 2, 3)).cpu())
        acc["in_psnr"].append(psnr(x, y).cpu())
        acc["in_ssim"].append(ssim(x, y, data_range=1.0, size_average=False).cpu())
        W.append(w.cpu()); Y.append(lab)
    return ({k: torch.cat(v).numpy() for k, v in acc.items()},
            torch.cat(W).numpy(), torch.cat(Y).numpy())


def moe_losses(out, y, w, logits, labels, cfg):
    l1 = F.l1_loss(out, y)
    s = 1 - ssim(out, y, data_range=1.0)
    ce = F.cross_entropy(logits / cfg["T"], labels)          # CE on the tempered logits
    bal = ((w.mean(0) - 0.25) ** 2).sum()                    # balanced batch -> target 1/4 each
    total = cfg["alpha"] * l1 + (1 - cfg["alpha"]) * s + cfg["lam_cls"] * ce + cfg["lam_bal"] * bal
    return total, l1, s, ce, bal


def set_phase(model, warmup):
    for p in model.experts.parameters():
        p.requires_grad_(not warmup)
    model.train()
    if warmup:
        model.experts.eval()                                  # frozen BatchNorm statistics


def train_moe(cfg, warm_epochs, joint_epochs, run_name, trial=None, use_wandb=True,
              save=False, group=None, num_workers=2):
    set_seed(42); dev = get_device()
    gate, experts, arch = load_task2_parts(CKPT_ROOT / "task2", dev)
    model = SoftMoE(gate, experts, cfg["T"]).to(dev)
    n_params = sum(p.numel() for p in model.parameters())

    imgs, idx = load_pets("train")
    train_loader = DataLoader(BalancedCorruptionDataset(imgs, idx), batch_size=cfg["batch_size"],
                              shuffle=False, drop_last=True, num_workers=num_workers,
                              persistent_workers=num_workers > 0)
    val_loader, val_manifest = make_manifest_loader("val", 64, num_workers)
    vtypes = np.array([e["type"] for e in val_manifest])

    run = None
    if use_wandb:
        import wandb
        run = wandb.init(project="genai-a1-restoration", name=run_name, group=group,
                         config={**cfg, "warm_epochs": warm_epochs, "joint_epochs": joint_epochs,
                                 "params": n_params, "task": "task3_soft_moe"},
                         reinit="finish_previous")
    save_dir = CKPT_ROOT / "task3"
    best, best_extra, opt, sched = -1.0, None, None, None
    total_ep = warm_epochs + joint_epochs

    for ep in range(total_ep):
        warm = ep < warm_epochs
        set_phase(model, warm)
        if ep == 0 or ep == warm_epochs:                      # phase change -> new optimizer
            if warm:
                opt = torch.optim.AdamW(model.gate.parameters(), lr=WARM_LR, weight_decay=1e-5)
                sched = None
            else:
                opt = torch.optim.AdamW(model.parameters(), lr=cfg["lr_joint"], weight_decay=1e-5)
                sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(joint_epochs, 1))

        agg = dict(loss=0.0, l1=0.0, ssim=0.0, ce=0.0, bal=0.0); n = 0
        for x, y, lab in train_loader:
            x, y, lab = x.to(dev), y.to(dev), lab.to(dev)
            out, w, logits = model(x, return_all=True)
            loss, l1, s, ce, bal = moe_losses(out, y, w, logits, lab, cfg)
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            b = x.size(0); n += b
            for k, v in zip(agg, (loss, l1, s, ce, bal)):
                agg[k] += v.item() * b
        if sched is not None:
            sched.step()

        m, W, Y = eval_moe(model, val_loader, dev)
        summ = summarize(val_manifest, m)
        sc = score(summ)
        w_mean = W.mean(0); gate_acc = float((W.argmax(1) == Y).mean())
        by_type = {t: W[vtypes == t].mean(0) for t in CLASS_NAMES}

        log = {"epoch": ep, "phase": 0 if warm else 1, "val/score": sc, "val/gate_acc": gate_acc,
               **{f"train/{k}": v / n for k, v in agg.items()}}
        for k in ["overall", "clean", "salt_pepper", "blur", "occlusion"]:
            for q in ["psnr", "ssim"]:
                log[f"val/{k}/{q}"] = summ[k][q]
        for j, bn in enumerate(BRANCHES):
            log[f"val/wmean/{bn}"] = float(w_mean[j])
            for t in CLASS_NAMES:
                log[f"val/w_{t}/{bn}"] = float(by_type[t][j])
        if run:
            if ep % 3 == 0 or ep == total_ep - 1:
                import wandb
                log["samples"] = wandb.Image(sample_grid(model, val_loader.dataset, dev),
                                             caption="rows: input / restored / clean target")
            run.log(log)
        print(f"ep {ep:3d} {'warm ' if warm else 'joint'} | loss {agg['loss']/n:.4f} ce {agg['ce']/n:.3f} "
              f"bal {agg['bal']/n:.4f} | val score {sc:.4f} SSIM {summ['overall']['ssim']:.3f} "
              f"PSNR {summ['overall']['psnr']:.2f} | gate acc {gate_acc:.3f} | "
              f"mean w [id {w_mean[0]:.2f} salt {w_mean[1]:.2f} blur {w_mean[2]:.2f} occ {w_mean[3]:.2f}]")

        collapsed = (not warm) and float(w_mean.min()) < 0.02
        if collapsed:
            print("routing collapse: a branch has mean weight < 0.02")
        if sc > best and not collapsed:
            best = sc
            best_extra = {"summary": summ, "gate_acc": gate_acc, "epoch": ep,
                          "mean_weights_by_type": {t: [float(v) for v in by_type[t]] for t in CLASS_NAMES}}
            if save:
                save_dir.mkdir(parents=True, exist_ok=True)
                torch.save({"cfg": cfg, "arch": arch, "state_dict": model.state_dict(), "epoch": ep,
                            "score": sc, "warm_epochs": warm_epochs}, save_dir / "softmoe.pt")
        if trial is not None:
            import optuna
            if collapsed:
                if run: run.finish()
                raise optuna.TrialPruned()
            trial.report(sc, ep)
            if trial.should_prune():
                if run: run.finish()
                raise optuna.TrialPruned()

    if save and best_extra:
        json.dump(best_extra, open(save_dir / "softmoe_val_summary.json", "w"), indent=2)
    if run:
        import wandb
        run.summary.update({"best_score": best, "params": n_params})
        if save:
            art = wandb.Artifact("task3-soft-moe", type="model")
            art.add_file(str(save_dir / "softmoe.pt")); run.log_artifact(art)
        run.finish()
    return best


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--warm_epochs", type=int, default=3)
    ap.add_argument("--joint_epochs", type=int, default=20)
    ap.add_argument("--run_name", default="task3-final")
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()
    cfg = dict(DEFAULT_CFG)
    if a.config:
        cfg.update(json.load(open(a.config)))
    print("config:", cfg)
    print("best score:", train_moe(cfg, a.warm_epochs, a.joint_epochs, a.run_name,
                                   use_wandb=not a.no_wandb, save=True, num_workers=a.workers))
