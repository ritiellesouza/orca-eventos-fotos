import io
import os

os.environ["FACE_SERVICE_TOKEN"] = "test-token"

from fastapi.testclient import TestClient
from app.main import app, MAX_IMAGE_BYTES

client = TestClient(app)

AUTH = {"X-Face-Service-Token": "test-token"}

def test_embed_detects_face_and_returns_512d_vector():
    with open("tests/fixtures/sample_face.jpg", "rb") as f:
        response = client.post("/embed", files={"image": ("sample.jpg", f, "image/jpeg")}, headers=AUTH)

    assert response.status_code == 200
    data = response.json()
    assert len(data["faces"]) >= 1
    face = data["faces"][0]
    assert len(face["embedding"]) == 512
    assert len(face["bbox"]) == 4

def test_embed_returns_empty_list_when_no_face():
    from PIL import Image
    blank = Image.new("RGB", (200, 200), color=(120, 120, 120))
    buf = io.BytesIO()
    blank.save(buf, format="JPEG")
    buf.seek(0)

    response = client.post("/embed", files={"image": ("blank.jpg", buf, "image/jpeg")}, headers=AUTH)

    assert response.status_code == 200
    assert response.json()["faces"] == []

def test_embed_returns_400_for_malformed_image():
    response = client.post(
        "/embed",
        files={"image": ("not_an_image.jpg", b"this is not image data", "image/jpeg")},
        headers=AUTH,
    )

    assert response.status_code == 400

def test_embed_rejects_request_without_token():
    response = client.post(
        "/embed",
        files={"image": ("not_an_image.jpg", b"whatever", "image/jpeg")},
    )

    assert response.status_code == 401

def test_embed_rejects_request_with_wrong_token():
    response = client.post(
        "/embed",
        files={"image": ("not_an_image.jpg", b"whatever", "image/jpeg")},
        headers={"X-Face-Service-Token": "wrong-token"},
    )

    assert response.status_code == 401

def test_embed_fails_closed_when_token_not_configured(monkeypatch):
    monkeypatch.delenv("FACE_SERVICE_TOKEN", raising=False)

    response = client.post(
        "/embed",
        files={"image": ("not_an_image.jpg", b"whatever", "image/jpeg")},
        headers=AUTH,
    )

    assert response.status_code == 500

def test_embed_rejects_oversized_image():
    oversized = b"\x00" * (MAX_IMAGE_BYTES + 1)

    response = client.post(
        "/embed",
        files={"image": ("huge.jpg", oversized, "image/jpeg")},
        headers=AUTH,
    )

    assert response.status_code == 413
