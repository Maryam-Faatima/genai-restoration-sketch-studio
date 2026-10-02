import numpy as np
import torch
from torch.utils.data import Dataset
from src.data.corruptions import CLASS_NAMES, sample_params, apply_corruption


def _to_tensor(images, idx):
    return torch.from_numpy(np.array(images[idx])).permute(2, 0, 1).float() / 255.0


class BalancedCorruptionDataset(Dataset):
    """label = i % 4. With shuffle=False, drop_last=True and batch_size % 4 == 0,
    every batch holds exactly batch_size/4 images of each class."""
    def __init__(self, images, indices):
        self.images, self.indices = images, indices

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, i):
        rng = np.random.default_rng()
        label = i % 4
        idx = int(self.indices[rng.integers(0, len(self.indices))])
        clean = _to_tensor(self.images, idx)
        return apply_corruption(clean, sample_params(rng, CLASS_NAMES[label])), clean, label


class MixedTypesDataset(Dataset):
    """Runtime corruption drawn only from `types` (list of class ids 1-3)."""
    def __init__(self, images, indices, types):
        self.images, self.indices, self.types = images, indices, list(types)

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, i):
        rng = np.random.default_rng()
        label = int(rng.choice(self.types))
        clean = _to_tensor(self.images, int(self.indices[i]))
        return apply_corruption(clean, sample_params(rng, CLASS_NAMES[label])), clean, label
