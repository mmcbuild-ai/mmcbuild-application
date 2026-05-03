-- Per-suggestion designer decisions on the MMC Build optimisation report.
-- Lets architects/designers mark each suggestion as Pursuing / Considering /
-- Rejected with an optional note, so the report becomes an actionable
-- decision record rather than read-only advisory output.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'suggestion_decision') THEN
    CREATE TYPE suggestion_decision AS ENUM (
      'undecided',
      'pursuing',
      'considering',
      'rejected'
    );
  END IF;
END $$;

ALTER TABLE design_suggestions
  ADD COLUMN IF NOT EXISTS decision suggestion_decision NOT NULL DEFAULT 'undecided',
  ADD COLUMN IF NOT EXISTS decision_note TEXT,
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_design_suggestions_decision
  ON design_suggestions(check_id, decision);

COMMENT ON COLUMN design_suggestions.decision IS
  'Designer''s decision on this suggestion. Drives shortlist, aggregate impact, and downstream Quote/Comply filtering.';
COMMENT ON COLUMN design_suggestions.decision_note IS
  'Optional designer note explaining the decision (e.g. "client likes carbon story", "site cannot take crane").';

-- Allow UPDATE on design_suggestions for the suggestion's org (decisions are
-- a write surface; existing INSERT/SELECT policies already cover org scoping).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'design_suggestions'
      AND policyname = 'Users can update own org design suggestions'
  ) THEN
    CREATE POLICY "Users can update own org design suggestions"
      ON design_suggestions FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM design_checks dc
          WHERE dc.id = design_suggestions.check_id
            AND dc.org_id = get_user_org_id()
        )
      );
  END IF;
END $$;
