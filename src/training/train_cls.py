import argparse, json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
from src.config import CKPT_ROOT
from src.data.corruptions import CLASS_NAMES
from src.data.pets import load_pets
from src.data.balanced import BalancedCorruptionDataset
from src.models.classifier import CorruptionClassifier
from src.training.common import set_seed, get_device, make_manifest_loader

DEFAULT_CFG = dict(lr=1e-3, batch_size=32, channels="medium", dropout=0.3, weight_decay=1e-4)


def cls_metrics(y_true, y_pred):
    acc = accuracy_score(y_true, y_pred)
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    pp, rr, ff, sup = precision_recall_fscore_support(y_true, y_pred, labels=[0, 1, 2, 3], zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2, 3], normalize="true")
    return {"accuracy": float(acc), "macro_precision": float(p), "macro_recall": float(r),
            "macro_f1": float(f),
            "per_class": {CLASS_NAMES[i]: {"precision": float(pp[i]), "recall": float(rr[i]),
                                           "f1": float(ff[i]), "support": int(sup[i])} for i in range(4)},
            "confusion_normalized": cm.tolist()}


@torch.no_grad()
def predict_all(model, loader, dev):
    model.eval(); ys, ps = [], []
    for x, _, lab in loader:
        ps.append(model(x.to(dev)).argmax(1).cpu()); ys.append(lab)
    return torch.cat(ys).numpy(), torch.cat(ps).numpy()


def train_cls(cfg, epochs, run_name, trial=None, use_wandb=True, save=False,
              group=None, num_workers=2):
    set_seed(42); dev = get_device()
    model = CorruptionClassifier(cfg["channels"], cfg["dropout"]).to(dev)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=cfg["lr"], weight_decay=cfg["weight_decay"])
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    crit = nn.CrossEntropyLoss()

    imgs, idx = load_pets("train")
    train_loader = DataLoader(BalancedCorruptionDataset(imgs, idx), batch_size=cfg["batch_size"],
                              shuffle=False, drop_last=True, num_workers=num_workers,
                              persistent_workers=num_workers > 0)
    val_loader, _ = make_manifest_loader("val", 64, num_workers)
    _, _, l0 = next(iter(train_loader))
    print("first batch class counts [clean, salt, blur, occ]:", torch.bincount(l0, minlength=4).tolist())

    run = None
    if use_wandb:
        import wandb
        run = wandb.init(project="genai-a1-restoration", name=run_name, group=group,
                         config={**cfg, "epochs": epochs, "params": n_params, "task": "task2_classifier"},
                         reinit="finish_previous")
    save_dir = CKPT_ROOT / "task2"
    best, best_m, best_pred = -1.0, None, None

    for ep in range(epochs):
        model.train(); tl, tc, n = 0.0, 0, 0
        for x, _, lab in train_loader:
            x, lab = x.to(dev), lab.to(dev)
            logits = model(x); loss = crit(logits, lab)
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            tl += loss.item() * x.size(0); tc += (logits.argmax(1) == lab).sum().item(); n += x.size(0)
        sched.step()

        yt, yp = predict_all(model, val_loader, dev)
        m = cls_metrics(yt, yp)
        log = {"epoch": ep, "train/loss": tl / n, "train/acc": tc / n, "val/acc": m["accuracy"],
               "val/macro_f1": m["macro_f1"], "val/macro_precision": m["macro_precision"],
               "val/macro_recall": m["macro_recall"]}
        for k, v in m["per_class"].items():
            log[f"val/f1_{k}"] = v["f1"]
        if run: run.log(log)
        print(f"ep {ep:3d} | loss {tl/n:.4f} train acc {tc/n:.3f} | val acc {m['accuracy']:.3f} "
              f"macro-F1 {m['macro_f1']:.3f}")

        if m["macro_f1"] > best:
            best, best_m, best_pred = m["macro_f1"], m, (yt, yp)
            if save:
                save_dir.mkdir(parents=True, exist_ok=True)
                torch.save({"cfg": cfg, "state_dict": model.state_dict(), "epoch": ep,
                            "macro_f1": best}, save_dir / "classifier.pt")
        if trial is not None:
            import optuna
            trial.report(m["macro_f1"], ep)
            if trial.should_prune():
                if run: run.finish()
                raise optuna.TrialPruned()

    if save:
        json.dump(best_m, open(save_dir / "classifier_val_metrics.json", "w"), indent=2)
    if run:
        import wandb
        run.summary.update({"best_macro_f1": best, "params": n_params})
        run.log({"val/confusion_matrix": wandb.plot.confusion_matrix(
            y_true=best_pred[0].tolist(), preds=best_pred[1].tolist(), class_names=CLASS_NAMES)})
        if save:
            art = wandb.Artifact("task2-classifier", type="model")
            art.add_file(str(save_dir / "classifier.pt")); run.log_artifact(art)
        run.finish()
    return best


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--run_name", default="task2-classifier")
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()
    cfg = dict(DEFAULT_CFG)
    if a.config:
        cfg.update(json.load(open(a.config)))
    print("config:", cfg)
    print("best macro-F1:", train_cls(cfg, a.epochs, a.run_name, use_wandb=not a.no_wandb,
                                      save=True, num_workers=a.workers))
