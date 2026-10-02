import json, math
import numpy as np
from src.config import MANIFEST_DIR
from src.data.corruptions import (CLASS_NAMES, SEVERITY_NAMES, sample_params,
                                  fixed_params, severity_bin)
from src.data.pets import load_pets


def build_val(val_indices, seed=42):
    rng = np.random.default_rng(seed)
    n = len(val_indices)
    types = np.tile(np.arange(4), math.ceil(n / 4))[:n]   # exactly balanced
    rng.shuffle(types)
    out = []
    for k, (idx, t) in enumerate(zip(val_indices, types)):
        r = np.random.default_rng([seed, int(idx), int(t)])
        p = sample_params(r, CLASS_NAMES[int(t)])
        out.append({"id": k, "img_idx": int(idx), "label": int(t),
                    "type": CLASS_NAMES[int(t)], "severity": severity_bin(p),
                    "params": p})
    return out


def build_test(n_images, seed=4242):
    out = []
    for idx in range(n_images):
        out.append({"id": len(out), "img_idx": idx, "label": 0, "type": "clean",
                    "severity": "none", "params": {"type": "clean"}})
        for t in (1, 2, 3):
            for lvl in range(3):
                r = np.random.default_rng([seed, idx, t, lvl])
                p = fixed_params(r, CLASS_NAMES[t], lvl)
                out.append({"id": len(out), "img_idx": idx, "label": t,
                            "type": CLASS_NAMES[t], "severity": SEVERITY_NAMES[lvl],
                            "params": p})
    return out


if __name__ == "__main__":
    MANIFEST_DIR.mkdir(exist_ok=True)
    _, val_idx = load_pets("val")
    test_imgs, _ = load_pets("test")
    val_m, test_m = build_val(val_idx), build_test(len(test_imgs))
    json.dump(val_m, open(MANIFEST_DIR / "val_manifest.json", "w"))
    json.dump(test_m, open(MANIFEST_DIR / "test_manifest.json", "w"))
    print("val entries:", len(val_m), "| test entries:", len(test_m))
