import json
import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
from torchvision.datasets import OxfordIIITPet
from tqdm import tqdm
from src.config import DATA_ROOT, IMG_SIZE, SEED


def build(split):
    ds = OxfordIIITPet(root=str(DATA_ROOT / "raw"), split=split, download=True)
    arr = np.zeros((len(ds), IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
    for i in tqdm(range(len(ds)), desc=split):
        img, _ = ds[i]
        arr[i] = np.asarray(img.convert("RGB").resize((IMG_SIZE, IMG_SIZE), Image.BICUBIC))
    return arr


if __name__ == "__main__":
    out = DATA_ROOT / "pets"
    out.mkdir(parents=True, exist_ok=True)
    trainval = build("trainval")   # official train+val
    test = build("test")           # official test: untouched until final eval
    np.save(out / "trainval.npy", trainval)
    np.save(out / "test.npy", test)

    idx = np.arange(len(trainval))
    tr, va = train_test_split(idx, test_size=0.2, random_state=SEED, shuffle=True)
    with open(out / "split.json", "w") as f:
        json.dump({"train": tr.tolist(), "val": va.tolist(), "seed": SEED}, f)
    print("trainval", trainval.shape, "test", test.shape,
          "| train", len(tr), "val", len(va))
