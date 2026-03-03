-- Add progress tracking columns to compliance_checks
ALTER TABLE compliance_checks
  ADD COLUMN IF NOT EXISTS progress_current TEXT,
  ADD COLUMN IF NOT EXISTS progress_completed TEXT[] DEFAULT '{}';
