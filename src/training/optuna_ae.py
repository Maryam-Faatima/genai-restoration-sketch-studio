import argparse, json
import optuna
from src.config import CKPT_ROOT
from src.training.common import study_storage
from src.training.train_ae import train


def make_objective(epochs, use_wandb, workers):
    def objective(trial):
        cfg = {
            "lr": trial.suggest_float("lr", 1e-4, 3e-3, log=True),
            "batch_size": trial.suggest_categorical("batch_size", [16, 32, 64]),
            "bottleneck": trial.suggest_categorical("bottleneck", [64, 128, 256, 512]),
            "base": trial.suggest_categorical("base", [16, 32, 48, 64]),
            "dropout": trial.suggest_float("dropout", 0.0, 0.4, step=0.1),
            "alpha": trial.suggest_float("alpha", 0.5, 0.95, step=0.05),
        }
        return train(cfg, epochs, f"t1-trial{trial.number}", trial=trial,
                     use_wandb=use_wandb, group="task1-optuna", num_workers=workers)
    return objective


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_trials", type=int, default=20)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()

    url, sync = study_storage("task1_ae")
    study = optuna.create_study(
        study_name="task1_ae", direction="maximize", storage=url, load_if_exists=True,
        sampler=optuna.samplers.TPESampler(seed=42),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=2))
    study.optimize(make_objective(a.epochs, not a.no_wandb, a.workers),
                   n_trials=a.n_trials, callbacks=[sync])

    done = [t for t in study.trials if t.state.name == "COMPLETE"]
    pruned = [t for t in study.trials if t.state.name == "PRUNED"]
    print(f"\ncompleted {len(done)} | pruned {len(pruned)} | total {len(study.trials)}")
    print("best score:", study.best_value, "\nbest params:", study.best_params)

    import os
    os.makedirs("configs", exist_ok=True)
    json.dump(study.best_params, open("configs/task1_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv("configs/task1_optuna_trials.csv", index=False)
    out = CKPT_ROOT / "task1"; out.mkdir(parents=True, exist_ok=True)
    json.dump(study.best_params, open(out / "task1_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv(out / "task1_optuna_trials.csv", index=False)
