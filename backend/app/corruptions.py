"""Numpy/OpenCV re-implementation of the training corruptions (src/data/corruptions.py).

The backend does not need PyTorch. Parameters, rectangle sampling and the fixed test severity
levels are identical to the ones used for the test manifest.
"""
import math
import cv2
import numpy as np

SIZE = 128
CORRUPTIONS = ["salt_pepper", "blur", "occlusion"]
SEVERITIES = ["low", "medium", "high"]
SALT_P = [0.03, 0.08, 0.15]
BLUR = [(3, 0.7), (5, 1.5), (7, 2.5)]            # (kernel, sigma)
OCC = [(1, 0.10), (2, 0.20), (3, 0.35)]          # (n_rects, area fraction)


def _overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw <= bx or bx + bw <= ax or ay + ah <= by or by + bh <= ay)


def coverage(rects, size=SIZE):
    m = np.zeros((size, size), dtype=bool)
    for x, y, w, h in rects:
        m[y:y + h, x:x + w] = True
    return float(m.mean())


def make_rects(rng, n, frac, size=SIZE, max_tries=300):
    total = frac * size * size
    rects = []
    for _ in range(max_tries):
        shares = rng.dirichlet(np.full(n, 4.0)) if n > 1 else np.array([1.0])
        rects = []
        for s in shares:
            area = s * total
            ar = math.exp(rng.uniform(math.log(0.5), math.log(2.0)))
            w = min(max(int(round(math.sqrt(area * ar))), 1), size)
            h = min(max(int(round(area / w)), 1), size)
            rects.append([int(rng.integers(0, size - w + 1)), int(rng.integers(0, size - h + 1)), w, h])
        if not any(_overlap(rects[i], rects[j]) for i in range(n) for j in range(i + 1, n)):
            break
    return rects


def apply_corruption(img_u8, ctype, severity, seed):
    """img_u8: uint8 (128,128,3). Returns (corrupted uint8 image, settings dict)."""
    level = SEVERITIES.index(severity)
    img = img_u8.astype(np.float32) / 255.0
    rng = np.random.default_rng(seed)
    if ctype == "salt_pepper":
        p = SALT_P[level]
        sel = rng.random((SIZE, SIZE)) < p
        white = rng.random((SIZE, SIZE)) < 0.5
        img[sel & white] = 1.0
        img[sel & ~white] = 0.0
        info = {"probability": p}
    elif ctype == "blur":
        k, s = BLUR[level]
        img = np.clip(cv2.GaussianBlur(img, (k, k), s, borderType=cv2.BORDER_REFLECT_101), 0, 1)
        info = {"kernel": k, "sigma": s}
    elif ctype == "occlusion":
        n, frac = OCC[level]
        rects = make_rects(rng, n, frac)
        for x, y, w, h in rects:
            img[y:y + h, x:x + w] = 0.0
        info = {"rectangles": n, "target_area": frac, "actual_area": round(coverage(rects), 4),
                "boxes": rects}
    else:
        raise ValueError(ctype)
    out = np.clip(np.rint(img * 255.0), 0, 255).astype(np.uint8)
    return out, {"type": ctype, "severity": severity, "seed": int(seed), **info}
