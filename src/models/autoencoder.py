import torch
import torch.nn as nn


def down(i, o):
    return nn.Sequential(
        nn.Conv2d(i, o, 4, 2, 1, bias=False), nn.BatchNorm2d(o), nn.LeakyReLU(0.2, True),
        nn.Conv2d(o, o, 3, 1, 1, bias=False), nn.BatchNorm2d(o), nn.LeakyReLU(0.2, True))


def up(i, o):
    return nn.Sequential(
        nn.ConvTranspose2d(i, o, 4, 2, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(True),
        nn.Conv2d(o, o, 3, 1, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(True))


class ConvAE(nn.Module):
    """Conv encoder -> compressed latent -> conv decoder.

    latent_ch=None : v1 baseline, flattened linear bottleneck.
    latent_ch=int  : spatial bottleneck (latent_ch, 8, 8), depth 4.
    skip_ch>0      : ONE narrow skip. Encoder stage `skip_level` (2 -> 16x16) is squeezed by a
                     1x1 conv to skip_ch channels (+Dropout2d) and concatenated into the decoder at
                     the same resolution. Capacity = skip_ch*16*16 values (skip_ch=4 -> 1024),
                     capped below the latent size, so the code stays a real bottleneck.
    skip_ch=0      : no skip (ablation baseline). Old checkpoints load unchanged.
    """

    def __init__(self, base=32, bottleneck=256, dropout=0.1, depth=5, latent_ch=None,
                 skip_ch=0, skip_level=2):
        super().__init__()
        self.spatial = latent_ch is not None
        if self.spatial:
            depth = 4
        ch = [min(base * 2 ** i, 256) for i in range(depth)]
        self.c_last, self.s = ch[-1], 128 // 2 ** depth

        self.encoder = nn.ModuleList()
        prev = 3
        for c in ch:
            self.encoder.append(down(prev, c)); prev = c

        if self.spatial:
            self.to_latent = nn.Conv2d(self.c_last, latent_ch, 1)
            self.from_latent = nn.Sequential(nn.Conv2d(latent_ch, self.c_last, 3, 1, 1),
                                             nn.LeakyReLU(0.2, True))
        else:
            flat = self.c_last * self.s * self.s
            self.to_latent = nn.Linear(flat, bottleneck)
            self.from_latent = nn.Sequential(nn.Linear(bottleneck, flat), nn.LeakyReLU(0.2, True))
        self.drop = nn.Dropout(dropout)

        # optional narrow skip (spatial model only)
        self.skip_ch = skip_ch if self.spatial else 0
        self.skip_level = skip_level            # encoder stage index (0:64px 1:32px 2:16px)
        self.inject_after = 2 - skip_level      # decoder block whose output has the same size
        if self.skip_ch:
            self.to_skip = nn.Sequential(nn.Conv2d(ch[skip_level], self.skip_ch, 1),
                                         nn.Dropout2d(dropout))

        dims = [ch[-1]] + ch[::-1][1:] + [ch[0]]
        dec = []
        for k in range(depth):
            extra = self.skip_ch if (self.skip_ch and k == self.inject_after + 1) else 0
            dec.append(up(dims[k] + extra, dims[k + 1]))
        self.decoder = nn.ModuleList(dec)
        self.out = nn.Sequential(nn.Conv2d(ch[0], 3, 3, 1, 1), nn.Sigmoid())

    def encode(self, x, return_skip=False):
        skip = None
        for i, blk in enumerate(self.encoder):
            x = blk(x)
            if self.skip_ch and i == self.skip_level:
                skip = self.to_skip(x)
        z = self.to_latent(x) if self.spatial else self.to_latent(x.flatten(1))
        return (z, skip) if return_skip else z

    def decode(self, z, skip=None):
        h = self.from_latent(self.drop(z))
        if not self.spatial:
            h = h.view(-1, self.c_last, self.s, self.s)
        for k, blk in enumerate(self.decoder):
            h = blk(h)
            if self.skip_ch and k == self.inject_after:
                h = torch.cat([h, skip], 1)
        return self.out(h)

    def forward(self, x):
        z, skip = self.encode(x, return_skip=True)
        return self.decode(z, skip)


def build_ae(c):
    """Build from a config dict. Works for v1, v2 and v3 (skip) configs."""
    return ConvAE(c["base"], c.get("bottleneck", 256), c.get("dropout", 0.1),
                  latent_ch=c.get("latent_ch"), skip_ch=c.get("skip_ch", 0),
                  skip_level=c.get("skip_level", 2))