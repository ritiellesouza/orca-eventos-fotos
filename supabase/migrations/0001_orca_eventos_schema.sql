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
