"""API tests using tiny stand-in ONNX models with the same input/output names and shapes as the
real ones (so they run without the trained weights): pytest backend/tests"""
import io
import numpy as np
import onnx
import pytest
from onnx import TensorProto as TP, helper as h, numpy_helper as nh
from fastapi.testclient import TestClient
from PIL import Image

IMG = ["batch", 3, 128, 128]


def _save(nodes, inputs, outputs, inits, path):
    g = h.make_graph(nodes, "g", inputs, outputs, inits)
    m = h.make_model(g, opset_imports=[h.make_opsetid("", 13)])
    m.ir_version = 8
    onnx.save(m, str(path))


def _vi(name, shape, t=TP.FLOAT):
    return h.make_tensor_value_info(name, t, shape)


def identity(path):
    _save([h.make_node("Identity", ["image"], ["restored"])], [_vi("image", IMG)],
          [_vi("restored", IMG)], [], path)


def head(path, with_image_out):
    w = nh.from_array(np.array([[3, 0, 0, 0], [0, 3, 0, 0], [0, 0, 3, 0]], dtype=np.float32), "W")
    b = nh.from_array(np.zeros(4, dtype=np.float32), "B")
    nodes = [h.make_node("GlobalAveragePool", ["image"], ["g"]), h.make_node("Flatten", ["g"], ["f"]),
             h.make_node("Gemm", ["f", "W", "B"], ["z"]),
             h.make_node("Softmax", ["z"], ["probs" if not with_image_out else "weights"], axis=1)]
    outs = [_vi("weights" if with_image_out else "probs", ["batch", 4])]
    if with_image_out:
        nodes.append(h.make_node("Identity", ["image"], ["restored"]))
        outs.insert(0, _vi("restored", IMG))
    _save(nodes, [_vi("image", IMG)], outs, [w, b], path)


def generator(path):
    _save([h.make_node("ReduceMean", ["photo"], ["sketch"], axes=[1], keepdims=1)],
          [_vi("photo", IMG), _vi("style", ["batch"], TP.INT64)],
          [_vi("sketch", ["batch", 1, 128, 128])], [], path)


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    d = tmp_path_factory.mktemp("models")
    for f in ("task1_universal", "task2_spec_salt", "task2_spec_blur", "task2_spec_occ"):
        identity(d / f"{f}.onnx")
    head(d / "task2_classifier.onnx", False)
    head(d / "task3_softmoe.onnx", True)
    generator(d / "task4_generator.onnx")
    from app import main
    main.registry.dir = d
    with TestClient(main.app) as c:
        yield c


def png(color=(120, 200, 80), size=(200, 150), fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return buf.getvalue()


def up(data=None, name="a.png", mime="image/png"):
    return {"image": (name, data if data is not None else png(), mime)}


def test_health(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and len(r["models"]) == 7


@pytest.mark.parametrize("c", ["uploaded", "clean", "salt_pepper", "blur", "occlusion"])
def test_universal(client, c):
    r = client.post("/api/universal", files=up(), data={"corruption": c, "severity": "high"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["input"].startswith("data:image/png;base64,") and j["inference_ms"] >= 0
    assert (j["original"] is None) == (c == "uploaded")


def test_seed_is_reproducible(client):
    d = {"corruption": "salt_pepper", "severity": "medium", "seed": "7"}
    a = client.post("/api/universal", files=up(), data=d).json()
    b = client.post("/api/universal", files=up(), data=d).json()
    assert a["input"] == b["input"] and a["corruption"]["probability"] == 0.08


def test_corruption_settings_match_assignment(client):
    r = client.post("/api/universal", files=up(), data={"corruption": "blur", "severity": "high"}).json()
    assert (r["corruption"]["kernel"], r["corruption"]["sigma"]) == (7, 2.5)
    r = client.post("/api/universal", files=up(), data={"corruption": "occlusion", "severity": "low"}).json()
    assert r["corruption"]["rectangles"] == 1 and abs(r["corruption"]["actual_area"] - 0.10) < 0.01


def test_hard_predicted_and_oracle(client):
    r = client.post("/api/hard", files=up(), data={"corruption": "blur"}).json()
    assert set(r["probabilities"]) == {"clean", "salt_pepper", "blur", "occlusion"}
    assert abs(sum(r["probabilities"].values()) - 1) < 1e-2 and r["routing"] == "predicted"
    r = client.post("/api/hard", files=up(), data={"corruption": "clean", "routing": "oracle"}).json()
    assert r["expert"] == "identity bypass" and r["timing_ms"]["expert"] == 0.0
    r = client.post("/api/hard", files=up(), data={"corruption": "salt_pepper", "routing": "oracle"}).json()
    assert r["expert"] == "salt_pepper specialist"


def test_oracle_needs_known_corruption(client):
    assert client.post("/api/hard", files=up(), data={"routing": "oracle"}).status_code == 400


def test_soft_weights(client):
    r = client.post("/api/soft", files=up(), data={"corruption": "occlusion"}).json()
    assert list(r["weights"]) == ["identity", "salt_pepper", "blur", "occlusion"]
    assert abs(sum(r["weights"].values()) - 1) < 1e-2 and r["dominant"] in r["weights"]


def test_sketch(client):
    r = client.post("/api/sketch", files={"photo": ("p.jpg", png(fmt="JPEG"), "image/jpeg")}, data={"style": "2"})
    assert r.status_code == 200 and r.json()["style"] == "Style 2"
    assert client.post("/api/sketch", files={"photo": ("p.png", png(), "image/png")}, data={"style": "4"}).status_code == 422


def test_validation(client):
    assert client.post("/api/universal", files=up(b"not an image")).status_code == 400
    assert client.post("/api/universal", files=up(b"")).status_code == 400
    assert client.post("/api/universal", files=up(), data={"corruption": "fog"}).status_code == 422
    assert client.post("/api/universal", files=up(), data={"corruption": "blur", "severity": "x"}).status_code == 422
    gif = io.BytesIO(); Image.new("RGB", (8, 8)).save(gif, "GIF")
    assert client.post("/api/universal", files=up(gif.getvalue(), "a.gif", "image/gif")).status_code == 415
    assert client.post("/api/universal", files=up(b"x" * (10 * 1024 * 1024 + 5))).status_code
