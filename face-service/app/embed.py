import numpy as np
from insightface.app import FaceAnalysis

_face_app = None

def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app

def extract_faces(image_bgr: np.ndarray) -> list[dict]:
    face_app = get_face_app()
    faces = face_app.get(image_bgr)
    return [
        {
            "bbox": [float(v) for v in face.bbox],
            "embedding": face.normed_embedding.tolist(),
        }
        for face in faces
    ]
