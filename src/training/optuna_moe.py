import argparse, json, os
import optuna
from src.config import CKPT_ROOT
from src.training.common import study_storage
from src.training.train_moe import train_moe


def make_objective(warm, joint, use_wandb, workers):
    def objective(trial):
        cfg = {"lr_joint": trial.suggest_float("lr_joint", 1e-5, 2e-4, log=True),
               "T": trial.suggest_float("T", 0.5, 3.0),
               "lam_cls": trial.suggest_float("lam_cls", 0.01, 1.0, log=True),
               "lam_bal": trial.suggest_float("lam_bal", 1e-3, 0.5, log=True),
               "alpha": round(trial.suggest_float("alpha", 0.5, 0.95, step=0.05), 2),
               "batch_size": 32}
        return train_moe(cfg, warm, joint, f"t3-trial{trial.number}", trial=trial,
                         use_wandb=use_wandb, group="task3-optuna", num_workers=workers)
    return objective


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_trials", type=int, default=10)
    ap.add_argument("--warm_epochs", type=int, default=1)
    ap.add_argument("--joint_epochs", type=int, default=4)
    ap.add_argument("--no_wandb", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()

    url, sync = study_storage("task3_moe")
    study = optuna.create_study(study_name="task3_moe", direction="maximize", storage=url,
                                load_if_exists=True, sampler=optuna.samplers.TPESampler(seed=42),
                                pruner=optuna.pruners.MedianPruner(n_startup_trials=3, n_warmup_steps=1))
    study.optimize(make_objective(a.warm_epochs, a.joint_epochs, not a.no_wandb, a.workers),
                   n_trials=a.n_trials, callbacks=[sync])
    done = [t for t in study.trials if t.state.name == "COMPLETE"]
    pruned = [t for t in study.trials if t.state.name == "PRUNED"]
    print(f"\ncompleted {len(done)} | pruned {len(pruned)} | total {len(study.trials)}")
    print("best score:", study.best_value, "\nbest params:", study.best_params)

    best = dict(study.best_params); best["alpha"] = round(best["alpha"], 2); best["batch_size"] = 32
    os.makedirs("configs", exist_ok=True)
    json.dump(best, open("configs/task3_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv("configs/task3_optuna_trials.csv", index=False)
    out = CKPT_ROOT / "task3"; out.mkdir(parents=True, exist_ok=True)
    json.dump(best, open(out / "task3_best.json", "w"), indent=2)
    study.trials_dataframe().to_csv(out / "task3_optuna_trials.csv", index=False)
