import argparse, json
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision.utils import make_grid
from pytorch_msssim import ssim
from src.config import CKPT_ROOT
from src.data.fs2k import FS2KDataset
from src.models.cgan import UNetGenerator, PatchDiscriminator, init_weights
from src.training.common import set_seed, get_device

DEFAULT_CFG = dict(lr_g=2e-4, lr_d=2e-4, batch_size=16, base=64, dropout=0.3,
                   emb_dim=16, lambda_l1=100.0)


def to01(t):
    return (t.clamp(-1, 1) + 1) / 2


@torch.no_grad()
def validate(G, loader, dev):
    G.eval(); l1s, ps, ss, sens = [], [], [], []
    for x, y, s in loader:
        x, y, s = x.to(dev), y.to(dev), s.to(dev)
        f = G(x, s)
        f2 = G(x, (s + 1) % 3)                      # same photo, different style
        a, b = to01(f), to01(y)
        l1s.append((a - b).abs().mean((1, 2, 3)).cpu())
        mse = ((a - b) ** 2).mean((1, 2, 3)).clamp_min(1e-8)
        ps.append((10 * torch.log10(1.0 / mse)).cpu())
        ss.append(ssim(a, b, data_range=1.0, size_average=False).cpu())
        sens.append((a - to01(f2)).abs().mean((1, 2, 3)).cpu())
    return {"l1": torch.cat(l1s).mean().item(), "psnr": torch.cat(ps).mean().item(),
            "ssim": torch.cat(ss).mean().item(), "style_sensitivity": torch.cat(sens).mean().item()}


@torch.no_grad()
def sample_grid(G, ds, dev, n=6):
    """Same fixed validation photos every time. Rows: photo / real sketch / generated (true style)
    / generated with style 1, 2, 3."""
    G.eval()
    x = torch.stack([ds[i][0] for i in range(n)]).to(dev)
    y = torch.stack([ds[i][1] for i in range(n)]).to(dev)
    s = torch.stack([ds[i][2] for i in range(n)]).to(dev)
    rows = [to01(x), to01(y).repeat(1, 3, 1, 1), to01(G(x, s)).repeat(1, 3, 1, 1)]
    for k in range(3):
        rows.append(to01(G(x, torch.full_like(s, k))).repeat(1, 3, 1, 1))
    return make_grid(torch.cat(rows).cpu(), nrow=n)


def train_gan(cfg, epochs, run_name, trial=None, use_wandb=True, save=False,
              group=None, num_workers=2, log_every=5):
    set_seed(42); dev = get_device()
    G = UNetGenerator(cfg["base"], cfg["emb_dim"], cfg["dropout"]).to(dev)
    D = PatchDiscriminator(64, cfg["emb_dim"]).to(dev)
    G.apply(init_weights); D.apply(init_weights)
    optG = torch.optim.Adam(G.parameters(), lr=cfg["lr_g"], betas=(0.5, 0.999))
    optD = torch.optim.Adam(D.parameters(), lr=cfg["lr_d"], betas=(0.5, 0.999))
    bce = torch.nn.BCEWithLogitsLoss()

    tr, va = FS2KDataset("train", augment=True), FS2KDataset("val")
    train_loader = DataLoader(tr, batch_size=cfg["batch_size"], shuffle=True, drop_last=True,
                              num_workers=num_workers, persistent_workers=num_workers > 0)
    val_loader = DataLoader(va, batch_size=64, shuffle=False)
    print(f"train {len(tr)} | val {len(va)}")

    run = None
    if use_wandb:
        import wandb
        run = wandb.init(project="genai-a1-restoration", name=run_name, group=group,
                         config={**cfg, "epochs": epochs, "task": "task4_cgan",
                                 "params_G": sum(p.numel() for p in G.parameters()),
                                 "params_D": sum(p.numel() for p in D.parameters())},
                         reinit="finish_previous")
    save_dir = CKPT_ROOT / "task4"
    best, best_v = -1.0, None

    for ep in range(epochs):
        G.train(); D.train()
        acc = dict(d_real=0.0, d_fake=0.0, g_adv=0.0, g_rec=0.0); n = 0
        for x, y, s in train_loader:
            x, y, s = x.to(dev), y.to(dev), s.to(dev)
            fake = G(x, s)

            # ---- discriminator: real pair -> 1, generated pair -> 0 ----
            lr_ = D(x, y, s); lf_ = D(x, fake.detach(), s)
            d_real = bce(lr_, torch.ones_like(lr_))
            d_fake = bce(lf_, torch.zeros_like(lf_))
            optD.zero_grad(set_to_none=True)
            (0.5 * (d_real + d_fake)).backward(); optD.step()

            # ---- generator: fool D + stay close to the paired sketch ----
            lg = D(x, fake, s)
            g_adv = bce(lg, torch.ones_like(lg))
            g_rec = F.l1_loss(fake, y)
            optG.zero_grad(set_to_none=True)
            (g_adv + cfg["lambda_l1"] * g_rec).backward(); optG.step()

            b = x.size(0); n += b
            acc["d_real"] += d_real.item() * b; acc["d_fake"] += d_fake.item() * b
            acc["g_adv"] += g_adv.item() * b;   acc["g_rec"] += g_rec.item() * b

        v = validate(G, val_loader, dev)
        log = {"epoch": ep, "train/d_real_loss": acc["d_real"] / n, "train/d_fake_loss": acc["d_fake"] / n,
               "train/g_adv_loss": acc["g_adv"] / n, "train/g_l1_loss": acc["g_rec"] / n,
               **{f"val/{k}": val for k, val in v.items()}}
        if run and (ep % log_every == 0 or ep == epochs - 1):
            import wandb
            log["samples"] = wandb.Image(sample_grid(G, va, dev),
                caption="rows: photo / real sketch / generated(true style) / generated style 1,2,3")
        if run:
            run.log(log)
        print(f"ep {ep:3d} | D real {acc['d_real']/n:.3f} fake {acc['d_fake']/n:.3f} | "
              f"G adv {acc['g_adv']/n:.3f} L1 {acc['g_rec']/n:.4f} | val L1 {v['l1']:.4f} "
              f"PSNR {v['psnr']:.2f} SSIM {v['ssim']:.3f} style-sens {v['style_sensitivity']:.4f}")

        if v["ssim"] > best:
            best, best_v = v["ssim"], v
            if save:
                save_dir.mkdir(parents=True, exist_ok=True)
                torch.save({"cfg": cfg, "state_dict": G.state_dict(), "epoch": ep, "val": v},
                           save_dir / "generator.pt")
        if trial is not None:
            import optuna
            trial.report(v["ssim"], ep)
            if trial.should_prune():
                if run: run.finish()
                raise optuna.TrialPruned()

    if save:
        json.dump(best_v, open(save_dir / "generator_val_metrics.json", "w"), indent=2)
    if run:
        import wandb
        run.summary.update({"best_val_ssim": best})
        if save:
            art = wandb.Artifact("task4-generator", type="model")
            art.add_file(str(save_dir / "generator.pt")); run.log_artifact(art)
        run.finish()
    return best


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--run_name", default="task4-final")
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()
    cfg = dict(DEFAULT_CFG)
    if a.config:
        cfg.update(json.load(open(a.config)))
    print("config:", cfg)
    print("best val SSIM:", train_gan(cfg, a.epochs, a.run_name, use_wandb=not a.no_wandb,
                                      save=True, num_workers=a.workers))
