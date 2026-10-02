import argparse, json, os
import optuna
from src.config import CKPT_ROOT
from src.training.common import study_storage
from src.training.train_cls import train_cls


def make_objective(epochs, use_wandb, workers):
    def objective(trial):
        cfg = {"lr": trial.suggest_float("lr", 3e-4, 3e-3, log=True),
               "batch_size": trial.suggest_categorical("batch_size", [16, 32, 64]),
               "channels": trial.suggest_categorical("channels", ["small", "medium", "large"]),
               "dropout": round(trial.suggest_float("dropout", 0.0, 0.5, step=0.1), 2),
               "weight_decay": trial.suggest_float("weight_decay", 1e-6, 1e-2, log=True)}
        return train_cls(cfg, epochs, f"t2cls-trial{trial.number}", trial=trial,
                         use_wandb=use_wandb, group="task2-cls-optuna", num_workers=workers)
    return objective


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_trials", type=int, default=15)
    ap.add_argument("--epochs", type=int, default=10)
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()

    url, sync = study_storage("task2_cls")
    study = optuna.create_study(study_name="task2_cls", direction="maximize", storage=url,
                                load_if_exists=True, sampler=optuna.samplers.TPESampler(seed=42),
                                pruner=optuna.pruners.MedianPruner(n_startup_trials=4, n_warmup_steps=2))
    study.optimize(make_objective(a.epochs, not a.no_wandb, a.workers),
                   n_trials=a.n_trials, callbacks=[sync])
    done = [t for t in study.trials if t.state.name == "COMPLETE"]
    pruned = [t for t in study.trials if t.state.name == "PRUNED"]
    print(f"\ncompleted {len(done)} | pruned {len(pruned)} | total {len(study.trials)}")
    print("best macro-F1:", study.best_value, "\nbest params:", study.best_params)

    os.makedirs("configs", exist_ok=True)
    best = dict(study.best_params); best["dropout"] = round(best["dropout"], 2)
    json.dump(best, open("configs/task2_cls_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv("configs/task2_cls_optuna_trials.csv", index=False)
    out = CKPT_ROOT / "task2"; out.mkdir(parents=True, exist_ok=True)
    json.dump(best, open(out / "task2_cls_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv(out / "task2_cls_optuna_trials.csv", index=False)
