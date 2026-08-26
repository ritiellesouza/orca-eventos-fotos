# Plataforma de Fotos de Eventos (Orca Mídias) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MVP web platform where Orca Mídias uploads event photos, attendees find their own photos via selfie-based facial search (no login needed), and buy/download high-res originals via Stripe — as designed in `docs/superpowers/specs/2026-08-26-plataforma-fotos-eventos-design.md`.

**Architecture:** Next.js (TypeScript, App Router) frontend + API routes talk to Supabase self-hosted (Postgres + pgvector, schema `orca_eventos`) for data and vector search, a Python FastAPI microservice (InsightFace/ArcFace) for face embeddings, Cloudflare R2 (S3-compatible) for photo storage, and Stripe Checkout for payment.

**Tech Stack:** Next.js 14 (App Router, TypeScript 5, Node 20), Tailwind CSS, `@supabase/supabase-js`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `stripe` (node SDK), `sharp` (image processing), Vitest + Testing Library (frontend/unit tests), Python 3.11, FastAPI 0.115, `insightface` + `onnxruntime`, `pytest` + `httpx`.

## Global Constraints

- Photos never stored on the G3 Mídia VM disk — only in Cloudflare R2. (spec §3)
- Face embeddings computed only by the self-hosted InsightFace microservice — never sent to a third-party cloud API. (spec §3, §6)
- Vector search uses pgvector inside the existing self-hosted Supabase Postgres — no separate vector database. (spec §3)
- Public search flow requires no account/login; account/contact info is only collected at Stripe checkout. (spec §1, §4.2)
- Preview images are always visible at low resolution + watermark (this is the real protection mechanism) — never claim or imply guaranteed screenshot-blocking in UI copy. (spec §4.4, §6)
- Selfie consent (LGPD) must be captured before any selfie is sent for embedding. (spec §6)
- Face embeddings/selfie search data retention: 90-180 days post-event (use 120 days as the default). (spec §6)
- Signed download URLs for originals expire a few hours after generation. (spec §4.3)

---

## File Structure

```
orca-eventos-fotos/
  web/                                  # Next.js app
    app/
      admin/events/page.tsx             # admin: list/create events
      admin/events/[id]/upload/page.tsx # admin: bulk photo upload
      e/[slug]/page.tsx                 # public event page (selfie search + gallery)
      e/[slug]/obrigado/page.tsx        # post-purchase download page
      api/admin/events/route.ts
      api/admin/events/[id]/photos/route.ts
      api/events/[slug]/search/route.ts
      api/checkout/route.ts
      api/webhooks/stripe/route.ts
    lib/
      supabaseClient.ts
      imagePipeline.ts                  # watermark/preview generation (sharp)
      storage.ts                        # R2 client wrapper
      faceService.ts                    # HTTP client for face microservice
      photoUpload.ts                    # orchestrates upload pipeline
      search.ts                         # orchestrates selfie search
      checkout.ts                       # Stripe session builder
    components/
      SelfieUploader.tsx
      PhotoGrid.tsx
      useBlurOnFocusLoss.ts
    scripts/
      purge-expired-faces.ts
    tests/ (vitest, colocated *.test.ts also fine)
  face-service/                         # Python FastAPI microservice
    app/
      main.py
      embed.py
    tests/
      test_embed.py
      fixtures/
  supabase/
    migrations/
      0001_orca_eventos_schema.sql
```

---

### Task 1: Repo scaffolding — Next.js app

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.mjs`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/vitest.config.ts`
- Test: `web/tests/smoke.test.ts`

**Interfaces:**
- Produces: a working Next.js 14 + TypeScript project at `web/`, `npm run build` and `npm run test` both succeed. Later tasks add files under `web/lib`, `web/app/api`, `web/components`.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
npx create-next-app@14 web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Add test tooling**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/web"
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Create `web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write the failing smoke test**

Create `web/tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

function projectName() {
  return 'orca-eventos-fotos'
}

describe('smoke', () => {
  it('test runner works', () => {
    expect(projectName()).toBe('orca-eventos-fotos')
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (1 test)

- [ ] **Step 5: Verify build works**

Run: `npm run build`
Expected: build succeeds with no errors

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/
git commit -m "chore: scaffold Next.js app with vitest"
```

---

### Task 2: Supabase schema — `orca_eventos`

**Files:**
- Create: `supabase/migrations/0001_orca_eventos_schema.sql`

**Interfaces:**
- Produces: schema `orca_eventos` with tables `events`, `photos`, `faces`, `purchases`, `purchase_photos`, `consents`, and RPC function `orca_eventos.match_faces(query_embedding vector(512), p_event_id uuid, match_threshold float, match_count int)` returning `(photo_id uuid, similarity float)`. Later tasks (`web/lib/photoUpload.ts`, `web/lib/search.ts`) call these tables/RPC by name — signatures here are the contract.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_orca_eventos_schema.sql`:

```sql
create extension if not exists vector;

create schema if not exists orca_eventos;

create table orca_eventos.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  event_date date not null,
  created_at timestamptz not null default now()
);

create table orca_eventos.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references orca_eventos.events(id) on delete cascade,
  storage_key_preview text not null,
  storage_key_original text not null,
  has_face boolean not null default false,
  created_at timestamptz not null default now()
);
create index photos_event_id_idx on orca_eventos.photos(event_id);

create table orca_eventos.faces (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references orca_eventos.photos(id) on delete cascade,
  embedding vector(512) not null,
  bbox jsonb not null,
  created_at timestamptz not null default now()
);
create index faces_embedding_idx on orca_eventos.faces
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table orca_eventos.consents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references orca_eventos.events(id) on delete cascade,
  ip_address text,
  consented_at timestamptz not null default now()
);

create table orca_eventos.purchases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references orca_eventos.events(id) on delete cascade,
  stripe_session_id text not null unique,
  buyer_email text,
  status text not null default 'pending', -- pending | paid | failed
  created_at timestamptz not null default now()
);

create table orca_eventos.purchase_photos (
  purchase_id uuid not null references orca_eventos.purchases(id) on delete cascade,
  photo_id uuid not null references orca_eventos.photos(id) on delete cascade,
  primary key (purchase_id, photo_id)
);

create or replace function orca_eventos.match_faces(
  query_embedding vector(512),
  p_event_id uuid,
  match_threshold float,
  match_count int
)
returns table (photo_id uuid, similarity float)
language sql stable
as $$
  select f.photo_id, 1 - (f.embedding <=> query_embedding) as similarity
  from orca_eventos.faces f
  join orca_eventos.photos p on p.id = f.photo_id
  where p.event_id = p_event_id
    and 1 - (f.embedding <=> query_embedding) >= match_threshold
  order by f.embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 2: Apply the migration**

Run against the self-hosted Supabase Postgres instance on the G3 Mídia VM (adjust connection string to the real one):

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_orca_eventos_schema.sql
```

- [ ] **Step 3: Verify manually**

```bash
psql "$SUPABASE_DB_URL" -c "select * from orca_eventos.match_faces('[0,0,0]'::vector(512) || array_fill(0, array[509]), gen_random_uuid(), 0.5, 5);"
```

Expected: query runs with no error, returns 0 rows (no data yet, function exists and types check out — pad the test vector to 512 dims before running).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add supabase/
git commit -m "feat: add orca_eventos schema with pgvector face search"
```

---

### Task 3: Face recognition microservice — `/embed` endpoint

**Files:**
- Create: `face-service/requirements.txt`
- Create: `face-service/app/main.py`
- Create: `face-service/app/embed.py`
- Test: `face-service/tests/test_embed.py`

**Interfaces:**
- Produces: `POST /embed` — multipart form field `image` (jpeg/png bytes) → JSON `{"faces": [{"bbox": [x1,y1,x2,y2], "embedding": [512 floats]}]}`. `web/lib/faceService.ts` (Task 6/7) calls this endpoint by exact shape.

- [ ] **Step 1: Set up the Python project and dependencies**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/face-service"
python -m venv .venv
source .venv/Scripts/activate  # Windows Git Bash
```

Create `face-service/requirements.txt`:

```
fastapi==0.115.0
uvicorn==0.30.6
insightface==0.7.3
onnxruntime==1.19.2
pillow==10.4.0
numpy==1.26.4
pytest==8.3.3
httpx==0.27.2
python-multipart==0.0.9
```

```bash
pip install -r requirements.txt
```

- [ ] **Step 2: Download a real test fixture image (a photo with a clearly visible face)**

```bash
mkdir -p tests/fixtures
curl -L -o tests/fixtures/sample_face.jpg \
  https://raw.githubusercontent.com/deepinsight/insightface/master/python-package/insightface/data/images/Tom_Hanks_54745.png
```

- [ ] **Step 3: Write the failing test**

Create `face-service/tests/test_embed.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pytest tests/test_embed.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app'` or import error — `app/main.py` doesn't exist yet)

- [ ] **Step 5: Implement the embedding logic**

Create `face-service/app/embed.py`:

```python
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
```

- [ ] **Step 6: Implement the FastAPI app**

Create `face-service/app/main.py`:

```python
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
```

Add `opencv-python-headless==4.10.0.84` to `requirements.txt` and `pip install -r requirements.txt` again.

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest tests/test_embed.py -v`
Expected: PASS (2 tests). First run downloads the `buffalo_l` model automatically (needs internet once).

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add face-service/
git commit -m "feat: face recognition microservice with /embed endpoint"
```

---

### Task 4: Image pipeline — preview + watermark generation

**Files:**
- Create: `web/lib/imagePipeline.ts`
- Test: `web/lib/imagePipeline.test.ts`

**Interfaces:**
- Produces: `generatePreview(original: Buffer, watermarkText: string): Promise<Buffer>` — returns a JPEG buffer resized to max 800px on the longest side with a diagonal repeated watermark overlay. Used by `web/lib/photoUpload.ts` (Task 6).

- [ ] **Step 1: Install sharp**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/web"
npm install sharp
```

- [ ] **Step 2: Write the failing test**

Create `web/lib/imagePipeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { generatePreview } from './imagePipeline'

describe('generatePreview', () => {
  it('resizes to max 800px on the longest side', async () => {
    const original = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    }).jpeg().toBuffer()

    const preview = await generatePreview(original, 'Orca Mídias')
    const meta = await sharp(preview).metadata()

    expect(meta.width).toBe(800)
    expect(meta.height).toBe(400)
    expect(meta.format).toBe('jpeg')
  })

  it('produces a different image than a plain resize (watermark applied)', async () => {
    const original = await sharp({
      create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toBuffer()

    const preview = await generatePreview(original, 'Orca Mídias')
    const plainResize = await sharp(original).resize(800, 800).jpeg().toBuffer()

    expect(Buffer.compare(preview, plainResize)).not.toBe(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- imagePipeline`
Expected: FAIL (`imagePipeline.ts` doesn't exist)

- [ ] **Step 4: Implement `generatePreview`**

Create `web/lib/imagePipeline.ts`:

```typescript
import sharp from 'sharp'

const MAX_DIMENSION = 800

export async function generatePreview(original: Buffer, watermarkText: string): Promise<Buffer> {
  const resized = sharp(original).resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: 'inside',
  })

  const meta = await resized.metadata()
  const width = meta.width ?? MAX_DIMENSION
  const height = meta.height ?? MAX_DIMENSION

  const watermarkSvg = Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .wm { fill: rgba(255,255,255,0.35); font-size: 22px; font-family: sans-serif; }
      </style>
      ${Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) =>
          `<text class="wm" x="${col * (width / 3)}" y="${row * (height / 5) + 20}" transform="rotate(-30 ${col * (width / 3)},${row * (height / 5) + 20})">${watermarkText}</text>`
        ).join('')
      ).join('')}
    </svg>
  `)

  return resized
    .composite([{ input: watermarkSvg, blend: 'over' }])
    .jpeg({ quality: 70 })
    .toBuffer()
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- imagePipeline`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/imagePipeline.ts web/lib/imagePipeline.test.ts web/package.json web/package-lock.json
git commit -m "feat: preview generation with watermark overlay"
```

---

### Task 5: R2 storage client wrapper

**Files:**
- Create: `web/lib/storage.ts`
- Test: `web/lib/storage.test.ts`

**Interfaces:**
- Produces: `uploadObject(key: string, body: Buffer, contentType: string): Promise<void>` and `getSignedDownloadUrl(key: string, expirySeconds: number): Promise<string>`. Used by `web/lib/photoUpload.ts` (Task 6) and the Stripe webhook (Task 11).
- Consumes env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

- [ ] **Step 1: Install AWS SDK v3 packages and mock library**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/web"
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D aws-sdk-client-mock
```

- [ ] **Step 2: Write the failing test**

Create `web/lib/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { uploadObject, getSignedDownloadUrl } from './storage'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
})

describe('uploadObject', () => {
  it('sends a PutObjectCommand with the given key, body and content type', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await uploadObject('previews/evt1/photo1.jpg', Buffer.from('data'), 'image/jpeg')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toBe('previews/evt1/photo1.jpg')
    expect(calls[0].args[0].input.ContentType).toBe('image/jpeg')
  })
})

describe('getSignedDownloadUrl', () => {
  it('returns a URL string for the given key', async () => {
    const url = await getSignedDownloadUrl('originais/evt1/photo1.jpg', 3600)
    expect(url).toContain('originais/evt1/photo1.jpg')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- storage`
Expected: FAIL (`storage.ts` doesn't exist)

- [ ] **Step 4: Implement the wrapper**

Create `web/lib/storage.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function getSignedDownloadUrl(key: string, expirySeconds: number): Promise<string> {
  const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key })
  return getSignedUrl(client(), command, { expiresIn: expirySeconds })
}
```

Add to `web/.env.local.example`:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=orca-eventos-fotos
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- storage`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/storage.ts web/lib/storage.test.ts web/.env.local.example web/package.json web/package-lock.json
git commit -m "feat: R2 storage client wrapper"
```

---

### Task 6: Face service HTTP client + photo upload orchestration

**Files:**
- Create: `web/lib/faceService.ts`
- Create: `web/lib/photoUpload.ts`
- Test: `web/lib/photoUpload.test.ts`

**Interfaces:**
- Consumes: `generatePreview` (Task 4), `uploadObject` (Task 5).
- Produces: `embedImage(imageBuffer: Buffer): Promise<{bbox: number[], embedding: number[]}[]>` in `faceService.ts` — POSTs multipart to `FACE_SERVICE_URL/embed`, matches Task 3's response shape.
- Produces: `processPhotoUpload(deps: PhotoUploadDeps, eventId: string, filename: string, original: Buffer): Promise<PhotoRecord>` in `photoUpload.ts`, where:
  ```typescript
  type PhotoUploadDeps = {
    generatePreview: typeof import('./imagePipeline').generatePreview
    uploadObject: typeof import('./storage').uploadObject
    embedImage: typeof import('./faceService').embedImage
    insertPhoto: (row: { eventId: string; storageKeyPreview: string; storageKeyOriginal: string; hasFace: boolean }) => Promise<{ id: string }>
    insertFaces: (photoId: string, faces: { bbox: number[]; embedding: number[] }[]) => Promise<void>
  }
  type PhotoRecord = { id: string; hasFace: boolean }
  ```
  This dependency-injected shape is what makes the orchestration testable without a real DB/HTTP call; Task 7 (upload API route) supplies the real implementations.

- [ ] **Step 1: Implement the face service client (no test needed — thin HTTP wrapper, covered by Task 6's orchestration test via a fake)**

Create `web/lib/faceService.ts`:

```typescript
export type Face = { bbox: number[]; embedding: number[] }

export async function embedImage(imageBuffer: Buffer): Promise<Face[]> {
  const form = new FormData()
  form.append('image', new Blob([imageBuffer]), 'image.jpg')

  const response = await fetch(`${process.env.FACE_SERVICE_URL}/embed`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(`face-service returned ${response.status}`)
  }

  const data = await response.json()
  return data.faces
}
```

- [ ] **Step 2: Write the failing test for orchestration**

Create `web/lib/photoUpload.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { processPhotoUpload, type PhotoUploadDeps } from './photoUpload'

function makeDeps(overrides: Partial<PhotoUploadDeps> = {}): PhotoUploadDeps {
  return {
    generatePreview: vi.fn().async ? vi.fn() : vi.fn(),
    uploadObject: vi.fn(),
    embedImage: vi.fn(),
    insertPhoto: vi.fn(),
    insertFaces: vi.fn(),
    ...overrides,
  } as unknown as PhotoUploadDeps
}

describe('processPhotoUpload', () => {
  it('uploads preview and original, indexes faces, and marks hasFace true when a face is found', async () => {
    const previewBuffer = Buffer.from('preview')
    const deps = makeDeps({
      generatePreview: vi.fn().mockResolvedValue(previewBuffer),
      uploadObject: vi.fn().mockResolvedValue(undefined),
      embedImage: vi.fn().mockResolvedValue([{ bbox: [0, 0, 10, 10], embedding: new Array(512).fill(0.1) }]),
      insertPhoto: vi.fn().mockResolvedValue({ id: 'photo-1' }),
      insertFaces: vi.fn().mockResolvedValue(undefined),
    })
    const original = Buffer.from('original-bytes')

    const result = await processPhotoUpload(deps, 'event-1', 'foto.jpg', original)

    expect(result).toEqual({ id: 'photo-1', hasFace: true })
    expect(deps.generatePreview).toHaveBeenCalledWith(original, 'Orca Mídias')
    expect(deps.uploadObject).toHaveBeenCalledWith('previews/event-1/foto.jpg', previewBuffer, 'image/jpeg')
    expect(deps.uploadObject).toHaveBeenCalledWith('originais/event-1/foto.jpg', original, 'image/jpeg')
    expect(deps.insertPhoto).toHaveBeenCalledWith({
      eventId: 'event-1',
      storageKeyPreview: 'previews/event-1/foto.jpg',
      storageKeyOriginal: 'originais/event-1/foto.jpg',
      hasFace: true,
    })
    expect(deps.insertFaces).toHaveBeenCalledWith('photo-1', [{ bbox: [0, 0, 10, 10], embedding: expect.any(Array) }])
  })

  it('marks hasFace false and skips insertFaces when no face is detected', async () => {
    const deps = makeDeps({
      generatePreview: vi.fn().mockResolvedValue(Buffer.from('preview')),
      uploadObject: vi.fn().mockResolvedValue(undefined),
      embedImage: vi.fn().mockResolvedValue([]),
      insertPhoto: vi.fn().mockResolvedValue({ id: 'photo-2' }),
      insertFaces: vi.fn().mockResolvedValue(undefined),
    })

    const result = await processPhotoUpload(deps, 'event-1', 'sem-rosto.jpg', Buffer.from('x'))

    expect(result).toEqual({ id: 'photo-2', hasFace: false })
    expect(deps.insertFaces).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- photoUpload`
Expected: FAIL (`photoUpload.ts` doesn't exist)

- [ ] **Step 4: Implement `processPhotoUpload`**

Create `web/lib/photoUpload.ts`:

```typescript
import type { generatePreview } from './imagePipeline'
import type { uploadObject } from './storage'
import type { embedImage } from './faceService'

export type PhotoUploadDeps = {
  generatePreview: typeof generatePreview
  uploadObject: typeof uploadObject
  embedImage: typeof embedImage
  insertPhoto: (row: {
    eventId: string
    storageKeyPreview: string
    storageKeyOriginal: string
    hasFace: boolean
  }) => Promise<{ id: string }>
  insertFaces: (photoId: string, faces: { bbox: number[]; embedding: number[] }[]) => Promise<void>
}

export type PhotoRecord = { id: string; hasFace: boolean }

export async function processPhotoUpload(
  deps: PhotoUploadDeps,
  eventId: string,
  filename: string,
  original: Buffer
): Promise<PhotoRecord> {
  const previewKey = `previews/${eventId}/${filename}`
  const originalKey = `originais/${eventId}/${filename}`

  const preview = await deps.generatePreview(original, 'Orca Mídias')
  await deps.uploadObject(previewKey, preview, 'image/jpeg')
  await deps.uploadObject(originalKey, original, 'image/jpeg')

  const faces = await deps.embedImage(original)
  const hasFace = faces.length > 0

  const photo = await deps.insertPhoto({
    eventId,
    storageKeyPreview: previewKey,
    storageKeyOriginal: originalKey,
    hasFace,
  })

  if (hasFace) {
    await deps.insertFaces(photo.id, faces)
  }

  return { id: photo.id, hasFace }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- photoUpload`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/faceService.ts web/lib/photoUpload.ts web/lib/photoUpload.test.ts
git commit -m "feat: photo upload orchestration (preview + storage + face indexing)"
```

---

### Task 7: Admin API routes + Supabase client

**Files:**
- Create: `web/lib/supabaseClient.ts`
- Create: `web/app/api/admin/events/route.ts`
- Create: `web/app/api/admin/events/[id]/photos/route.ts`

**Interfaces:**
- Consumes: `processPhotoUpload` (Task 6), schema from Task 2 (`orca_eventos.events`, `orca_eventos.photos`, `orca_eventos.faces`).
- Produces: `POST /api/admin/events` — body `{ name: string, slug: string, eventDate: string }` → `201 { id, name, slug, eventDate }`. `POST /api/admin/events/[id]/photos` — multipart field `photos` (one or more files) → `200 { uploaded: PhotoRecord[] }`.

- [ ] **Step 1: Install Supabase client and set up env**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/web"
npm install @supabase/supabase-js
```

Add to `web/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FACE_SERVICE_URL=http://localhost:8000
```

- [ ] **Step 2: Create the Supabase client**

Create `web/lib/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: 'orca_eventos' },
  })
}
```

- [ ] **Step 3: Implement the create-event route**

Create `web/app/api/admin/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, slug, eventDate } = body

  if (!name || !slug || !eventDate) {
    return NextResponse.json({ error: 'name, slug and eventDate are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('events')
    .insert({ name, slug, event_date: eventDate })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(
    { id: data.id, name: data.name, slug: data.slug, eventDate: data.event_date },
    { status: 201 }
  )
}
```

- [ ] **Step 4: Implement the bulk photo upload route**

Create `web/app/api/admin/events/[id]/photos/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { processPhotoUpload, type PhotoUploadDeps } from '@/lib/photoUpload'
import { generatePreview } from '@/lib/imagePipeline'
import { uploadObject } from '@/lib/storage'
import { embedImage } from '@/lib/faceService'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const eventId = params.id
  const formData = await request.formData()
  const files = formData.getAll('photos') as File[]

  const db = supabaseAdmin()
  const deps: PhotoUploadDeps = {
    generatePreview,
    uploadObject,
    embedImage,
    insertPhoto: async (row) => {
      const { data, error } = await db
        .from('photos')
        .insert({
          event_id: row.eventId,
          storage_key_preview: row.storageKeyPreview,
          storage_key_original: row.storageKeyOriginal,
          has_face: row.hasFace,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { id: data.id }
    },
    insertFaces: async (photoId, faces) => {
      const { error } = await db.from('faces').insert(
        faces.map((f) => ({ photo_id: photoId, embedding: f.embedding, bbox: f.bbox }))
      )
      if (error) throw new Error(error.message)
    },
  }

  const uploaded = []
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await processPhotoUpload(deps, eventId, file.name, buffer)
    uploaded.push(result)
  }

  return NextResponse.json({ uploaded })
}
```

- [ ] **Step 5: Manual verification**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/web"
npm run dev
```

In another terminal, with the face-service (Task 3) also running on port 8000:

```bash
curl -X POST http://localhost:3000/api/admin/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Evento Teste","slug":"evento-teste","eventDate":"2026-09-01"}'
```

Expected: `201` with the created event JSON. Then upload a photo with the returned `id` to `/api/admin/events/<id>/photos` as multipart form data and confirm `200 { uploaded: [...] }`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/supabaseClient.ts web/app/api/admin web/.env.local.example web/package.json web/package-lock.json
git commit -m "feat: admin event creation and bulk photo upload API routes"
```

---

### Task 8: Selfie search — orchestration + API route

**Files:**
- Create: `web/lib/search.ts`
- Create: `web/app/api/events/[slug]/search/route.ts`
- Test: `web/lib/search.test.ts`

**Interfaces:**
- Consumes: `embedImage` (Task 6), `orca_eventos.match_faces` RPC (Task 2).
- Produces: `searchBySelfie(deps: SearchDeps, eventId: string, selfie: Buffer): Promise<{photoId: string, similarity: number}[]>` where:
  ```typescript
  type SearchDeps = {
    embedImage: typeof import('./faceService').embedImage
    matchFaces: (embedding: number[], eventId: string) => Promise<{ photoId: string; similarity: number }[]>
  }
  ```
- Produces: `POST /api/events/[slug]/search` — multipart field `selfie` → `200 { results: [{ photoId, previewUrl }] }`, or `400 { error: 'no_face_detected' }`.

- [ ] **Step 1: Write the failing test for `searchBySelfie`**

Create `web/lib/search.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { searchBySelfie, type SearchDeps } from './search'

describe('searchBySelfie', () => {
  it('embeds the selfie and returns matches from matchFaces', async () => {
    const embedding = new Array(512).fill(0.2)
    const deps: SearchDeps = {
      embedImage: vi.fn().mockResolvedValue([{ bbox: [0, 0, 1, 1], embedding }]),
      matchFaces: vi.fn().mockResolvedValue([{ photoId: 'p1', similarity: 0.91 }]),
    }

    const results = await searchBySelfie(deps, 'event-1', Buffer.from('selfie'))

    expect(deps.matchFaces).toHaveBeenCalledWith(embedding, 'event-1')
    expect(results).toEqual([{ photoId: 'p1', similarity: 0.91 }])
  })

  it('throws NO_FACE_DETECTED when the selfie has no face', async () => {
    const deps: SearchDeps = {
      embedImage: vi.fn().mockResolvedValue([]),
      matchFaces: vi.fn(),
    }

    await expect(searchBySelfie(deps, 'event-1', Buffer.from('selfie'))).rejects.toThrow('NO_FACE_DETECTED')
    expect(deps.matchFaces).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- search`
Expected: FAIL (`search.ts` doesn't exist)

- [ ] **Step 3: Implement `searchBySelfie`**

Create `web/lib/search.ts`:

```typescript
import type { embedImage } from './faceService'

export type SearchDeps = {
  embedImage: typeof embedImage
  matchFaces: (embedding: number[], eventId: string) => Promise<{ photoId: string; similarity: number }[]>
}

export const SIMILARITY_THRESHOLD = 0.55
export const MAX_RESULTS = 200

export async function searchBySelfie(
  deps: SearchDeps,
  eventId: string,
  selfie: Buffer
): Promise<{ photoId: string; similarity: number }[]> {
  const faces = await deps.embedImage(selfie)

  if (faces.length === 0) {
    throw new Error('NO_FACE_DETECTED')
  }

  return deps.matchFaces(faces[0].embedding, eventId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- search`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement the API route (also records LGPD consent — spec §6)**

Create `web/app/api/events/[slug]/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { searchBySelfie, SIMILARITY_THRESHOLD, MAX_RESULTS } from '@/lib/search'
import { embedImage } from '@/lib/faceService'

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const db = supabaseAdmin()

  const { data: event, error: eventError } = await db
    .from('events')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  const formData = await request.formData()
  const selfieFile = formData.get('selfie') as File | null
  if (!selfieFile) {
    return NextResponse.json({ error: 'selfie_required' }, { status: 400 })
  }

  await db.from('consents').insert({
    event_id: event.id,
    ip_address: request.headers.get('x-forwarded-for'),
  })

  const selfieBuffer = Buffer.from(await selfieFile.arrayBuffer())

  try {
    const matches = await searchBySelfie(
      {
        embedImage,
        matchFaces: async (embedding, eventId) => {
          const { data, error } = await db.rpc('match_faces', {
            query_embedding: embedding,
            p_event_id: eventId,
            match_threshold: SIMILARITY_THRESHOLD,
            match_count: MAX_RESULTS,
          })
          if (error) throw new Error(error.message)
          return data.map((row: { photo_id: string; similarity: number }) => ({
            photoId: row.photo_id,
            similarity: row.similarity,
          }))
        },
      },
      event.id,
      selfieBuffer
    )

    const photoIds = matches.map((m) => m.photoId)
    const { data: photos } = await db.from('photos').select('id, storage_key_preview').in('id', photoIds)

    const results = matches.map((m) => ({
      photoId: m.photoId,
      previewUrl: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${photos?.find((p) => p.id === m.photoId)?.storage_key_preview}`,
    }))

    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_FACE_DETECTED') {
      return NextResponse.json({ error: 'no_face_detected' }, { status: 400 })
    }
    throw err
  }
}
```

Add `NEXT_PUBLIC_R2_PUBLIC_URL=` to `web/.env.local.example`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/search.ts web/lib/search.test.ts web/app/api/events web/.env.local.example
git commit -m "feat: selfie search orchestration and API route with consent logging"
```

---

### Task 9: Public event page — selfie uploader, gallery, blur-on-focus-loss

**Files:**
- Create: `web/components/useBlurOnFocusLoss.ts`
- Create: `web/components/SelfieUploader.tsx`
- Create: `web/components/PhotoGrid.tsx`
- Create: `web/app/e/[slug]/page.tsx`
- Test: `web/components/useBlurOnFocusLoss.test.ts`

**Interfaces:**
- Consumes: `POST /api/events/[slug]/search` (Task 8).
- Produces: `useBlurOnFocusLoss(): boolean` — a hook returning `true` while the window is out of focus, used by `PhotoGrid` to toggle a CSS blur class on preview images (spec §4.4 deterrence layer).

- [ ] **Step 1: Write the failing test for the hook**

Create `web/components/useBlurOnFocusLoss.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBlurOnFocusLoss } from './useBlurOnFocusLoss'

describe('useBlurOnFocusLoss', () => {
  it('starts false, becomes true on window blur, false again on focus', () => {
    const { result } = renderHook(() => useBlurOnFocusLoss())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- useBlurOnFocusLoss`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement the hook**

Create `web/components/useBlurOnFocusLoss.ts`:

```typescript
import { useEffect, useState } from 'react'

export function useBlurOnFocusLoss(): boolean {
  const [isBlurred, setIsBlurred] = useState(false)

  useEffect(() => {
    const onBlur = () => setIsBlurred(true)
    const onFocus = () => setIsBlurred(false)

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return isBlurred
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- useBlurOnFocusLoss`
Expected: PASS (1 test)

- [ ] **Step 5: Implement `PhotoGrid`**

Create `web/components/PhotoGrid.tsx`:

```typescript
'use client'

import { useBlurOnFocusLoss } from './useBlurOnFocusLoss'

type PhotoResult = { photoId: string; previewUrl: string }

export function PhotoGrid({
  photos,
  selected,
  onToggle,
}: {
  photos: PhotoResult[]
  selected: Set<string>
  onToggle: (photoId: string) => void
}) {
  const isBlurred = useBlurOnFocusLoss()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {photos.map((photo) => (
        <button
          key={photo.photoId}
          onClick={() => onToggle(photo.photoId)}
          className={`relative border-2 rounded ${selected.has(photo.photoId) ? 'border-blue-500' : 'border-transparent'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.previewUrl}
            alt="Prévia da foto"
            className={`w-full h-full object-cover rounded transition-all ${isBlurred ? 'blur-lg' : ''}`}
          />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Implement `SelfieUploader` and the event page**

Create `web/components/SelfieUploader.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { PhotoGrid } from './PhotoGrid'

type PhotoResult = { photoId: string; previewUrl: string }

export function SelfieUploader({ slug }: { slug: string }) {
  const [consented, setConsented] = useState(false)
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function handleFile(file: File) {
    setError(null)
    const formData = new FormData()
    formData.append('selfie', file)

    const response = await fetch(`/api/events/${slug}/search`, { method: 'POST', body: formData })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error === 'no_face_detected' ? 'Não achamos um rosto nessa foto. Tente outra, com boa iluminação.' : 'Erro ao buscar fotos.')
      return
    }

    setResults(data.results)
  }

  function toggle(photoId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(photoId) ? next.delete(photoId) : next.add(photoId)
      return next
    })
  }

  if (!consented) {
    return (
      <div>
        <p>Para achar suas fotos, vamos processar uma selfie sua apenas para comparação facial neste evento. Os dados são processados em servidor próprio da Orca Mídias e removidos após 120 dias.</p>
        <button onClick={() => setConsented(true)}>Concordo, continuar</button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {error && <p role="alert">{error}</p>}
      {results && <PhotoGrid photos={results} selected={selected} onToggle={toggle} />}
    </div>
  )
}
```

Create `web/app/e/[slug]/page.tsx`:

```typescript
import { SelfieUploader } from '@/components/SelfieUploader'

export default function EventPage({ params }: { params: { slug: string } }) {
  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Encontre suas fotos</h1>
      <SelfieUploader slug={params.slug} />
    </main>
  )
}
```

- [ ] **Step 7: Run full test suite**

Run: `npm run test`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/components web/app/e
git commit -m "feat: public event page with selfie search, consent gate, blur deterrent"
```

---

### Task 10: Stripe checkout session creation

**Files:**
- Create: `web/lib/checkout.ts`
- Create: `web/app/api/checkout/route.ts`
- Test: `web/lib/checkout.test.ts`

**Interfaces:**
- Produces: `buildCheckoutSession(deps: CheckoutDeps, eventId: string, photoIds: string[], buyerEmail: string): Promise<{ url: string }>` where:
  ```typescript
  type CheckoutDeps = {
    createStripeSession: (params: { line_items: { price_data: object; quantity: number }[]; customer_email: string; metadata: Record<string, string>; success_url: string; cancel_url: string }) => Promise<{ url: string | null }>
    insertPurchase: (row: { eventId: string; stripeSessionId: string; buyerEmail: string }) => Promise<void>
  }
  ```

- [ ] **Step 1: Install Stripe SDK**

```bash
cd "C:/Users/Riti/orca-eventos-fotos/web"
npm install stripe
```

Add to `web/.env.local.example`: `STRIPE_SECRET_KEY=` and `STRIPE_WEBHOOK_SECRET=` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and `PHOTO_PRICE_CENTS=1500`.

- [ ] **Step 2: Write the failing test**

Create `web/lib/checkout.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildCheckoutSession, type CheckoutDeps } from './checkout'

describe('buildCheckoutSession', () => {
  it('creates one line item per photo, records the purchase, and returns the session url', async () => {
    const deps: CheckoutDeps = {
      createStripeSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session-123' }),
      insertPurchase: vi.fn().mockResolvedValue(undefined),
    }

    const result = await buildCheckoutSession(deps, 'event-1', ['p1', 'p2'], 'buyer@example.com')

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session-123' })
    const call = (deps.createStripeSession as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.line_items).toHaveLength(2)
    expect(call.customer_email).toBe('buyer@example.com')
    expect(call.metadata).toEqual({ eventId: 'event-1', photoIds: 'p1,p2' })
    expect(deps.insertPurchase).toHaveBeenCalledWith({
      eventId: 'event-1',
      stripeSessionId: expect.stringContaining('session-123'),
      buyerEmail: 'buyer@example.com',
    })
  })

  it('throws when Stripe returns no url', async () => {
    const deps: CheckoutDeps = {
      createStripeSession: vi.fn().mockResolvedValue({ url: null }),
      insertPurchase: vi.fn(),
    }

    await expect(buildCheckoutSession(deps, 'event-1', ['p1'], 'buyer@example.com')).rejects.toThrow(
      'STRIPE_SESSION_MISSING_URL'
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- checkout`
Expected: FAIL (`checkout.ts` doesn't exist)

- [ ] **Step 4: Implement `buildCheckoutSession`**

Create `web/lib/checkout.ts`:

```typescript
export type CheckoutDeps = {
  createStripeSession: (params: {
    line_items: { price_data: object; quantity: number }[]
    customer_email: string
    metadata: Record<string, string>
    success_url: string
    cancel_url: string
  }) => Promise<{ url: string | null }>
  insertPurchase: (row: { eventId: string; stripeSessionId: string; buyerEmail: string }) => Promise<void>
}

export async function buildCheckoutSession(
  deps: CheckoutDeps,
  eventId: string,
  photoIds: string[],
  buyerEmail: string
): Promise<{ url: string }> {
  const priceCents = Number(process.env.PHOTO_PRICE_CENTS ?? 1500)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await deps.createStripeSession({
    line_items: photoIds.map(() => ({
      price_data: {
        currency: 'brl',
        product_data: { name: 'Foto do evento (alta resolução)' },
        unit_amount: priceCents,
      },
      quantity: 1,
    })),
    customer_email: buyerEmail,
    metadata: { eventId, photoIds: photoIds.join(',') },
    success_url: `${siteUrl}/e/obrigado?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/e`,
  })

  if (!session.url) {
    throw new Error('STRIPE_SESSION_MISSING_URL')
  }

  await deps.insertPurchase({
    eventId,
    stripeSessionId: session.url.split('/').pop() ?? session.url,
    buyerEmail,
  })

  return { url: session.url }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- checkout`
Expected: PASS (2 tests)

- [ ] **Step 6: Implement the API route**

Create `web/app/api/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { buildCheckoutSession } from '@/lib/checkout'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const { eventId, photoIds, buyerEmail } = await request.json()

  if (!eventId || !Array.isArray(photoIds) || photoIds.length === 0 || !buyerEmail) {
    return NextResponse.json({ error: 'eventId, photoIds and buyerEmail are required' }, { status: 400 })
  }

  const db = supabaseAdmin()

  const result = await buildCheckoutSession(
    {
      createStripeSession: (params) => stripe.checkout.sessions.create({ mode: 'payment', ...params }),
      insertPurchase: async (row) => {
        const { error } = await db.from('purchases').insert({
          event_id: row.eventId,
          stripe_session_id: row.stripeSessionId,
          buyer_email: row.buyerEmail,
        })
        if (error) throw new Error(error.message)
      },
    },
    eventId,
    photoIds,
    buyerEmail
  )

  return NextResponse.json(result)
}
```

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/checkout.ts web/lib/checkout.test.ts web/app/api/checkout web/.env.local.example web/package.json web/package-lock.json
git commit -m "feat: Stripe checkout session creation"
```

---

### Task 11: Stripe webhook — unlock originals after payment

**Files:**
- Create: `web/lib/webhookHandler.ts`
- Create: `web/app/api/webhooks/stripe/route.ts`
- Create: `web/app/e/obrigado/page.tsx`
- Test: `web/lib/webhookHandler.test.ts`

**Interfaces:**
- Consumes: `getSignedDownloadUrl` (Task 5).
- Produces: `handleCheckoutCompleted(deps: WebhookDeps, session: { id: string; metadata: { eventId: string; photoIds: string } }): Promise<void>` where:
  ```typescript
  type WebhookDeps = {
    markPurchasePaid: (stripeSessionId: string) => Promise<void>
    linkPurchasePhotos: (stripeSessionId: string, photoIds: string[]) => Promise<void>
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `web/lib/webhookHandler.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { handleCheckoutCompleted, type WebhookDeps } from './webhookHandler'

describe('handleCheckoutCompleted', () => {
  it('marks the purchase as paid and links the purchased photos', async () => {
    const deps: WebhookDeps = {
      markPurchasePaid: vi.fn().mockResolvedValue(undefined),
      linkPurchasePhotos: vi.fn().mockResolvedValue(undefined),
    }

    await handleCheckoutCompleted(deps, {
      id: 'sess_123',
      metadata: { eventId: 'event-1', photoIds: 'p1,p2' },
    })

    expect(deps.markPurchasePaid).toHaveBeenCalledWith('sess_123')
    expect(deps.linkPurchasePhotos).toHaveBeenCalledWith('sess_123', ['p1', 'p2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- webhookHandler`
Expected: FAIL (`webhookHandler.ts` doesn't exist)

- [ ] **Step 3: Implement `handleCheckoutCompleted`**

Create `web/lib/webhookHandler.ts`:

```typescript
export type WebhookDeps = {
  markPurchasePaid: (stripeSessionId: string) => Promise<void>
  linkPurchasePhotos: (stripeSessionId: string, photoIds: string[]) => Promise<void>
}

export async function handleCheckoutCompleted(
  deps: WebhookDeps,
  session: { id: string; metadata: { eventId: string; photoIds: string } }
): Promise<void> {
  await deps.markPurchasePaid(session.id)
  await deps.linkPurchasePhotos(session.id, session.metadata.photoIds.split(','))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- webhookHandler`
Expected: PASS (1 test)

- [ ] **Step 5: Implement the webhook route**

Create `web/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { handleCheckoutCompleted } from '@/lib/webhookHandler'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const db = supabaseAdmin()

    await handleCheckoutCompleted(
      {
        markPurchasePaid: async (stripeSessionId) => {
          const { error } = await db.from('purchases').update({ status: 'paid' }).eq('stripe_session_id', stripeSessionId)
          if (error) throw new Error(error.message)
        },
        linkPurchasePhotos: async (stripeSessionId, photoIds) => {
          const { data: purchase, error: purchaseError } = await db
            .from('purchases')
            .select('id')
            .eq('stripe_session_id', stripeSessionId)
            .single()
          if (purchaseError || !purchase) throw new Error(purchaseError?.message ?? 'purchase_not_found')

          const { error } = await db
            .from('purchase_photos')
            .insert(photoIds.map((photoId) => ({ purchase_id: purchase.id, photo_id: photoId })))
          if (error) throw new Error(error.message)
        },
      },
      { id: session.id, metadata: session.metadata as { eventId: string; photoIds: string } }
    )
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 6: Implement the thank-you/download page**

Create `web/app/e/obrigado/page.tsx`:

```typescript
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getSignedDownloadUrl } from '@/lib/storage'

export default async function ObrigadoPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id
  if (!sessionId) {
    return <p>Sessão inválida.</p>
  }

  const db = supabaseAdmin()
  const { data: purchase } = await db
    .from('purchases')
    .select('id, status')
    .eq('stripe_session_id', sessionId)
    .single()

  if (!purchase || purchase.status !== 'paid') {
    return <p>Pagamento ainda não confirmado. Atualize a página em instantes.</p>
  }

  const { data: purchasedPhotos } = await db
    .from('purchase_photos')
    .select('photos(storage_key_original)')
    .eq('purchase_id', purchase.id)

  const links = await Promise.all(
    (purchasedPhotos ?? []).map(async (row: { photos: { storage_key_original: string } | { storage_key_original: string }[] }) => {
      const photo = Array.isArray(row.photos) ? row.photos[0] : row.photos
      return getSignedDownloadUrl(photo.storage_key_original, 3600 * 6)
    })
  )

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Pagamento confirmado!</h1>
      <ul>
        {links.map((url, i) => (
          <li key={i}>
            <a href={url} className="text-blue-600 underline">
              Baixar foto {i + 1}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-gray-500 mt-4">Os links expiram em algumas horas.</p>
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/lib/webhookHandler.ts web/lib/webhookHandler.test.ts web/app/api/webhooks web/app/e/obrigado
git commit -m "feat: Stripe webhook unlocks signed download URLs, thank-you page"
```

---

### Task 12: LGPD retention — purge expired faces/consents

**Files:**
- Create: `web/scripts/purge-expired-faces.ts`
- Test: `web/scripts/purge-expired-faces.test.ts`

**Interfaces:**
- Produces: `purgeExpiredFaces(deps: PurgeDeps, now: Date, retentionDays: number): Promise<{ purgedFaces: number; purgedConsents: number }>` where:
  ```typescript
  type PurgeDeps = {
    deleteFacesOlderThan: (cutoff: Date) => Promise<number>
    deleteConsentsOlderThan: (cutoff: Date) => Promise<number>
  }
  ```
  Intended to run as a scheduled job (cron on the G3 Mídia VM) calling this script daily.

- [ ] **Step 1: Write the failing test**

Create `web/scripts/purge-expired-faces.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { purgeExpiredFaces, type PurgeDeps } from './purge-expired-faces'

describe('purgeExpiredFaces', () => {
  it('computes the cutoff date from retentionDays and returns counts', async () => {
    const deps: PurgeDeps = {
      deleteFacesOlderThan: vi.fn().mockResolvedValue(12),
      deleteConsentsOlderThan: vi.fn().mockResolvedValue(3),
    }
    const now = new Date('2026-08-26T00:00:00Z')

    const result = await purgeExpiredFaces(deps, now, 120)

    const expectedCutoff = new Date('2026-04-28T00:00:00Z')
    expect(deps.deleteFacesOlderThan).toHaveBeenCalledWith(expectedCutoff)
    expect(deps.deleteConsentsOlderThan).toHaveBeenCalledWith(expectedCutoff)
    expect(result).toEqual({ purgedFaces: 12, purgedConsents: 3 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- purge-expired-faces`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement `purgeExpiredFaces`**

Create `web/scripts/purge-expired-faces.ts`:

```typescript
export type PurgeDeps = {
  deleteFacesOlderThan: (cutoff: Date) => Promise<number>
  deleteConsentsOlderThan: (cutoff: Date) => Promise<number>
}

export async function purgeExpiredFaces(
  deps: PurgeDeps,
  now: Date,
  retentionDays: number
): Promise<{ purgedFaces: number; purgedConsents: number }> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

  const purgedFaces = await deps.deleteFacesOlderThan(cutoff)
  const purgedConsents = await deps.deleteConsentsOlderThan(cutoff)

  return { purgedFaces, purgedConsents }
}

if (require.main === module) {
  const { supabaseAdmin } = require('../lib/supabaseClient')
  const db = supabaseAdmin()

  purgeExpiredFaces(
    {
      deleteFacesOlderThan: async (cutoff) => {
        const { data, error } = await db.from('faces').delete().lt('created_at', cutoff.toISOString()).select('id')
        if (error) throw new Error(error.message)
        return data?.length ?? 0
      },
      deleteConsentsOlderThan: async (cutoff) => {
        const { data, error } = await db.from('consents').delete().lt('consented_at', cutoff.toISOString()).select('id')
        if (error) throw new Error(error.message)
        return data?.length ?? 0
      },
    },
    new Date(),
    Number(process.env.FACE_RETENTION_DAYS ?? 120)
  ).then((result: { purgedFaces: number; purgedConsents: number }) =>
    console.log(`Purged ${result.purgedFaces} faces, ${result.purgedConsents} consents`)
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- purge-expired-faces`
Expected: PASS (1 test)

- [ ] **Step 5: Schedule it (cron on G3 Mídia VM, once the app is deployed there)**

```bash
# crontab -e on the VM, once deployed:
0 3 * * * cd /path/to/orca-eventos-fotos/web && npx tsx scripts/purge-expired-faces.ts >> /var/log/orca-purge.log 2>&1
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Riti/orca-eventos-fotos"
git add web/scripts/purge-expired-faces.ts web/scripts/purge-expired-faces.test.ts
git commit -m "feat: LGPD retention job to purge expired face embeddings and consents"
```

---

## Self-Review Notes

- **Spec coverage:** §1-2 (upload flow) → Tasks 6-7; §3 (architecture) → Tasks 1-3, 5; §4.1 → Task 7; §4.2 → Tasks 8-9; §4.3 → Tasks 10-11; §4.4 → Task 9; §5 (errors: no face, zero results, Stripe failure) → Tasks 6, 8, 9, 11 (cancel_url); §6 (LGPD) → Tasks 8 (consent), 12 (retention); §7 (tests) → every task's TDD steps; §8 (storage/cost) → Task 5 (R2, no egress).
- **Placeholder scan:** none found — all code blocks are complete, no TBD/TODO.
- **Type consistency:** `PhotoRecord { id, hasFace }` (Task 6) matches the `uploaded` array returned by Task 7's route. `Face { bbox, embedding }` (Task 3, Task 6) is consistent across `faceService.ts`, `photoUpload.ts`, `search.ts`. `match_faces` RPC signature (Task 2) matches the `matchFaces` call in Task 8's route.
- **Not covered in this plan (flagged, out of scope for MVP per spec §2/§9):** admin UI polish/visual design pass, pricing-model business logic (flat per-photo price used as a placeholder default, package pricing is a business decision), production deployment/CI config, email delivery of download links (buyer currently gets links only on the `/e/obrigado` page).
