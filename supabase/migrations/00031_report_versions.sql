-- Immutable report version history
-- Each completed analysis run creates a version record with a snapshot of the report data.
-- Versions are never overwritten — full audit trail per module per project.

CREATE TABLE report_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('comply', 'build', 'quote')),
  version_number INTEGER NOT NULL,
  source_id UUID NOT NULL,  -- compliance_checks.id, design_checks.id, or cost_estimates.id
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE (project_id, module, version_number)
);

-- RLS
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_report_versions"
  ON report_versions FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "org_members_can_insert_report_versions"
  ON report_versions FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

-- Index for fast lookup by project + module
CREATE INDEX idx_report_versions_project_module
  ON report_versions (project_id, module, version_number DESC);

COMMENT ON TABLE report_versions IS 'Immutable report version history — one record per completed analysis run';
COMMENT ON COLUMN report_versions.source_id IS 'FK to the source check/estimate record (compliance_checks, design_checks, or cost_estimates)';
COMMENT ON COLUMN report_versions.report_data IS 'Full snapshot of findings/suggestions/line_items at time of completion';
