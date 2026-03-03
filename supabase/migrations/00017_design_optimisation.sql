-- Design Optimisation tables for MMC Build (Stage 3)

-- Enums
CREATE TYPE design_check_status AS ENUM ('queued', 'processing', 'completed', 'error');
CREATE TYPE implementation_complexity AS ENUM ('low', 'medium', 'high');

-- design_checks — mirrors compliance_checks
CREATE TABLE design_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  status design_check_status NOT NULL DEFAULT 'queued',
  summary TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_design_checks_project ON design_checks(project_id);
CREATE INDEX idx_design_checks_org ON design_checks(org_id);
CREATE INDEX idx_design_checks_status ON design_checks(status);

-- RLS
ALTER TABLE design_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org design checks"
  ON design_checks FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can insert own org design checks"
  ON design_checks FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users can update own org design checks"
  ON design_checks FOR UPDATE
  USING (org_id = get_user_org_id());

-- design_suggestions — mirrors compliance_findings
CREATE TABLE design_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES design_checks(id) ON DELETE CASCADE,
  technology_category TEXT NOT NULL,
  current_approach TEXT NOT NULL,
  suggested_alternative TEXT NOT NULL,
  benefits TEXT NOT NULL,
  estimated_time_savings NUMERIC,
  estimated_cost_savings NUMERIC,
  estimated_waste_reduction NUMERIC,
  implementation_complexity implementation_complexity NOT NULL DEFAULT 'medium',
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_design_suggestions_check ON design_suggestions(check_id);

-- RLS via join to design_checks
ALTER TABLE design_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org design suggestions"
  ON design_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM design_checks dc
      WHERE dc.id = design_suggestions.check_id
        AND dc.org_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can insert own org design suggestions"
  ON design_suggestions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM design_checks dc
      WHERE dc.id = design_suggestions.check_id
        AND dc.org_id = get_user_org_id()
    )
  );
