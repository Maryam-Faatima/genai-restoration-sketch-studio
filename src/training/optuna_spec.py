import argparse, json, os
import optuna
from src.config import CKPT_ROOT
from src.training.common import study_storage
from src.training.train_spec import train_spec


def make_objective(epochs, use_wandb, workers):
    def objective(trial):
        cfg = {"lr": trial.suggest_float("lr", 1e-4, 2e-3, log=True),
               "batch_size": trial.suggest_categorical("batch_size", [16, 32, 64]),
               "base": trial.suggest_categorical("base", [16, 32, 48, 64]),
               "latent_ch": trial.suggest_categorical("latent_ch", [4, 8, 16, 32]),
               "alpha": round(trial.suggest_float("alpha", 0.5, 0.95, step=0.05), 2),
               "dropout": 0.1}
        # shared search: one autoencoder trained on the union of the three corruptions (proxy)
        return train_spec(cfg, [1, 2, 3], epochs, f"t2spec-trial{trial.number}", trial=trial,
                          use_wandb=use_wandb, group="task2-spec-optuna", num_workers=workers)
    return objective


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_trials", type=int, default=12)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()

    url, sync = study_storage("task2_spec_v2")
    study = optuna.create_study(study_name="task2_spec_v2", direction="maximize", storage=url,
                                load_if_exists=True, sampler=optuna.samplers.TPESampler(seed=42),
                                pruner=optuna.pruners.MedianPruner(n_startup_trials=4, n_warmup_steps=2))
    study.optimize(make_objective(a.epochs, not a.no_wandb, a.workers),
                   n_trials=a.n_trials, callbacks=[sync])
    done = [t for t in study.trials if t.state.name == "COMPLETE"]
    pruned = [t for t in study.trials if t.state.name == "PRUNED"]
    print(f"\ncompleted {len(done)} | pruned {len(pruned)} | total {len(study.trials)}")
    print("best score:", study.best_value, "\nbest params:", study.best_params)

    os.makedirs("configs", exist_ok=True)
    best = dict(study.best_params); best["alpha"] = round(best["alpha"], 2); best["dropout"] = 0.1
    json.dump(best, open("configs/task2_spec_v2_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv("configs/task2_spec_v2_optuna_trials.csv", index=False)
    out = CKPT_ROOT / "task2"; out.mkdir(parents=True, exist_ok=True)
    json.dump(best, open(out / "task2_spec_v2_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv(out / "task2_spec_v2_optuna_trials.csv", index=False)
