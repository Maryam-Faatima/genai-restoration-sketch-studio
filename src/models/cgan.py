import torch
import torch.nn as nn


def init_weights(m):
    if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
        nn.init.normal_(m.weight, 0.0, 0.02)
        if m.bias is not None:
            nn.init.zeros_(m.bias)


def enc_block(i, o, norm=True):
    layers = [nn.Conv2d(i, o, 4, 2, 1, bias=not norm)]
    if norm:
        layers.append(nn.BatchNorm2d(o))
    layers.append(nn.LeakyReLU(0.2, True))
    return nn.Sequential(*layers)


class FiLMUp(nn.Module):
    """ConvTranspose -> BatchNorm(no affine) -> style FiLM (scale/shift) -> dropout -> ReLU."""

    def __init__(self, i, o, emb_dim, dropout=0.0):
        super().__init__()
        self.conv = nn.ConvTranspose2d(i, o, 4, 2, 1, bias=False)
        self.norm = nn.BatchNorm2d(o, affine=False)
        self.film = nn.Linear(emb_dim, 2 * o)
        nn.init.zeros_(self.film.weight); nn.init.zeros_(self.film.bias)   # starts as identity
        self.drop = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

    def forward(self, x, e):
        h = self.norm(self.conv(x))
        g, b = self.film(e).chunk(2, dim=1)
        h = h * (1 + g[:, :, None, None]) + b[:, :, None, None]
        return torch.relu(self.drop(h))


class UNetGenerator(nn.Module):
    """U-Net, 128x128. Style embedding is (a) concatenated to the input as channels and
    (b) used by FiLM in every decoder block."""

    def __init__(self, base=64, emb_dim=16, dropout=0.3, n_styles=3):
        super().__init__()
        b = base
        ch = [b, 2 * b, 4 * b, 8 * b, 8 * b, 8 * b]          # spatial 64,32,16,8,4,2
        self.emb = nn.Embedding(n_styles, emb_dim)
        self.enc = nn.ModuleList()
        prev = 3 + emb_dim
        for k, c in enumerate(ch):
            self.enc.append(enc_block(prev, c, norm=(k > 0)))
            prev = c
        self.dec = nn.ModuleList([
            FiLMUp(ch[5], ch[4], emb_dim, dropout),            # 2 -> 4,   cat skip e4
            FiLMUp(2 * ch[4], ch[3], emb_dim, dropout),        # 4 -> 8,   cat skip e3
            FiLMUp(2 * ch[3], ch[2], emb_dim, dropout),        # 8 -> 16,  cat skip e2
            FiLMUp(2 * ch[2], ch[1], emb_dim, 0.0),            # 16 -> 32, cat skip e1
            FiLMUp(2 * ch[1], ch[0], emb_dim, 0.0),            # 32 -> 64, cat skip e0
        ])
        self.out = nn.Sequential(nn.ConvTranspose2d(2 * ch[0], 1, 4, 2, 1), nn.Tanh())  # -> 128

    def forward(self, x, style):
        e = self.emb(style)
        h = torch.cat([x, e[:, :, None, None].expand(-1, -1, x.shape[2], x.shape[3])], 1)
        skips = []
        for blk in self.enc:
            h = blk(h); skips.append(h)
        h = skips.pop()                                        # 2x2 bottleneck
        for blk in self.dec:
            h = blk(h, e)
            h = torch.cat([h, skips.pop()], 1)
        return self.out(h)


class PatchDiscriminator(nn.Module):
    """PatchGAN on (photo, sketch, style). Style embedding is broadcast as input channels.
    Output: (B,1,14,14) patch logits."""

    def __init__(self, base=64, emb_dim=16, n_styles=3):
        super().__init__()
        self.emb = nn.Embedding(n_styles, emb_dim)

        def blk(i, o, s, norm=True):
            L = [nn.Conv2d(i, o, 4, s, 1, bias=not norm)]
            if norm:
                L.append(nn.BatchNorm2d(o))
            L.append(nn.LeakyReLU(0.2, True))
            return L

        self.net = nn.Sequential(*blk(3 + 1 + emb_dim, base, 2, False), *blk(base, base * 2, 2),
                                 *blk(base * 2, base * 4, 2), *blk(base * 4, base * 8, 1),
                                 nn.Conv2d(base * 8, 1, 4, 1, 1))

    def forward(self, photo, sketch, style):
        e = self.emb(style)[:, :, None, None].expand(-1, -1, photo.shape[2], photo.shape[3])
        return self.net(torch.cat([photo, sketch, e], 1))
