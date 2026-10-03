import torch
import torch.nn as nn
import torch.nn.functional as F
from src.models.autoencoder import build_ae
from src.models.classifier import CorruptionClassifier

BRANCHES = ["identity", "salt", "blur", "occlusion"]


class SoftMoE(nn.Module):
    """x_hat = w0*x + w1*E_salt(x) + w2*E_blur(x) + w3*E_occ(x),  w = softmax(gate(x)/T)."""

    def __init__(self, gate, experts, temperature=1.0):
        super().__init__()
        self.gate = gate
        self.experts = nn.ModuleList(experts)
        self.register_buffer("T", torch.tensor(float(temperature)))

    def forward(self, x, return_all=False):
        logits = self.gate(x)
        w = F.softmax(logits / self.T, dim=1)                      # (B,4)
        outs = torch.stack([x] + [e(x) for e in self.experts])     # (4,B,3,H,W)
        out = (w.t()[:, :, None, None, None] * outs).sum(0)
        return (out, w, logits) if return_all else out


def load_task2_parts(ckpt_dir, dev):
    """Gate from the Task 2 classifier, experts from the Task 2 specialists."""
    ck = torch.load(ckpt_dir / "classifier.pt", map_location=dev)
    gate = CorruptionClassifier(ck["cfg"]["channels"], ck["cfg"]["dropout"])
    gate.load_state_dict(ck["state_dict"])
    experts, cfgs = [], []
    for nm in ("salt", "blur", "occ"):
        s = torch.load(ckpt_dir / f"spec_{nm}.pt", map_location=dev)
        m = build_ae(s["cfg"]); m.load_state_dict(s["state_dict"])
        experts.append(m); cfgs.append(s["cfg"])
    arch = {"gate": {"channels": ck["cfg"]["channels"], "dropout": ck["cfg"]["dropout"]},
            "experts": cfgs}
    return gate, experts, arch


def load_softmoe(path, dev):
    ck = torch.load(path, map_location=dev)
    a = ck["arch"]
    gate = CorruptionClassifier(a["gate"]["channels"], a["gate"]["dropout"])
    m = SoftMoE(gate, [build_ae(c) for c in a["experts"]], ck["cfg"]["T"])
    m.load_state_dict(ck["state_dict"])
    return m.to(dev).eval(), ck
