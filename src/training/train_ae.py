import argparse, json
import torch
from pytorch_msssim import ssim  # noqa: F401 (used inside recon_loss)
from src.config import CKPT_ROOT
from src.models.autoencoder import build_ae
from src.training.common import (set_seed, get_device, recon_loss, make_train_loader,
                                 make_manifest_loader, evaluate, summarize, score, sample_grid)

DEFAULT_CFG = dict(lr=1e-3, batch_size=32, base=32, latent_ch=16, dropout=0.1, alpha=0.8)


def train(cfg, epochs, run_name, trial=None, use_wandb=True, save=False,
          group=None, num_workers=2):
    set_seed(42)
    dev = get_device()
    model = build_ae(cfg).to(dev)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=cfg["lr"], weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    train_loader = make_train_loader(cfg["batch_size"], num_workers=num_workers)
    val_loader, val_manifest = make_manifest_loader("val", 64, num_workers)

    run = None
    if use_wandb:
        import wandb
        run = wandb.init(project="genai-a1-restoration", name=run_name, group=group,
                         config={**cfg, "epochs": epochs, "params": n_params,
                                 "task": "task1_universal_ae"}, reinit=True)
    save_dir = CKPT_ROOT / "task1"
    best, best_summ = -1.0, None

    for ep in range(epochs):
        model.train(); run_loss, n = 0.0, 0
        for x, y, _ in train_loader:
            x, y = x.to(dev), y.to(dev)
            loss = recon_loss(model(x), y, cfg["alpha"])
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            run_loss += loss.item() * x.size(0); n += x.size(0)
        sched.step()

        model.eval()
        summ = summarize(val_manifest, evaluate(model, val_loader, dev))
        sc = score(summ)
        log = {"epoch": ep, "train/loss": run_loss / n, "val/score": sc,
               "lr": opt.param_groups[0]["lr"]}
        for k in ["overall", "clean", "salt_pepper", "blur", "occlusion"]:
            for m in ["psnr", "ssim", "l1"]:
                log[f"val/{k}/{m}"] = summ[k][m]
        if run and (ep % 5 == 0 or ep == epochs - 1):
            import wandb
            log["samples"] = wandb.Image(sample_grid(model, val_loader.dataset, dev),
                                         caption="rows: input / restored / clean target")
        if run:
            run.log(log)
        print(f"ep {ep:3d} | loss {run_loss/n:.4f} | score {sc:.4f} | "
              f"SSIM {summ['overall']['ssim']:.3f} PSNR {summ['overall']['psnr']:.2f}")

        if sc > best:
            best, best_summ = sc, summ
            if save:
                save_dir.mkdir(parents=True, exist_ok=True)
                torch.save({"cfg": cfg, "state_dict": model.state_dict(), "epoch": ep,
                            "score": sc}, save_dir / "best.pt")

        if trial is not None:
            import optuna
            trial.report(sc, ep)
            if trial.should_prune():
                if run: run.finish()
                raise optuna.TrialPruned()

    if save:
        json.dump(best_summ, open(save_dir / "val_summary.json", "w"), indent=2)
    if run:
        import wandb
        run.summary.update({"best_score": best, "params": n_params})
        if save:
            art = wandb.Artifact("task1-universal-ae", type="model")
            art.add_file(str(save_dir / "best.pt"))
            run.log_artifact(art)
        run.finish()
    return best


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--run_name", default="task1-run")
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()
    cfg = dict(DEFAULT_CFG)
    if a.config:
        cfg.update(json.load(open(a.config)))
    print("config:", cfg)
    best = train(cfg, a.epochs, a.run_name, use_wandb=not a.no_wandb,
                 save=True, num_workers=a.workers)
    print("best score:", best)
