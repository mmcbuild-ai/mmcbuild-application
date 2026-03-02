-- Migration: Compliance Workflow — From Scorecard to Work Orders
-- Adds contributor management, finding review workflow, and activity logging.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE contributor_discipline AS ENUM (
  'architect',
  'structural_engineer',
  'hydraulic_engineer',
  'energy_consultant',
  'building_surveyor',
  'geotechnical_engineer',
  'acoustic_engineer',
  'fire_engineer',
  'landscape_architect',
  'builder',
  'other'
);

CREATE TYPE finding_review_status AS ENUM (
  'pending',
  'accepted',
  'amended',
  'rejected',
  'sent'
);

-- ============================================================
-- TABLE: project_contributors
-- External contacts (not platform users) assigned to a project.
-- ============================================================

CREATE TABLE project_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  discipline contributor_discipline NOT NULL DEFAULT 'other',
  company_name TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_contributors_project ON project_contributors(project_id);
CREATE INDEX idx_project_contributors_org ON project_contributors(org_id);

ALTER TABLE project_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contributors visible to org members"
  ON project_contributors FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Contributors manageable by org members"
  ON project_contributors FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Contributors updatable by org members"
  ON project_contributors FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "Contributors deletable by org members"
  ON project_contributors FOR DELETE
  USING (org_id = get_user_org_id());

-- ============================================================
-- ALTER: compliance_findings — add workflow columns
-- All nullable for backwards compatibility with existing findings.
-- ============================================================

ALTER TABLE compliance_findings
  ADD COLUMN responsible_discipline contributor_discipline,
  ADD COLUMN assigned_contributor_id UUID REFERENCES project_contributors(id) ON DELETE SET NULL,
  ADD COLUMN remediation_action TEXT,
  ADD COLUMN review_status finding_review_status,
  ADD COLUMN reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN amended_description TEXT,
  ADD COLUMN amended_action TEXT,
  ADD COLUMN amended_discipline contributor_discipline,
  ADD COLUMN sent_at TIMESTAMPTZ;

CREATE INDEX idx_compliance_findings_review_status ON compliance_findings(review_status)
  WHERE review_status IS NOT NULL;
CREATE INDEX idx_compliance_findings_discipline ON compliance_findings(responsible_discipline)
  WHERE responsible_discipline IS NOT NULL;

-- ============================================================
-- TABLE: finding_activity_log — lightweight audit trail
-- ============================================================

CREATE TABLE finding_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES compliance_findings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finding_activity_log_finding ON finding_activity_log(finding_id);

ALTER TABLE finding_activity_log ENABLE ROW LEVEL SECURITY;

-- Activity log inherits visibility from the finding's check → org scope.
-- Using a subquery to check org ownership through the chain.
CREATE POLICY "Activity log visible to org members"
  ON finding_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM compliance_findings cf
      JOIN compliance_checks cc ON cc.id = cf.check_id
      WHERE cf.id = finding_activity_log.finding_id
        AND cc.org_id = get_user_org_id()
    )
  );

CREATE POLICY "Activity log insertable by org members"
  ON finding_activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compliance_findings cf
      JOIN compliance_checks cc ON cc.id = cf.check_id
      WHERE cf.id = finding_activity_log.finding_id
        AND cc.org_id = get_user_org_id()
    )
  );
