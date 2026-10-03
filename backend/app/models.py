"""ONNX model registry: loads the seven inference models once and times every call."""
import os
import time
from pathlib import Path
import numpy as np
import onnxruntime as ort

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "models"))
FILES = {
    "universal": "task1_universal.onnx",
    "classifier": "task2_classifier.onnx",
    "salt": "task2_spec_salt.onnx",
    "blur": "task2_spec_blur.onnx",
    "occlusion": "task2_spec_occ.onnx",
    "softmoe": "task3_softmoe.onnx",
    "generator": "task4_generator.onnx",
}


class Registry:
    def __init__(self, model_dir=MODEL_DIR):
        self.dir = Path(model_dir)
        self.sessions, self.errors = {}, {}

    def load(self):
        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        for key, fname in FILES.items():
            path = self.dir / fname
            if not path.exists():
                self.errors[key] = f"missing file {path}"
                continue
            try:
                self.sessions[key] = ort.InferenceSession(str(path), opts,
                                                          providers=["CPUExecutionProvider"])
            except Exception as e:                                   # corrupt / incompatible file
                self.errors[key] = f"{type(e).__name__}: {e}"

    def ready(self, *keys):
        return all(k in self.sessions for k in keys)

    def run(self, key, **feeds):
        """Returns (list of output arrays, milliseconds spent inside ONNX Runtime)."""
        sess = self.sessions[key]
        t0 = time.perf_counter()
        out = sess.run(None, feeds)
        return out, (time.perf_counter() - t0) * 1000.0
