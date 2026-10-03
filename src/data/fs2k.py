import json
import numpy as np
import torch
from torch.utils.data import Dataset
from src.config import DATA_ROOT


class FS2KDataset(Dataset):
    """Paired photo/sketch in [-1,1]: photo (3,128,128), sketch (1,128,128), style id.
    split: 'train' | 'val' (15% stratified hold-out of the official train set) | 'test' (official)."""

    def __init__(self, split, augment=False):
        d = DATA_ROOT / "fs2k"
        if split == "test":
            P, S, st = (np.load(d / "test_photo.npy"), np.load(d / "test_sketch.npy"),
                        np.load(d / "test_style.npy"))
            idx = np.arange(len(st))
        else:
            P, S, st = (np.load(d / "train_photo.npy"), np.load(d / "train_sketch.npy"),
                        np.load(d / "train_style.npy"))
            idx = np.array(json.load(open(d / "split.json"))[split])
        self.photo = torch.from_numpy(P[idx]).permute(0, 3, 1, 2).contiguous()    # uint8 (N,3,H,W)
        self.sketch = torch.from_numpy(S[idx][..., 0]).unsqueeze(1).contiguous()  # uint8 (N,1,H,W)
        self.style = torch.from_numpy(st[idx]).long()
        self.augment = augment

    def __len__(self):
        return len(self.style)

    def __getitem__(self, i):
        p = self.photo[i].float() / 127.5 - 1.0
        s = self.sketch[i].float() / 127.5 - 1.0
        if self.augment and torch.rand(1).item() < 0.5:    # identical flip for BOTH images
            p, s = p.flip(-1), s.flip(-1)
        return p, s, self.style[i]
