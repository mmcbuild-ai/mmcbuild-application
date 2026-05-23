-- MMC Direct Phase 1: public instant-estimate marketplace data model (SCRUM-220).
-- Anonymous enquiries + indicative estimates sourced from MMC's own rate table
-- (cost_rate_sources). Anon rows (org_id NULL) are reachable ONLY via the service
-- role through token-validated server routes; org-scoped reads activate after a
-- visitor signs up and claims the estimate. Idempotent — safe to re-apply.

CREATE TABLE IF NOT EXISTS marketplace_enquiries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organisations(id) ON DELETE SET NULL,  -- NULL while anon
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,       -- set on claim
  source            TEXT NOT NULL CHECK (source IN ('voice','search')),
  raw_query         TEXT NOT NULL,
  discovered_intent JSONB,
  region            TEXT NOT NULL DEFAULT 'NSW',
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  ip_hash           TEXT,                                                  -- rate-limit / audit, never raw IP
  consent_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_estimates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id        UUID NOT NULL REFERENCES marketplace_enquiries(id) ON DELETE CASCADE,
  rate_source_type  TEXT NOT NULL DEFAULT 'mmc_base'
                      CHECK (rate_source_type IN ('mmc_base','org_override','supplier_card')),
  status            TEXT NOT NULL DEFAULT 'complete'
                      CHECK (status IN ('queued','processing','complete','failed')),
  low_cents         INTEGER,
  high_cents        INTEGER,
  currency          TEXT NOT NULL DEFAULT 'AUD',
  line_items        JSONB,
  disclaimer        TEXT NOT NULL DEFAULT 'Generic rates for guidance only',
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

-- Mirrors finding_share_tokens — opaque token + expiry for anonymous retrieval.
CREATE TABLE IF NOT EXISTS marketplace_estimate_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id       UUID NOT NULL REFERENCES marketplace_estimates(id) ON DELETE CASCADE,
  token             TEXT UNIQUE NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Captured at the signup gate; fulfilment deferred to the RFQ phase.
CREATE TABLE IF NOT EXISTS formal_quote_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id        UUID NOT NULL REFERENCES marketplace_enquiries(id) ON DELETE CASCADE,
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'requested',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_enquiries_org      ON marketplace_enquiries (org_id);
CREATE INDEX IF NOT EXISTS idx_mkt_estimates_enquiry  ON marketplace_estimates (enquiry_id);
CREATE INDEX IF NOT EXISTS idx_mkt_estimates_status   ON marketplace_estimates (status);
CREATE INDEX IF NOT EXISTS idx_mkt_tokens_token       ON marketplace_estimate_tokens (token);
CREATE INDEX IF NOT EXISTS idx_mkt_tokens_expires     ON marketplace_estimate_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_mkt_fqr_enquiry        ON formal_quote_requests (enquiry_id);

-- RLS: anon rows (org_id NULL) match no user-facing policy => service-role only.
-- All anon writes go through server routes using the admin client; estimate
-- retrieval is mediated by the token route (admin client + expiry check).
ALTER TABLE marketplace_enquiries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_estimates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_estimate_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_quote_requests        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_enquiries" ON marketplace_enquiries;
CREATE POLICY "org_members_read_enquiries"
  ON marketplace_enquiries FOR SELECT
  USING (org_id IS NOT NULL AND org_id = get_user_org_id());

DROP POLICY IF EXISTS "org_members_read_estimates" ON marketplace_estimates;
CREATE POLICY "org_members_read_estimates"
  ON marketplace_estimates FOR SELECT
  USING (enquiry_id IN (SELECT id FROM marketplace_enquiries WHERE org_id = get_user_org_id()));

DROP POLICY IF EXISTS "org_members_read_fqr" ON formal_quote_requests;
CREATE POLICY "org_members_read_fqr"
  ON formal_quote_requests FOR SELECT
  USING (enquiry_id IN (SELECT id FROM marketplace_enquiries WHERE org_id = get_user_org_id()));

-- marketplace_estimate_tokens: no user-facing policy by design.
-- Reads happen only through the token route via the service-role admin client.

COMMENT ON TABLE marketplace_enquiries IS 'MMC Direct Phase 1: public instant-estimate enquiries (anon until claimed) — SCRUM-220';
COMMENT ON TABLE marketplace_estimates IS 'MMC Direct Phase 1: indicative estimates, guidance only — not quotes';
