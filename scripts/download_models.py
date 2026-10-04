"""Download the 7 ONNX models into ./models (GitHub release first, Google Drive as backup)"""
import subprocess, sys, urllib.request
from pathlib import Path

RELEASE = "https://github.com/Maryam-Faatima/genai-restoration-sketch-studio/releases/download/v1.0/"
DRIVE = "https://drive.google.com/drive/folders/13eGF6sR4aGR4N7InPVb21RzuSDKLAre3"
NEEDED = ["task1_universal.onnx", "task2_classifier.onnx", "task2_spec_salt.onnx",
          "task2_spec_blur.onnx", "task2_spec_occ.onnx", "task3_softmoe.onnx",
          "task4_generator.onnx"]
out = Path("models"); out.mkdir(exist_ok=True)

def missing():
    return [f for f in NEEDED if not (out / f).exists() or (out / f).stat().st_size == 0]

for f in missing():
    try:
        print("downloading", f)
        urllib.request.urlretrieve(RELEASE + f, out / f)
    except Exception as e:
        print("release failed for", f, "-", e)
        (out / f).unlink(missing_ok=True)

if missing():
    print("Trying Google Drive backup ...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "gdown"])
        import gdown
        gdown.download_folder(DRIVE, output=str(out), quiet=False, use_cookies=False)
    except Exception as e:
        print("Drive backup failed:", e)

m = missing()
print("All 7 models present." if not m else f"MISSING: {m}")
sys.exit(1 if m else 0)
