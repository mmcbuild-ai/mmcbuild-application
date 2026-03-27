-- Org-scoped rate overrides
-- Allows each organisation to override/supplement global reference rates
-- Priority: org_override > external_source > seed_data

CREATE TABLE org_rate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  element TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_rate NUMERIC NOT NULL,
  state TEXT NOT NULL DEFAULT 'NSW',
  year INTEGER NOT NULL DEFAULT 2025,
  notes TEXT,
  source_label TEXT NOT NULL DEFAULT 'Client Override',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_rate_overrides_org ON org_rate_overrides(org_id);
CREATE INDEX idx_org_rate_overrides_category ON org_rate_overrides(category, state);
CREATE UNIQUE INDEX idx_org_rate_overrides_unique ON org_rate_overrides(org_id, category, element, state);

ALTER TABLE org_rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org rate overrides"
  ON org_rate_overrides FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can insert own org rate overrides"
  ON org_rate_overrides FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users can update own org rate overrides"
  ON org_rate_overrides FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can delete own org rate overrides"
  ON org_rate_overrides FOR DELETE
  USING (org_id = get_user_org_id());
