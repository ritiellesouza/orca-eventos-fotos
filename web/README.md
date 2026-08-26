# Orca Mídias — plataforma de fotos de eventos

Self-hosted event-photo platform. Guests upload a selfie, a self-hosted
InsightFace service matches it against the photos of that event, and matched
photos are sold through Stripe. Biometric data never leaves the VM.

Three moving parts:

| Part | Path | What it is |
| --- | --- | --- |
| Web app | `web/` | Next.js 14 (App Router). Public event pages, admin upload API, Stripe checkout + webhook. |
| Face service | `face-service/` | Python FastAPI + InsightFace. Turns an image into 512-dimension face embeddings. Private network only. |
| Database | `supabase/migrations/` | Postgres + pgvector, in its own `orca_eventos` schema. |

Storage is Cloudflare R2 (two buckets — see below). Payments are Stripe.

---

## 1. Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (the service is developed against 3.13)
- A Supabase project (or any Postgres 16 with the `vector` extension) you can
  run migrations against and configure PostgREST for
- A Cloudflare R2 account
- A Stripe account
- Docker, if you want to verify the migration locally

---

## 2. Environment variables

Copy the template and fill it in:

```bash
cd web
cp .env.local.example .env.local
```

Nothing has a usable default except the two localhost URLs. Missing variables
now fail loudly by name (`lib/env.ts`) rather than producing
`https://undefined.r2.cloudflarestorage.com` or `undefined/undefined` preview
URLs, so an incomplete `.env.local` shows up as a clear error, not as a broken
page that returns 200.

### Supabase

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, e.g. `https://xxxx.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key. **Server-side only** — it bypasses RLS. Never expose it to the browser. |

The app talks to Postgres exclusively with the service-role key, against the
`orca_eventos` schema (`web/lib/supabaseClient.ts`). See §4 — the schema must be
exposed to PostgREST or every call 404s.

### Cloudflare R2

| Variable | Notes |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id; forms the S3 endpoint. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token credentials. |
| `R2_BUCKET_PREVIEWS` | Bucket holding watermarked previews. **Public.** |
| `R2_BUCKET_ORIGINALS` | Bucket holding unwatermarked originals. **Private.** |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Public domain bound to the **previews bucket only**, no trailing slash. |

### Face service

| Variable | Notes |
| --- | --- |
| `FACE_SERVICE_URL` | Internal URL of the FastAPI service, e.g. `http://127.0.0.1:8000`. Must not be publicly routable. |
| `FACE_SERVICE_TOKEN` | Shared secret sent as `X-Face-Service-Token`. Must match the value in the face-service process environment. |

### Stripe

| Variable | Notes |
| --- | --- |
| `STRIPE_SECRET_KEY` | Secret API key (`sk_test_…` / `sk_live_…`). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the `/api/webhooks/stripe` endpoint (`whsec_…`). |
| `NEXT_PUBLIC_SITE_URL` | Public origin, used to build Stripe `success_url` / `cancel_url`. |
| `PHOTO_PRICE_CENTS` | Per-photo price in cents. Read server-side; the client only ever sends photo ids. |

### Admin auth

| Variable | Notes |
| --- | --- |
| `ADMIN_TOKEN` | Shared secret guarding every `/api/admin/*` route. Sent as `Authorization: Bearer <token>`. |

Generate the two secrets with:

```bash
openssl rand -hex 32
```

`web/middleware.ts` is **fail-closed**: with `ADMIN_TOKEN` unset, every admin
route returns `500 admin_auth_not_configured`. The face service behaves the same
way for `FACE_SERVICE_TOKEN`. That is deliberate — a misconfigured deploy must
never serve those routes anonymously.

### Retention (optional)

| Variable | Notes |
| --- | --- |
| `FACE_RETENTION_DAYS` | Days to keep face embeddings and consent records. Defaults to `120`. Used by the purge job (§8). |

---

## 3. Database migration

Apply `supabase/migrations/0001_orca_eventos_schema.sql` to your database. Via
the Supabase SQL editor, or:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_orca_eventos_schema.sql
```

It creates the `vector` extension, the `orca_eventos` schema (`events`,
`photos`, `faces`, `consents`, `purchases`, `purchase_photos`), the
`orca_eventos.match_faces` RPC, and revokes all access from `anon` and
`authenticated`.

Two things worth knowing before you "improve" it:

- **There is deliberately no ANN index on `faces.embedding`.** An `ivfflat`
  index built against an empty table produces degenerate k-means centroids;
  later inserts land in arbitrary lists and queries (default `probes = 1`)
  silently return *incomplete* matches with no error. At MVP scale (~2–5k
  vectors per event, always filtered by `event_id`) the exact sequential scan is
  single-digit milliseconds. If an index ever becomes necessary, use HNSW — it
  does not depend on data being present at build time.
- **The `revoke` statements at the end are load-bearing.** Exposing
  `orca_eventos` to PostgREST (next section) would otherwise also hand the
  public anon key read access to these tables, including `faces` — biometric
  embeddings.

The closing `revoke` statements reference the `anon` and `authenticated` roles,
so the migration expects a Supabase-style database. On any Supabase instance
(cloud or self-hosted) those roles already exist. On a bare Postgres image they
do not, and the migration stops at the first `revoke` with
`role "anon" does not exist` — create the roles first.

### Verifying it applies cleanly

```bash
docker run -d --name migration-check -e POSTGRES_PASSWORD=test -p 5433:5432 pgvector/pgvector:pg16
# wait for readiness:
docker exec migration-check pg_isready -U postgres
# the stock image has no Supabase roles, so create them before the revokes run:
docker exec migration-check psql -U postgres -c "create role anon; create role authenticated; create role service_role;"
docker exec -i migration-check psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/0001_orca_eventos_schema.sql
docker exec migration-check psql -U postgres -c "select proname from pg_proc where proname = 'match_faces';"
docker stop migration-check && docker rm migration-check
```

---

## 4. Exposing `orca_eventos` to PostgREST — do not skip this

Every table lives in the `orca_eventos` schema, not `public`. PostgREST (the
layer behind `supabase-js`) only serves schemas it has been told about. **Until
you do this, every `.from()` and `.rpc()` call in the app returns 404** — event
lookups, photo inserts, face inserts, the search RPC, checkout, the webhook, and
the purge job. It is the single most common way to get a fully-configured
install that does nothing.

Add the schema to PostgREST's exposed list:

```
PGRST_DB_SCHEMAS=public,storage,graphql_public,orca_eventos
```

- **Supabase Cloud:** Dashboard → Project Settings → API → *Exposed schemas* —
  add `orca_eventos`. (Equivalent to the env var above.)
- **Self-hosted Supabase** (this project deploys to the G3 Mídia VM): set
  `PGRST_DB_SCHEMAS` in the `rest` service environment and restart it.

Then grant the roles PostgREST authenticates as usage on the schema:

```sql
grant usage on schema orca_eventos to anon, authenticated, service_role;
grant all on all tables in schema orca_eventos to service_role;
grant all on all sequences in schema orca_eventos to service_role;
grant execute on function orca_eventos.match_faces(vector(512), uuid, float, int) to service_role;
```

`usage on schema` for `anon`/`authenticated` only lets PostgREST resolve the
schema — it grants no table access. The migration's `revoke all on all tables …
from anon, authenticated` is what keeps those roles out of the data, and it must
stay that way. Only `service_role` gets table privileges, and the service-role
key is server-side only.

Sanity check once it is live — this should return `200`, not `404`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: orca_eventos" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/events?select=id&limit=1"
```

---

## 5. Cloudflare R2 — two buckets, on purpose

R2 grants public read **per bucket, never per prefix**. Previews and originals
therefore cannot share one bucket: the moment public access is enabled so
previews render, `https://<public-domain>/originais/<eventId>/<file>.jpg` would
hand out the paid, unwatermarked original for free and bypass payment entirely.

Create both:

1. **Previews bucket** (`R2_BUCKET_PREVIEWS`, e.g. `orca-eventos-previews`)
   - Settings → Public access → connect a custom domain, or enable the
     `r2.dev` subdomain.
   - Put that origin in `NEXT_PUBLIC_R2_PUBLIC_URL`, **without** a trailing
     slash. This is the only bucket that gets a public domain.
2. **Originals bucket** (`R2_BUCKET_ORIGINALS`, e.g. `orca-eventos-originais`)
   - Leave public access **disabled**. No custom domain, no `r2.dev`.
   - Originals are only ever served through presigned URLs generated after a
     Stripe payment is confirmed.

Then create the API credentials: R2 → *Manage API Tokens* → Create API token,
**Object Read & Write**, scoped to those two buckets. Put the values in
`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, and the account id in
`R2_ACCOUNT_ID`.

Verify before going live: `curl -I <NEXT_PUBLIC_R2_PUBLIC_URL>/<any preview key>`
should be `200`, and the originals bucket must have no public URL at all.

---

## 6. Running the face service

```bash
cd face-service
python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash);  .venv/bin/activate on Linux
pip install -r requirements.txt
```

**Model download.** `app/embed.py` lazily constructs InsightFace's `buffalo_l`
model pack on first use and InsightFace downloads it automatically into
`~/.insightface/models/` (a few hundred MB). It happens on the *first request*,
not at import, so the first `/embed` call after a cold start is slow and needs
outbound network. On a fresh box, warm it up before taking traffic.

Run it:

```bash
# with the venv activated, from face-service/
FACE_SERVICE_TOKEN=<same value as the web app's> \
  uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Two non-negotiables:

- **Bind to a private interface.** `--host 127.0.0.1` when the web app is on the
  same box; otherwise an internal/VPN address. Never `0.0.0.0` on a shared VM —
  this is the CPU-expensive part of the stack and it sees every selfie.
- **`FACE_SERVICE_TOKEN` must be set**, and must match the web app's copy.
  `/embed` compares the `X-Face-Service-Token` header against it and returns
  `500 face_service_token_not_configured` when the variable is missing, so the
  service is unusable rather than open if you forget.

`/embed` also refuses bodies over 15MB with a `413` (a backstop above the web
app's own 10MB selfie cap).

Tests:

```bash
# with the venv activated, from face-service/
pytest tests/test_embed.py -v
```

The test module sets `FACE_SERVICE_TOKEN` itself, so no extra setup is needed.

---

## 7. Running the web app

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Checks:

```bash
npm run test           # vitest
npx tsc --noEmit       # typecheck
npm run lint
```

### Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `/e/[slug]` | public | Event page — selfie upload, consent gate, results grid. |
| `/e/obrigado` | public | Post-payment page; exchanges `session_id` for signed download URLs. |
| `POST /api/events/[slug]/search` | public, rate-limited | Selfie → face match. Requires `consent=true` in the form body. |
| `POST /api/checkout` | public | Creates a Stripe Checkout session. Price is server-side. |
| `POST /api/webhooks/stripe` | Stripe signature | Marks the purchase paid and unlocks downloads. |
| `POST /api/admin/events` | `ADMIN_TOKEN` | Create an event. |
| `POST /api/admin/events/[id]/photos` | `ADMIN_TOKEN` | Bulk photo upload (preview generation + face indexing). |

The search route is rate-limited to 10 requests per IP per minute and caps
selfies at 10MB, because it triggers face inference on the shared VM.

### Admin routes need `ADMIN_TOKEN`

There is no admin UI yet — the admin API is driven with `curl`:

```bash
# Create an event
curl -X POST http://localhost:3000/api/admin/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Casamento X","slug":"casamento-x","eventDate":"2026-09-12"}'

# Upload photos to it (returns {uploaded: [...], failed: [...]}, per-file isolation)
curl -X POST http://localhost:3000/api/admin/events/<event-uuid>/photos \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F 'photos=@/path/foto1.jpg' \
  -F 'photos=@/path/foto2.jpg'
```

Upload is synchronous and does real work per file (preview + watermark via
sharp, then face embedding). Upload in batches rather than firing hundreds of
files at once.

### Stripe webhook

Point a Stripe endpoint at `POST /api/webhooks/stripe` for
`checkout.session.completed` and put its signing secret in
`STRIPE_WEBHOOK_SECRET`. Locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The handler is idempotent (Stripe retries, and duplicate photo ids, are safe).

---

## 8. LGPD retention cron

`scripts/purge-expired-faces.ts` deletes face embeddings and consent records
older than `FACE_RETENTION_DAYS` (default 120). Selfies themselves are never
persisted anywhere; this purges the derived embeddings.

It is a `tsx` script, not part of the Next build. Install the runner once:

```bash
cd web && npm install --save-dev tsx
```

Run it manually to confirm it works (it prints
`Purged N faces, M consents`):

```bash
cd web && npx tsx scripts/purge-expired-faces.ts
```

Then schedule it daily — `crontab -e` on the VM:

```cron
0 3 * * * cd /path/to/orca-eventos-fotos/web && npx tsx scripts/purge-expired-faces.ts >> /var/log/orca-purge.log 2>&1
```

Cron does not load `.env.local`, so the job needs `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and `FACE_RETENTION_DAYS` in its own environment —
export them from a sourced env file in the cron command or set them in the
crontab. It uses the same service-role client, so §4 applies to it too.

---

## 9. Deploy checklist

- [ ] Migration applied; `orca_eventos.match_faces` exists.
- [ ] `orca_eventos` in `PGRST_DB_SCHEMAS`; grants applied; the `curl` in §4
      returns 200.
- [ ] Two R2 buckets; public domain on **previews only**; originals bucket has
      no public access.
- [ ] `NEXT_PUBLIC_R2_PUBLIC_URL` set, no trailing slash.
- [ ] face-service running, bound to a private interface, model warmed,
      `FACE_SERVICE_TOKEN` set.
- [ ] `FACE_SERVICE_TOKEN` identical in both processes.
- [ ] `ADMIN_TOKEN` set (admin routes 500 without it).
- [ ] Stripe webhook endpoint registered; `STRIPE_WEBHOOK_SECRET` set.
- [ ] `PHOTO_PRICE_CENTS` set to the real price.
- [ ] Purge cron installed with its own environment.
- [ ] `npm run build`, `npm run test`, `npx tsc --noEmit`, `npm run lint` all
      clean.

## 10. Known gaps

Tracked for a follow-up plan, not present in this build:

- No purchase button in the UI — `/api/checkout` exists but nothing calls it.
- No full-event gallery for faceless photos (`photos.has_face` is written but
  never read).
- No download-recovery path for a buyer who closes the tab
  (`purchases.buyer_email` is stored but there is no lookup route).
- No admin UI pages — the admin API is `curl`-only.
