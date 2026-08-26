from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_embed_detects_face_and_returns_512d_vector():
    with open("tests/fixtures/sample_face.jpg", "rb") as f:
        response = client.post("/embed", files={"image": ("sample.jpg", f, "image/jpeg")})

    assert response.status_code == 200
    data = response.json()
    assert len(data["faces"]) >= 1
    face = data["faces"][0]
    assert len(face["embedding"]) == 512
    assert len(face["bbox"]) == 4

def test_embed_returns_empty_list_when_no_face():
    import io
    from PIL import Image
    blank = Image.new("RGB", (200, 200), color=(120, 120, 120))
    buf = io.BytesIO()
    blank.save(buf, format="JPEG")
    buf.seek(0)

    response = client.post("/embed", files={"image": ("blank.jpg", buf, "image/jpeg")})

    assert response.status_code == 200
    assert response.json()["faces"] == []

def test_embed_returns_400_for_malformed_image():
    response = client.post(
        "/embed",
        files={"image": ("not_an_image.jpg", b"this is not image data", "image/jpeg")},
    )

    assert response.status_code == 400
