import argparse, json, collections
from pathlib import Path
import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
from tqdm import tqdm
from src.config import DATA_ROOT, IMG_SIZE, SEED

EXTS = [".jpg", ".jpeg", ".png"]


def find(path_no_ext: Path):
    for e in EXTS:
        p = path_no_ext.with_suffix(e)
        if p.exists():
            return p
    return None


def load_split(root: Path, anno_file: str):
    annos = json.load(open(root / anno_file))
    photos, sketches, styles, names = [], [], [], []
    problems = collections.Counter()
    for a in tqdm(annos, desc=anno_file):
        folder, stem = a["image_name"].split("/")          # "photo1", "image0110"
        n = folder.replace("photo", "")                     # "1"
        num = stem.replace("image", "")                     # "0110"
        pp = find(root / "photo" / folder / stem)
        sp = find(root / "sketch" / f"sketch{n}" / f"sketch{num}")
        if pp is None or sp is None:
            problems["missing_file"] += 1
            continue
        if int(n) - 1 != a["style"]:
            problems["style_folder_mismatch"] += 1
        photos.append(np.asarray(Image.open(pp).convert("RGB").resize(
            (IMG_SIZE, IMG_SIZE), Image.BICUBIC)))
        sketches.append(np.asarray(Image.open(sp).convert("RGB").resize(
            (IMG_SIZE, IMG_SIZE), Image.BICUBIC)))
        styles.append(int(a["style"]))
        names.append(a["image_name"])
    return (np.stack(photos), np.stack(sketches), np.array(styles), names, problems)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help=r"path to the FS2K folder (contains anno_train.json)")
    args = ap.parse_args()
    root = Path(args.root)
    out = DATA_ROOT / "fs2k"
    out.mkdir(parents=True, exist_ok=True)

    tp, ts, tst, tn, prob1 = load_split(root, "anno_train.json")
    ep, es, est, en, prob2 = load_split(root, "anno_test.json")

    np.save(out / "train_photo.npy", tp);  np.save(out / "train_sketch.npy", ts)
    np.save(out / "train_style.npy", tst)
    np.save(out / "test_photo.npy", ep);   np.save(out / "test_sketch.npy", es)
    np.save(out / "test_style.npy", est)

    # 15% stratified-by-style validation split of the OFFICIAL train portion
    idx = np.arange(len(tst))
    tr, va = train_test_split(idx, test_size=0.15, random_state=SEED,
                              shuffle=True, stratify=tst)
    json.dump({"train": tr.tolist(), "val": va.tolist(), "seed": SEED,
               "train_names": tn, "test_names": en},
              open(out / "split.json", "w"))

    # ---- report ----
    print("\n=== FS2K report ===")
    print("official train:", len(tst), "| official test:", len(est), "| total:", len(tst) + len(est))
    print("problems train:", dict(prob1), "| test:", dict(prob2))
    print("style counts  train:", dict(sorted(collections.Counter(tst.tolist()).items())),
          " test:", dict(sorted(collections.Counter(est.tolist()).items())))
    print("split sizes   train:", len(tr), " val:", len(va))
    print("val style counts:", dict(sorted(collections.Counter(tst[va].tolist()).items())))
    print("train/val overlap:", len(set(tr) & set(va)))
    # Are sketches grayscale? (mean abs difference between channels, per style)
    for s in range(3):
        sk = ts[tst == s].astype(np.float32)
        d = np.abs(sk[..., 0] - sk[..., 1]).mean() + np.abs(sk[..., 1] - sk[..., 2]).mean()
        print(f"style {s}: sketch channel difference = {d:.2f} (near 0 means grayscale)")