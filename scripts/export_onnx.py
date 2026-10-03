"""Export every inference model to ONNX and verify it against PyTorch.

Value ranges (must be mirrored by the backend):
  Tasks 1-3 : input RGB float32 in [0,1], shape (N,3,128,128)
  Task 4    : photo float32 in [-1,1] (N,3,128,128), style int64 (N,) in {0,1,2}; output [-1,1]
"""
import json, time
import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn as nn
from src.config import CKPT_ROOT
from src.data.fs2k import FS2KDataset
from src.models.autoencoder import build_ae
from src.models.cgan import UNetGenerator
from src.models.classifier import CorruptionClassifier
from src.models.softmoe import load_softmoe
from src.training.common import make_manifest_loader

OPSET = 17
OUT = CKPT_ROOT / "onnx"; OUT.mkdir(parents=True, exist_ok=True)
T1, T2, T3, T4 = (CKPT_ROOT / f"task{i}" for i in (1, 2, 3, 4))


class AEWrap(nn.Module):                      # restored image clamped to [0,1]
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, x): return self.m(x).clamp(0, 1)


class ClsWrap(nn.Module):                     # classifier -> 4 probabilities
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, x): return torch.softmax(self.m(x), dim=1)


class MoEWrap(nn.Module):                     # complete soft-MoE pipeline: (restored, weights)
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, x):
        out, w, _ = self.m(x, return_all=True)
        return out.clamp(0, 1), w


class GenWrap(nn.Module):
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, photo, style): return self.m(photo, style)


def export(name, model, inputs, in_names, out_names, tol):
    model.eval()
    path = OUT / f"{name}.onnx"
    kw = dict(input_names=in_names, output_names=out_names, opset_version=OPSET,
              dynamic_axes={n: {0: "batch"} for n in in_names + out_names},
              do_constant_folding=True)
    try:
        torch.onnx.export(model, inputs, str(path), dynamo=False, **kw)
    except TypeError:                          # older torch has no `dynamo` argument
        torch.onnx.export(model, inputs, str(path), **kw)
    onnx.checker.check_model(onnx.load(str(path)))

    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    with torch.no_grad():
        ref = model(*inputs)
    ref = list(ref) if isinstance(ref, (tuple, list)) else [ref]
    feeds = {n: t.numpy() for n, t in zip(in_names, inputs)}
    got = sess.run(None, feeds)
    diffs = [float(np.abs(r.numpy() - g).max()) for r, g in zip(ref, got)]

    one = sess.run(None, {n: t[:1].numpy() for n, t in zip(in_names, inputs)})   # dynamic batch
    batch1 = float(np.abs(ref[0][:1].numpy() - one[0]).max())

    t0 = time.perf_counter()                                                      # batch-1 latency
    for _ in range(10):
        sess.run(None, {n: t[:1].numpy() for n, t in zip(in_names, inputs)})
    ms = (time.perf_counter() - t0) / 10 * 1000

    res = {"file": path.name, "size_mb": round(path.stat().st_size / 1e6, 2),
           "max_abs_diff": dict(zip(out_names, diffs)), "max_abs_diff_batch1": batch1,
           "cpu_ms_per_image": round(ms, 1), "tolerance": tol,
           "pass": bool(max(diffs + [batch1]) < tol)}
    if name == "task2_classifier":
        res["argmax_agreement"] = float((ref[0].argmax(1).numpy() == got[0].argmax(1)).mean())
    if name == "task3_softmoe":
        res["weights_sum_to_1"] = bool(np.allclose(got[1].sum(1), 1.0, atol=1e-5))
    print(f"{name:18s} {res['size_mb']:6.1f} MB | max|diff| {max(diffs):.2e} | "
          f"batch1 {batch1:.2e} | {ms:5.1f} ms/img | {'PASS' if res['pass'] else 'FAIL'}")
    return res


if __name__ == "__main__":
    torch.manual_seed(0)
    loader, _ = make_manifest_loader("test", 8, 0)       # real corrupted test images
    xc, _, _ = next(iter(loader))
    ds = FS2KDataset("test")                             # real FS2K test photos
    photo = ds.photo[:8].float() / 127.5 - 1
    style = ds.style[:8].long()

    results = {}
    ck = torch.load(T1 / "best.pt", map_location="cpu")
    ae = build_ae(ck["cfg"]); ae.load_state_dict(ck["state_dict"])
    results["task1_universal"] = export("task1_universal", AEWrap(ae), (xc,),
                                        ["image"], ["restored"], 1e-3)

    ck = torch.load(T2 / "classifier.pt", map_location="cpu")
    clf = CorruptionClassifier(ck["cfg"]["channels"], ck["cfg"]["dropout"])
    clf.load_state_dict(ck["state_dict"])
    results["task2_classifier"] = export("task2_classifier", ClsWrap(clf), (xc,),
                                         ["image"], ["probs"], 1e-4)

    for nm in ("salt", "blur", "occ"):
        s = torch.load(T2 / f"spec_{nm}.pt", map_location="cpu")
        m = build_ae(s["cfg"]); m.load_state_dict(s["state_dict"])
        results[f"task2_spec_{nm}"] = export(f"task2_spec_{nm}", AEWrap(m), (xc,),
                                             ["image"], ["restored"], 1e-3)

    moe, _ = load_softmoe(T3 / "softmoe.pt", "cpu")
    results["task3_softmoe"] = export("task3_softmoe", MoEWrap(moe), (xc,),
                                      ["image"], ["restored", "weights"], 1e-3)

    ck = torch.load(T4 / "generator.pt", map_location="cpu")
    c = ck["cfg"]
    G = UNetGenerator(c["base"], c["emb_dim"], c["dropout"]); G.load_state_dict(ck["state_dict"])
    results["task4_generator"] = export("task4_generator", GenWrap(G), (photo, style),
                                        ["photo", "style"], ["sketch"], 1e-3)

    json.dump(results, open(OUT / "onnx_consistency.json", "w"), indent=2)
    print("\nALL PASS" if all(r["pass"] for r in results.values()) else "\nSOME FAILED")
    print("saved to", OUT)
