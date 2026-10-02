import argparse, json
import torch
from torch.utils.data import DataLoader
from src.config import CKPT_ROOT, MANIFEST_DIR
from src.data.pets import load_pets, PetRestorationDataset
from src.data.balanced import MixedTypesDataset
from src.models.autoencoder import ConvAE
from src.training.common import (set_seed, get_device, recon_loss, evaluate, summarize,
                                 score, sample_grid)

DEFAULT_CFG = dict(lr=5e-4, batch_size=32, base=32, bottleneck=256, dropout=0.1, alpha=0.7)
TYPE_IDS = {"salt": 1, "blur": 2, "occ": 3}


def make_loaders(types, batch_size, workers):
    imgs, idx = load_pets("train")
    train = DataLoader(MixedTypesDataset(imgs, idx, types), batch_size=batch_size, shuffle=True,
                       drop_last=True, num_workers=workers, persistent_workers=workers > 0)
    manifest = [e for e in json.load(open(MANIFEST_DIR / "val_manifest.json")) if e["label"] in types]
    vimgs, _ = load_pets("val")
    val = DataLoader(PetRestorationDataset(vimgs, None, manifest=manifest), batch_size=64,
                     shuffle=False, num_workers=workers)
    return train, val, manifest


def train_spec(cfg, types, epochs, run_name, save_name=None, trial=None, use_wandb=True,
               group=None, num_workers=2, seed=42):
    set_seed(seed); dev = get_device()
    model = ConvAE(cfg["base"], cfg["bottleneck"], cfg.get("dropout", 0.1)).to(dev)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=cfg["lr"], weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    train_loader, val_loader, manifest = make_loaders(types, cfg["batch_size"], num_workers)
    print(f"{run_name}: train types {types} | val images {len(manifest)}")

    run = None
    if use_wandb:
        import wandb
        run = wandb.init(project="genai-a1-restoration", name=run_name, group=group,
                         config={**cfg, "epochs": epochs, "types": types, "params": n_params,
                                 "task": "task2_specialist"}, reinit="finish_previous")
    save_dir = CKPT_ROOT / "task2"
    best, best_summ = -1.0, None

    for ep in range(epochs):
        model.train(); rl, n = 0.0, 0
        for x, y, _ in train_loader:
            x, y = x.to(dev), y.to(dev)
            loss = recon_loss(model(x), y, cfg["alpha"])
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            rl += loss.item() * x.size(0); n += x.size(0)
        sched.step()

        model.eval()
        summ = summarize(manifest, evaluate(model, val_loader, dev))
        sc = score(summ); o = summ["overall"]
        log = {"epoch": ep, "train/loss": rl / n, "val/score": sc, "val/psnr": o["psnr"],
               "val/ssim": o["ssim"], "val/l1": o["l1"], "val/input_psnr": o["in_psnr"],
               "val/input_ssim": o["in_ssim"]}
        if run and (ep % 5 == 0 or ep == epochs - 1):
            import wandb
            log["samples"] = wandb.Image(sample_grid(model, val_loader.dataset, dev),
                                         caption="rows: input / restored / clean target")
        if run: run.log(log)
        print(f"ep {ep:3d} | loss {rl/n:.4f} | score {sc:.4f} | SSIM {o['ssim']:.3f} PSNR {o['psnr']:.2f}"
              f" (input: SSIM {o['in_ssim']:.3f} PSNR {o['in_psnr']:.2f})")

        if sc > best:
            best, best_summ = sc, summ
            if save_name:
                save_dir.mkdir(parents=True, exist_ok=True)
                torch.save({"cfg": cfg, "state_dict": model.state_dict(), "epoch": ep, "score": sc,
                            "types": types}, save_dir / f"spec_{save_name}.pt")
        if trial is not None:
            import optuna
            trial.report(sc, ep)
            if trial.should_prune():
                if run: run.finish()
                raise optuna.TrialPruned()

    if save_name:
        json.dump(best_summ, open(save_dir / f"spec_{save_name}_val_summary.json", "w"), indent=2)
    if run:
        run.summary.update({"best_score": best, "params": n_params}); run.finish()
    return best


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--which", default="all", choices=["all", "salt", "blur", "occ"])
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()
    cfg = dict(DEFAULT_CFG)
    if a.config:
        cfg.update(json.load(open(a.config)))
    print("config:", cfg)
    names = ["salt", "blur", "occ"] if a.which == "all" else [a.which]
    for nm in names:   # independent training: own data, own seed, own parameters
        b = train_spec(cfg, [TYPE_IDS[nm]], a.epochs, f"task2-spec-{nm}", save_name=nm,
                       use_wandb=not a.no_wandb, num_workers=a.workers, seed=42 + TYPE_IDS[nm])
        print(f"specialist {nm}: best score {b:.4f}")
