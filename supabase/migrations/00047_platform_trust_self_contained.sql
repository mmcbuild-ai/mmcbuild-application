-- 00047_platform_trust_self_contained.sql
--
-- Platform Trust (security gate) self-contained backend for MMC Build.
--
-- Creates the trust-events schema the vendored platform-trust middleware reads
-- and writes (src/lib/services/platform-trust-middleware/*), so the security
-- gate — prompt-injection guard + audit log + rate limit + metering — runs on
-- MMC Build's OWN Supabase project instead of the shared CAS trust-events
-- project. After applying, repoint:
--   PLATFORM_TRUST_SUPABASE_URL = this project's URL (same as NEXT_PUBLIC_SUPABASE_URL)
--   PLATFORM_TRUST_SERVICE_KEY  = this project's service_role key (same as SUPABASE_SERVICE_ROLE_KEY)
--   PLATFORM_TRUST_PROJECT_ID   = mmc-build   (namespacing label on every row)
--
-- TABLE NAMING — `trust_` prefix (IMPORTANT):
-- The app database already owns a `public.audit_log` table (its own application
-- audit trail: org_id / user_id / action / entity_type / ...). The portfolio
-- platform-trust middleware normally writes to a bare `audit_log` in a DEDICATED
-- trust-events project where there is no such collision. Because MMC Build
-- co-locates the trust tables in the app database, the four trust tables are
-- prefixed `trust_` to avoid clobbering the app's audit_log. The vendored
-- middleware's `.from()` calls were updated to match (this is an mmcbuild-local
-- divergence from the canonical @caistech package, deliberate + documented).
--
-- All objects are IF NOT EXISTS / OR REPLACE — safe to re-run (idempotent).
-- These tables are accessed ONLY via the service_role client (getTrustClient),
-- so RLS is ENABLED with no anon/authenticated policies; service_role bypasses
-- RLS, while direct client access is denied by default.

-- ── trust_audit_log — logAuditEvent / trustLog (insert) ─────────────
create table if not exists public.trust_audit_log (
  id                      uuid primary key default gen_random_uuid(),
  project_id              text        not null,
  session_id              text,
  agent_id                text        not null,
  tool_name               text        not null,
  operation_type          text        not null check (operation_type in ('read','write','delete')),
  input_hash              text,
  output_hash             text,
  status                  text        not null check (status in ('completed','failed','pending_approval','permission_denied','rate_limited')),
  duration_ms             integer,
  requires_human_approval boolean     not null default false,
  approved_by             text,
  approved_at             timestamptz,
  created_at              timestamptz not null default now()
);
create index if not exists trust_audit_log_project_created_idx on public.trust_audit_log (project_id, created_at desc);
create index if not exists trust_audit_log_agent_idx           on public.trust_audit_log (project_id, agent_id);

-- ── trust_metering_events — meterCall / trustMeter (insert) ─────────
create table if not exists public.trust_metering_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    text         not null,
  session_id    text,
  agent_id      text         not null,
  model         text         not null,
  input_tokens  integer      not null default 0,
  output_tokens integer      not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  created_at    timestamptz  not null default now()
);
create index if not exists trust_metering_events_project_created_idx on public.trust_metering_events (project_id, created_at desc);

-- ── trust_rate_limits — checkRateLimit (select/update + increment RPC)
-- agent_id is a specific id OR the '*' wildcard. One row per
-- (project_id, agent_id, window_type) window.
create table if not exists public.trust_rate_limits (
  id            uuid primary key default gen_random_uuid(),
  project_id    text         not null,
  agent_id      text         not null,
  window_type   text         not null check (window_type in ('minute','hour','day')),
  window_start  timestamptz  not null default now(),
  current_count integer      not null default 0,
  max_requests  integer      not null default 0,
  max_tokens    integer,
  max_spend_usd numeric(12,6),
  updated_at    timestamptz  not null default now(),
  unique (project_id, agent_id, window_type)
);
create index if not exists trust_rate_limits_lookup_idx on public.trust_rate_limits (project_id, agent_id);

-- ── trust_permission_policies — checkPermission (select) ────────────
-- The shim mmcbuild uses is allow-by-default (a missing row = allowed), so this
-- table can stay empty unless explicit per-agent policies are wanted later.
create table if not exists public.trust_permission_policies (
  id                uuid primary key default gen_random_uuid(),
  project_id        text        not null,
  agent_id          text        not null,
  scope             text        not null,
  operation         text        not null check (operation in ('read','write','delete')),
  requires_approval boolean     not null default false,
  approval_roles    jsonb       not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  unique (project_id, agent_id, scope, operation)
);

-- ── RPC get_window_usage — checkRateLimit token/spend caps ──────────
-- Sums cost + tokens from trust_metering_events since a window start. Returns
-- one row (total_cost_usd, total_tokens). Called only when a trust_rate_limits
-- row sets max_tokens or max_spend_usd.
create or replace function public.get_window_usage(
  p_project_id   text,
  p_window_start timestamptz
)
returns table (total_cost_usd numeric, total_tokens bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(cost_usd), 0)::numeric                    as total_cost_usd,
    coalesce(sum(input_tokens + output_tokens), 0)::bigint as total_tokens
  from public.trust_metering_events
  where project_id = p_project_id
    and created_at >= p_window_start;
$$;

-- ── RPC increment_rate_limit — checkRateLimit atomic bump ───────────
create or replace function public.increment_rate_limit(limit_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.trust_rate_limits
     set current_count = current_count + 1,
         updated_at    = now()
   where id = limit_id;
$$;

-- ── RLS — service_role-only (service_role bypasses RLS) ─────────────
alter table public.trust_audit_log          enable row level security;
alter table public.trust_metering_events    enable row level security;
alter table public.trust_rate_limits        enable row level security;
alter table public.trust_permission_policies enable row level security;
