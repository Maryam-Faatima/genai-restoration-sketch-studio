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
    """Conv encoder -> linear bottleneck -> conv decoder. NO skip connections."""

    def __init__(self, base=32, bottleneck=256, dropout=0.1, depth=5):
        super().__init__()
        ch = [min(base * 2 ** i, 256) for i in range(depth)]
        self.c_last, self.s = ch[-1], 128 // 2 ** depth
        flat = self.c_last * self.s * self.s

        layers, prev = [], 3
        for c in ch:
            layers.append(down(prev, c)); prev = c
        self.encoder = nn.Sequential(*layers)

        self.to_latent = nn.Linear(flat, bottleneck)
        self.drop = nn.Dropout(dropout)
        self.from_latent = nn.Sequential(nn.Linear(bottleneck, flat), nn.LeakyReLU(0.2, True))

        dims = [ch[-1]] + ch[::-1][1:] + [ch[0]]
        self.decoder = nn.Sequential(*[up(dims[i], dims[i + 1]) for i in range(depth)])
        self.out = nn.Sequential(nn.Conv2d(ch[0], 3, 3, 1, 1), nn.Sigmoid())

    def encode(self, x):
        return self.to_latent(self.encoder(x).flatten(1))

    def decode(self, z):
        h = self.from_latent(self.drop(z)).view(-1, self.c_last, self.s, self.s)
        return self.out(self.decoder(h))

    def forward(self, x):
        return self.decode(self.encode(x))
