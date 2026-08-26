import hmac
import os

import numpy as np
import cv2
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Header

from app.embed import extract_faces

app = FastAPI()

# Backstop above the web app's own 10MB selfie cap. Face inference is the most
# expensive thing on the VM, so an oversized upload is refused before it is
# decoded.
MAX_IMAGE_BYTES = 15 * 1024 * 1024


def _require_token(presented: str | None) -> None:
    """This service must be bound to a private interface AND require a secret.

    It holds no data of its own but it is the CPU-expensive part of the stack,
    and it sees every selfie. Fail closed when the secret is not configured
    rather than silently accepting anonymous callers.
    """
    expected = os.environ.get("FACE_SERVICE_TOKEN")

    if not expected:
        raise HTTPException(status_code=500, detail="face_service_token_not_configured")

    if not presented or not hmac.compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.post("/embed")
async def embed(
    request: Request,
    image: UploadFile = File(...),
    x_face_service_token: str | None = Header(default=None),
):
    _require_token(x_face_service_token)

    declared_length = request.headers.get("content-length")
    if declared_length and int(declared_length) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image_too_large")

    contents = await image.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image_too_large")

    np_arr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="invalid_image")
    faces = extract_faces(image_bgr)
    return {"faces": faces}
