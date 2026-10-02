import math
import numpy as np
import torch
import torchvision.transforms.functional as TF

IMG_SIZE = 128
CLASS_NAMES = ["clean", "salt_pepper", "blur", "occlusion"]
CLASS_TO_IDX = {n: i for i, n in enumerate(CLASS_NAMES)}
SEVERITY_NAMES = ["low", "medium", "high"]

# Fixed test severities (from the assignment)
TEST_SALT_P = [0.03, 0.08, 0.15]
TEST_BLUR = [(3, 0.7), (5, 1.5), (7, 2.5)]          # (kernel, sigma)
TEST_OCC = [(1, 0.10), (2, 0.20), (3, 0.35)]        # (n_rects, area fraction)


# ---------- occlusion helpers ----------
def _overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw <= bx or bx + bw <= ax or ay + ah <= by or by + bh <= ay)


def rects_coverage(rects, size=IMG_SIZE):
    m = np.zeros((size, size), dtype=bool)
    for x, y, w, h in rects:
        m[y:y + h, x:x + w] = True
    return float(m.mean())


def make_rects(rng, n, target_frac, size=IMG_SIZE, max_tries=300):
    """n non-overlapping rectangles jointly covering ~target_frac of the image."""
    total = target_frac * size * size
    rects = None
    for _ in range(max_tries):
        shares = rng.dirichlet(np.full(n, 4.0)) if n > 1 else np.array([1.0])
        rects = []
        for s in shares:
            area = s * total
            ar = math.exp(rng.uniform(math.log(0.5), math.log(2.0)))  # aspect ratio
            w = int(round(math.sqrt(area * ar)))
            w = min(max(w, 1), size)
            h = min(max(int(round(area / w)), 1), size)
            x = int(rng.integers(0, size - w + 1))
            y = int(rng.integers(0, size - h + 1))
            rects.append([x, y, w, h])
        if not any(_overlap(rects[i], rects[j])
                   for i in range(n) for j in range(i + 1, n)):
            return rects
    return rects  # fallback (rare): overlapping, coverage measured separately


# ---------- parameter sampling ----------
def _seed(rng):
    return int(rng.integers(0, 2**31 - 1))


def sample_params(rng, ctype):
    """Random (training-style) parameters per the assignment table."""
    if ctype == "clean":
        return {"type": "clean"}
    if ctype == "salt_pepper":
        return {"type": ctype, "prob": float(rng.uniform(0.02, 0.15)), "seed": _seed(rng)}
    if ctype == "blur":
        return {"type": ctype, "kernel": int(rng.choice([3, 5, 7])),
                "sigma": float(rng.uniform(0.5, 2.5))}
    if ctype == "occlusion":
        n = int(rng.integers(1, 4))
        frac = float(rng.uniform(0.10, 0.35))
        rects = make_rects(rng, n, frac)
        return {"type": ctype, "n_rects": n, "target_frac": frac, "rects": rects,
                "actual_frac": rects_coverage(rects)}
    raise ValueError(ctype)


def fixed_params(rng, ctype, level):
    """Fixed test severities. level in {0,1,2} = low/medium/high."""
    if ctype == "salt_pepper":
        return {"type": ctype, "prob": TEST_SALT_P[level], "seed": _seed(rng)}
    if ctype == "blur":
        k, s = TEST_BLUR[level]
        return {"type": ctype, "kernel": k, "sigma": s}
    if ctype == "occlusion":
        n, frac = TEST_OCC[level]
        rects = make_rects(rng, n, frac)
        return {"type": ctype, "n_rects": n, "target_frac": frac, "rects": rects,
                "actual_frac": rects_coverage(rects)}
    raise ValueError(ctype)


def severity_bin(p):
    """Low/medium/high by thirds of the training range (used for the val manifest)."""
    t = p["type"]
    if t == "clean":
        return "none"
    if t == "salt_pepper":
        lo, hi, v = 0.02, 0.15, p["prob"]
    elif t == "blur":
        lo, hi, v = 0.5, 2.5, p["sigma"]
    else:
        lo, hi, v = 0.10, 0.35, p["actual_frac"]
    f = (v - lo) / (hi - lo)
    return SEVERITY_NAMES[0 if f < 1 / 3 else (1 if f < 2 / 3 else 2)]


# ---------- apply ----------
def apply_corruption(img, p):
    """img: float tensor (3,H,W) in [0,1]. Fully determined by params p."""
    t = p["type"]
    if t == "clean":
        return img
    out = img.clone()
    if t == "salt_pepper":
        g = np.random.default_rng(p["seed"])
        H, W = img.shape[1:]
        sel = g.random((H, W)) < p["prob"]
        white = g.random((H, W)) < 0.5
        out[:, torch.from_numpy(sel & white)] = 1.0
        out[:, torch.from_numpy(sel & ~white)] = 0.0
        return out
    if t == "blur":
        k = p["kernel"]
        return TF.gaussian_blur(out, [k, k], [p["sigma"], p["sigma"]]).clamp(0, 1)
    if t == "occlusion":
        for x, y, w, h in p["rects"]:
            out[:, y:y + h, x:x + w] = 0.0
        return out
    raise ValueError(t)
