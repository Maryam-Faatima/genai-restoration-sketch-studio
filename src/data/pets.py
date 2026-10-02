import json
import numpy as np
import torch
from torch.utils.data import Dataset
from src.config import DATA_ROOT
from src.data.corruptions import CLASS_NAMES, sample_params, apply_corruption


def load_pets(split_name):
    """split_name in {'train','val','test'}. Returns (images_uint8, indices)."""
    root = DATA_ROOT / "pets"
    if split_name == "test":
        imgs = np.load(root / "test.npy", mmap_mode="r")
        return imgs, np.arange(len(imgs))
    imgs = np.load(root / "trainval.npy", mmap_mode="r")
    split = json.load(open(root / "split.json"))
    return imgs, np.array(split[split_name])


class PetRestorationDataset(Dataset):
    """
    Returns (corrupted, clean, label) as float tensors in [0,1] + int label.
      - manifest=None  -> runtime random corruption (training).
                          force_type (0-3) restricts to one condition (specialists).
      - manifest=list  -> deterministic entries (validation / test).
    """
    def __init__(self, images, indices, manifest=None, force_type=None):
        self.images, self.indices = images, indices
        self.manifest, self.force_type = manifest, force_type

    def __len__(self):
        return len(self.manifest) if self.manifest is not None else len(self.indices)

    def __getitem__(self, i):
        if self.manifest is not None:
            e = self.manifest[i]
            idx, label, params = e["img_idx"], e["label"], e["params"]
        else:
            idx = int(self.indices[i])
            rng = np.random.default_rng()  # fresh OS entropy: new type+severity every load
            label = self.force_type if self.force_type is not None else int(rng.integers(0, 4))
            params = sample_params(rng, CLASS_NAMES[label])
        clean = torch.from_numpy(np.array(self.images[idx])).permute(2, 0, 1).float() / 255.0
        return apply_corruption(clean, params), clean, label
