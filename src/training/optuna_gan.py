import argparse, json, os
import optuna
from src.config import CKPT_ROOT
from src.training.common import study_storage
from src.training.train_gan import train_gan


def make_objective(epochs, use_wandb, workers):
    def objective(trial):
        cfg = {"lr_g": trial.suggest_float("lr_g", 1e-4, 1e-3, log=True),
               "lr_d": trial.suggest_float("lr_d", 5e-5, 5e-4, log=True),
               "batch_size": trial.suggest_categorical("batch_size", [8, 16, 32]),
               "base": trial.suggest_categorical("base", [32, 48, 64]),
               "dropout": round(trial.suggest_float("dropout", 0.0, 0.5, step=0.1), 2),
               "emb_dim": trial.suggest_categorical("emb_dim", [8, 16, 32]),
               "lambda_l1": float(trial.suggest_categorical("lambda_l1", [10, 25, 50, 100, 200]))}
        return train_gan(cfg, epochs, f"t4-trial{trial.number}", trial=trial,
                         use_wandb=use_wandb, group="task4-optuna", num_workers=workers)
    return objective


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_trials", type=int, default=12)
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()

    url, sync = study_storage("task4_gan")
    study = optuna.create_study(study_name="task4_gan", direction="maximize", storage=url,
                                load_if_exists=True, sampler=optuna.samplers.TPESampler(seed=42),
                                pruner=optuna.pruners.MedianPruner(n_startup_trials=4, n_warmup_steps=4))
    study.optimize(make_objective(a.epochs, not a.no_wandb, a.workers),
                   n_trials=a.n_trials, callbacks=[sync])

    done = [t for t in study.trials if t.state.name == "COMPLETE"]
    pruned = [t for t in study.trials if t.state.name == "PRUNED"]
    print(f"\ncompleted {len(done)} | pruned {len(pruned)} | total {len(study.trials)}")
    print("best val SSIM:", study.best_value, "\nbest params:", study.best_params)

    os.makedirs("configs", exist_ok=True)
    best = dict(study.best_params); best["dropout"] = round(best["dropout"], 2)
    json.dump(best, open("configs/task4_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv("configs/task4_optuna_trials.csv", index=False)
    out = CKPT_ROOT / "task4"; out.mkdir(parents=True, exist_ok=True)
    json.dump(best, open(out / "task4_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv(out / "task4_optuna_trials.csv", index=False)
