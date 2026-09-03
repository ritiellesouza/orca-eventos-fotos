FROM python:3.11-slim

WORKDIR /app

# opencv/insightface need these at runtime, not just build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
# Bind to 0.0.0.0 *inside* the container is fine — the container itself is
# never given a published host port, so it's only reachable over the internal
# docker network other services attach to. See README §6.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
