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
    """Conv encoder -> compressed latent -> conv decoder. NO skip connections.

    latent_ch=None : v1 baseline, flattened linear bottleneck (depth 5 -> 4x4 -> vector).
    latent_ch=int  : v2, spatial bottleneck of shape (latent_ch, 8, 8) (depth 4).
                     latent_ch=16 -> 1024 numbers vs 49152 input values (48x compression).
    """

    def __init__(self, base=32, bottleneck=256, dropout=0.1, depth=5, latent_ch=None):
        super().__init__()
        self.spatial = latent_ch is not None
        if self.spatial:
            depth = 4
        ch = [min(base * 2 ** i, 256) for i in range(depth)]
        self.c_last, self.s = ch[-1], 128 // 2 ** depth

        layers, prev = [], 3
        for c in ch:
            layers.append(down(prev, c)); prev = c
        self.encoder = nn.Sequential(*layers)

        if self.spatial:
            self.to_latent = nn.Conv2d(self.c_last, latent_ch, 1)
            self.from_latent = nn.Sequential(nn.Conv2d(latent_ch, self.c_last, 3, 1, 1),
                                             nn.LeakyReLU(0.2, True))
        else:
            flat = self.c_last * self.s * self.s
            self.to_latent = nn.Linear(flat, bottleneck)
            self.from_latent = nn.Sequential(nn.Linear(bottleneck, flat), nn.LeakyReLU(0.2, True))
        self.drop = nn.Dropout(dropout)

        dims = [ch[-1]] + ch[::-1][1:] + [ch[0]]
        self.decoder = nn.Sequential(*[up(dims[i], dims[i + 1]) for i in range(depth)])
        self.out = nn.Sequential(nn.Conv2d(ch[0], 3, 3, 1, 1), nn.Sigmoid())

    def encode(self, x):
        h = self.encoder(x)
        return self.to_latent(h) if self.spatial else self.to_latent(h.flatten(1))

    def decode(self, z):
        h = self.from_latent(self.drop(z))
        if not self.spatial:
            h = h.view(-1, self.c_last, self.s, self.s)
        return self.out(self.decoder(h))

    def forward(self, x):
        return self.decode(self.encode(x))


def build_ae(c):
    """Build from a config dict. Works for v1 (no latent_ch) and v2 checkpoints."""
    return ConvAE(c["base"], c.get("bottleneck", 256), c.get("dropout", 0.1),
                  latent_ch=c.get("latent_ch"))
