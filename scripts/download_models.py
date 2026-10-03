"""Download the 7 ONNX models from the shared Drive folder into ./models"""
import subprocess, sys
from pathlib import Path

URL = "https://drive.google.com/drive/folders/13eGF6sR4aGR4N7InPVb21RzuSDKLAre3"
NEEDED = ["task1_universal.onnx", "task2_classifier.onnx", "task2_spec_salt.onnx",
          "task2_spec_blur.onnx", "task2_spec_occ.onnx", "task3_softmoe.onnx",
          "task4_generator.onnx"]

subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "gdown"])
import gdown
gdown.download_folder(URL, output="models", quiet=False, use_cookies=False)

missing = [f for f in NEEDED if not (Path("models") / f).exists()]
print("All 7 models present." if not missing else f"MISSING: {missing}")
sys.exit(1 if missing else 0)
