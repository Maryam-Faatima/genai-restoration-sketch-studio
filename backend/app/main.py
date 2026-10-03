"""FastAPI backend: validation, preprocessing, ONNX inference, routing/timing information."""
import base64
import io
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from starlette.concurrency import run_in_threadpool

from .corruptions import CORRUPTIONS, SEVERITIES, apply_corruption
from .models import FILES, Registry

SIZE = 128
MAX_BYTES = 10 * 1024 * 1024
CLASSES = ["clean", "salt_pepper", "blur", "occlusion"]       # classifier output order
BRANCHES = ["identity", "salt_pepper", "blur", "occlusion"]   # soft-MoE weight order
EXPERT_KEYS = ["salt", "blur", "occlusion"]
STYLES = ["Style 1", "Style 2", "Style 3"]
SAMPLES_DIR = Path(os.environ.get("SAMPLES_DIR", "samples"))

registry = Registry()


@asynccontextmanager
async def lifespan(_):
    registry.load()
    yield


app = FastAPI(title="Restoration & Sketch Studio API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


# ------------------------------------------------------------------ helpers
def png_url(arr):
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


async def load_image(file: UploadFile):
    """Validate and decode an upload -> uint8 (128,128,3), resized exactly like the training data."""
    data = await file.read(MAX_BYTES + 1)
    if not data:
        raise HTTPException(400, "Empty file.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 10 MB).")
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        img.load()
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        raise HTTPException(400, "Could not decode the file as an image.")
    if fmt not in ("PNG", "JPEG", "WEBP"):
        raise HTTPException(415, "Unsupported image type. Use PNG, JPEG or WEBP.")
    return np.asarray(img.resize((SIZE, SIZE), Image.BICUBIC))


def need(*keys):
    if not registry.ready(*keys):
        raise HTTPException(503, f"Model not loaded: {', '.join(k for k in keys if k not in registry.sessions)}. "
                                 f"See /api/health.")


def to_input(u8):                                  # (128,128,3) uint8 -> (1,3,128,128) float32 [0,1]
    return np.ascontiguousarray(u8.astype(np.float32).transpose(2, 0, 1)[None] / 255.0)


def to_u8(chw):                                    # (3,128,128) float [0,1] -> (128,128,3) uint8
    return np.clip(np.rint(chw.transpose(1, 2, 0) * 255.0), 0, 255).astype(np.uint8)


def psnr(a, b):
    mse = float(np.mean((a.astype(np.float64) - b.astype(np.float64)) ** 2))
    return 50.0 if mse < 1e-10 else round(min(50.0, 10 * np.log10(255.0 ** 2 / mse)), 2)


def prepare(original, corruption, severity, seed):
    """Returns (model input uint8, settings dict, true label index or None)."""
    if severity not in SEVERITIES:
        raise HTTPException(422, f"severity must be one of {SEVERITIES}")
    if corruption in CORRUPTIONS:
        seed = secrets.randbelow(2 ** 31 - 1) if seed is None else seed
        x, settings = apply_corruption(original, corruption, severity, seed)
        return x, settings, CLASSES.index(corruption)
    if corruption == "clean":
        return original, {"type": "clean"}, 0
    if corruption == "uploaded":
        return original, {"type": "uploaded", "note": "image used as supplied; corruption unknown"}, None
    raise HTTPException(422, f"corruption must be one of uploaded, clean, {', '.join(CORRUPTIONS)}")


def common(original, x, settings, label, restored):
    out = {"input": png_url(x), "restored": png_url(restored), "corruption": settings,
           "original": png_url(original) if label is not None else None}
    if label is not None:                          # ground truth known -> report quality
        out["psnr"] = {"input": psnr(x, original), "restored": psnr(restored, original)}
    return out


# ------------------------------------------------------------------ endpoints
@app.get("/api/health")
def health():
    models = {k: "loaded" if k in registry.sessions else registry.errors.get(k, "not loaded") for k in FILES}
    return {"status": "ok" if len(registry.sessions) == len(FILES) else "degraded", "models": models,
            "onnxruntime": ort.__version__, "providers": ort.get_available_providers(),
            "model_dir": str(registry.dir)}


@app.get("/api/samples")
def samples():
    if not SAMPLES_DIR.is_dir():
        return {"samples": []}
    names = sorted(p.name for p in SAMPLES_DIR.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    return {"samples": [{"name": n, "url": f"/api/samples/{n}"} for n in names]}


@app.get("/api/samples/{name}")
def sample_file(name: str):
    p = (SAMPLES_DIR / name).resolve()
    if p.parent != SAMPLES_DIR.resolve() or not p.is_file():
        raise HTTPException(404, "Sample not found.")
    return FileResponse(p)


@app.post("/api/universal")
async def universal(image: UploadFile = File(...), corruption: str = Form("uploaded"),
                    severity: str = Form("medium"), seed: Optional[int] = Form(None)):
    need("universal")
    original = await load_image(image)
    x, settings, label = prepare(original, corruption, severity, seed)
    (out,), ms = await run_in_threadpool(registry.run, "universal", image=to_input(x))
    res = common(original, x, settings, label, to_u8(out[0]))
    res["inference_ms"] = round(ms, 1)
    return res


@app.post("/api/hard")
async def hard(image: UploadFile = File(...), corruption: str = Form("uploaded"),
               severity: str = Form("medium"), seed: Optional[int] = Form(None),
               routing: str = Form("predicted")):
    need("classifier", *EXPERT_KEYS)
    if routing not in ("predicted", "oracle"):
        raise HTTPException(422, "routing must be 'predicted' or 'oracle'")
    original = await load_image(image)
    x, settings, label = prepare(original, corruption, severity, seed)
    if routing == "oracle" and label is None:
        raise HTTPException(400, "Oracle routing needs a known corruption: choose clean, salt_pepper, blur or occlusion.")
    inp = to_input(x)
    (probs,), t_cls = await run_in_threadpool(registry.run, "classifier", image=inp)
    probs = probs[0]
    pred = int(np.argmax(probs))
    idx = label if routing == "oracle" else pred
    if idx == 0:                                   # clean -> identity bypass, no expert is run
        restored, t_exp, expert = x, 0.0, "identity bypass"
    else:
        (out,), t_exp = await run_in_threadpool(registry.run, EXPERT_KEYS[idx - 1], image=inp)
        restored, expert = to_u8(out[0]), f"{CLASSES[idx]} specialist"
    res = common(original, x, settings, label, restored)
    res.update({"routing": routing, "probabilities": {c: round(float(p), 4) for c, p in zip(CLASSES, probs)},
                "predicted": CLASSES[pred], "expert": expert,
                "correct": None if label is None else pred == label,
                "inference_ms": round(t_cls + t_exp, 1),
                "timing_ms": {"classifier": round(t_cls, 1), "expert": round(t_exp, 1)}})
    return res


@app.post("/api/soft")
async def soft(image: UploadFile = File(...), corruption: str = Form("uploaded"),
               severity: str = Form("medium"), seed: Optional[int] = Form(None)):
    need("softmoe")
    original = await load_image(image)
    x, settings, label = prepare(original, corruption, severity, seed)
    (out, w), ms = await run_in_threadpool(registry.run, "softmoe", image=to_input(x))
    w = w[0]
    res = common(original, x, settings, label, to_u8(out[0]))
    res.update({"weights": {b: round(float(v), 4) for b, v in zip(BRANCHES, w)},
                "dominant": BRANCHES[int(np.argmax(w))],
                "contributing": [b for b, v in zip(BRANCHES, w) if v >= 0.10],
                "inference_ms": round(ms, 1)})
    return res


@app.post("/api/sketch")
async def sketch(photo: UploadFile = File(...), style: int = Form(1)):
    need("generator")
    if style not in (1, 2, 3):
        raise HTTPException(422, "style must be 1, 2 or 3")
    img = await load_image(photo)
    x = np.ascontiguousarray(img.astype(np.float32).transpose(2, 0, 1)[None] / 127.5 - 1.0)   # [-1,1]
    (out,), ms = await run_in_threadpool(registry.run, "generator", photo=x,
                                         style=np.array([style - 1], dtype=np.int64))
    s = np.clip(np.rint((np.clip(out[0, 0], -1, 1) + 1) / 2 * 255.0), 0, 255).astype(np.uint8)
    return {"photo": png_url(img), "sketch": png_url(s), "style": STYLES[style - 1],
            "inference_ms": round(ms, 1)}
