import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File
from app.embed import extract_faces

app = FastAPI()

@app.post("/embed")
async def embed(image: UploadFile = File(...)):
    contents = await image.read()
    np_arr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    faces = extract_faces(image_bgr)
    return {"faces": faces}
