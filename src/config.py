import os
from pathlib import Path

DATA_ROOT = Path(os.environ.get("DATA_ROOT", "data"))
CKPT_ROOT = Path(os.environ.get("CKPT_ROOT", "checkpoints"))
MANIFEST_DIR = Path("manifests")  # committed to the repo

IMG_SIZE = 128
SEED = 42
