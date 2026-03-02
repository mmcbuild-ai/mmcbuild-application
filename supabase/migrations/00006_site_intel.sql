-- 00006_site_intel.sql
-- Site intelligence: geocoded project data, wind/climate/council derivations

-- =============================================================================
-- Table: project_site_intel (1:1 with projects)
-- =============================================================================
create table if not exists public.project_site_intel (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,

  -- Geocoded location
  latitude           double precision,
  longitude          double precision,
  formatted_address  text,
  suburb             text,
  postcode           text,
  state              text,

  -- Derived intelligence
  climate_zone   smallint,          -- NatHERS 1-8
  wind_region    text,              -- A, B, C, D
  bal_rating     text,              -- BAL-LOW, BAL-12.5, BAL-19, BAL-29, BAL-40, BAL-FZ
  council_name   text,              -- LGA name
  council_code   text,              -- LGA code
  zoning         text,              -- R1, R2, etc.
  overlays       jsonb default '{}',-- flood, heritage, bushfire

  -- Presentation
  static_map_url text,              -- Mapbox Static API image URL

  -- Metadata
  derived_at     timestamptz default now(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),

  -- 1:1 constraint
  constraint project_site_intel_project_id_unique unique (project_id)
);

-- Index for fast org-scoped queries
create index if not exists idx_project_site_intel_org_id on public.project_site_intel(org_id);

-- Updated-at trigger
create trigger project_site_intel_updated_at
  before update on public.project_site_intel
  for each row execute function public.update_updated_at();

-- =============================================================================
-- RLS: org-scoped access via get_user_org_id()
-- =============================================================================
alter table public.project_site_intel enable row level security;

create policy "Users can view own org site intel"
  on public.project_site_intel for select
  using (org_id = public.get_user_org_id());

create policy "Users can insert own org site intel"
  on public.project_site_intel for insert
  with check (org_id = public.get_user_org_id());

create policy "Users can update own org site intel"
  on public.project_site_intel for update
  using (org_id = public.get_user_org_id());

create policy "Users can delete own org site intel"
  on public.project_site_intel for delete
  using (org_id = public.get_user_org_id());

-- =============================================================================
-- Storage bucket: site-data (GeoJSON files for wind/climate/council lookups)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-data',
  'site-data',
  false,
  200 * 1024 * 1024,  -- 200MB (largest file is ~94MB)
  array['application/json', 'application/geo+json']
)
on conflict (id) do nothing;
