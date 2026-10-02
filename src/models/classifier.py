import torch
import torch.nn as nn

CHANNEL_CONFIGS = {"small": [16, 32, 64, 128],
                   "medium": [32, 64, 128, 256],
                   "large": [48, 96, 192, 384]}


def block(i, o):
    return nn.Sequential(
        nn.Conv2d(i, o, 3, 1, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(True),
        nn.Conv2d(o, o, 3, 1, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(True),
        nn.MaxPool2d(2))


class CorruptionClassifier(nn.Module):
    """4-way classifier (clean / salt_pepper / blur / occlusion). Returns logits."""
    def __init__(self, channels="medium", dropout=0.3, n_classes=4):
        super().__init__()
        layers, prev = [], 3
        for c in CHANNEL_CONFIGS[channels]:
            layers.append(block(prev, c)); prev = c
        self.features = nn.Sequential(*layers)
        self.avg, self.max = nn.AdaptiveAvgPool2d(1), nn.AdaptiveMaxPool2d(1)
        self.head = nn.Sequential(nn.Dropout(dropout), nn.Linear(prev * 2, n_classes))

    def forward(self, x):
        f = self.features(x)
        return self.head(torch.cat([self.avg(f).flatten(1), self.max(f).flatten(1)], 1))
