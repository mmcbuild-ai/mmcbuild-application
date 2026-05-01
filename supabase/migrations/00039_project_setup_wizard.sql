-- ============================================================
-- 00039: Project setup wizard + multi-format plan ingestion
-- ============================================================
-- Adds:
--   1. projects.setup_step (SMALLINT) — tracks furthest step the user
--      has reached in the project creation wizard. 0 = overview,
--      1 = documents, 2 = team, 3 = questionnaire, 4 = ready to activate.
--   2. plan_status enum value 'manual_review' — used when a plan is
--      uploaded in a format the AI ingestion pipeline cannot extract
--      (e.g. DWG). The file is stored but no embeddings are produced.
--   3. plans.file_kind (TEXT) — records the upload format so the
--      ingestion worker can branch on it without re-sniffing bytes.

-- 1. Add setup_step to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS setup_step SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN projects.setup_step IS
  'Furthest wizard step reached: 0=overview, 1=documents, 2=team, 3=questionnaire, 4=ready_to_activate';

-- 2. Extend plan_status enum
DO $$ BEGIN
  ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'manual_review';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3. Add file_kind to plans
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS file_kind TEXT NOT NULL DEFAULT 'pdf';

COMMENT ON COLUMN plans.file_kind IS
  'Upload format: pdf | image (jpg/png/webp) | dwg. Drives ingestion branch.';
