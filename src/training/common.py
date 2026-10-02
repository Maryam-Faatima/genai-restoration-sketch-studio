import json, random, shutil
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision.utils import make_grid
from pytorch_msssim import ssim
from src.config import MANIFEST_DIR, CKPT_ROOT
from src.data.pets import load_pets, PetRestorationDataset


def set_seed(s=42):
    random.seed(s); np.random.seed(s); torch.manual_seed(s); torch.cuda.manual_seed_all(s)


def get_device():
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def recon_loss(out, y, alpha):
    """alpha * L1 + (1 - alpha) * (1 - SSIM)"""
    return alpha * F.l1_loss(out, y) + (1 - alpha) * (1 - ssim(out, y, data_range=1.0))


def psnr(a, b):
    mse = ((a - b) ** 2).mean((1, 2, 3)).clamp_min(1e-5)   # caps PSNR at 50 dB
    return 10 * torch.log10(1.0 / mse)


def make_train_loader(batch_size, force_type=None, num_workers=2):
    imgs, idx = load_pets("train")
    ds = PetRestorationDataset(imgs, idx, force_type=force_type)
    return DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True,
                      num_workers=num_workers, persistent_workers=num_workers > 0)


def make_manifest_loader(split, batch_size=64, num_workers=2):
    """split in {'val','test'} -> deterministic loader + its manifest list."""
    manifest = json.load(open(MANIFEST_DIR / f"{split}_manifest.json"))
    imgs, _ = load_pets(split)
    ds = PetRestorationDataset(imgs, None, manifest=manifest)
    return DataLoader(ds, batch_size=batch_size, shuffle=False, num_workers=num_workers), manifest


@torch.no_grad()
def evaluate(predict, loader, dev):
    """predict: callable (x)->restored. Returns per-sample arrays (output + input baseline)."""
    acc = {k: [] for k in ["psnr", "ssim", "l1", "in_psnr", "in_ssim"]}
    for x, y, _ in loader:
        x, y = x.to(dev), y.to(dev)
        out = predict(x).clamp(0, 1)
        acc["psnr"].append(psnr(out, y).cpu())
        acc["ssim"].append(ssim(out, y, data_range=1.0, size_average=False).cpu())
        acc["l1"].append((out - y).abs().mean((1, 2, 3)).cpu())
        acc["in_psnr"].append(psnr(x, y).cpu())
        acc["in_ssim"].append(ssim(x, y, data_range=1.0, size_average=False).cpu())
    return {k: torch.cat(v).numpy() for k, v in acc.items()}


def summarize(manifest, m):
    """Group per-sample metrics: overall, per type, per type/severity."""
    types = np.array([e["type"] for e in manifest])
    sev = np.array([e["severity"] for e in manifest])

    def agg(mask):
        d = {k: float(v[mask].mean()) for k, v in m.items()}
        d["n"] = int(mask.sum())
        return d

    out = {"overall": agg(np.ones(len(manifest), bool))}
    for t in sorted(set(types)):
        out[t] = agg(types == t)
        for s in ["low", "medium", "high"]:
            mk = (types == t) & (sev == s)
            if mk.any():
                out[f"{t}/{s}"] = agg(mk)
    return out


def score(summary):
    """Optuna objective: combines reconstruction quality (PSNR) and structure (SSIM)."""
    s = summary["overall"]
    return 0.5 * s["ssim"] + 0.5 * s["psnr"] / 40.0


@torch.no_grad()
def sample_grid(predict, dataset, dev, n=8):
    """Rows: input / restored / clean target, for the same fixed validation samples."""
    xs = torch.stack([dataset[i][0] for i in range(n)]).to(dev)
    ys = torch.stack([dataset[i][1] for i in range(n)]).to(dev)
    out = predict(xs).clamp(0, 1)
    return make_grid(torch.cat([xs, out, ys]).cpu(), nrow=n)


def study_storage(name):
    """SQLite study kept locally (Drive + SQLite locks badly) and synced to Drive after each trial."""
    local = Path("studies"); local.mkdir(exist_ok=True)
    remote = CKPT_ROOT / "studies"; remote.mkdir(parents=True, exist_ok=True)
    db = local / f"{name}.db"
    if not db.exists() and (remote / f"{name}.db").exists():
        shutil.copy(remote / f"{name}.db", db)

    def sync(study, trial):
        shutil.copy(db, remote / f"{name}.db")
    return f"sqlite:///{db}", sync
