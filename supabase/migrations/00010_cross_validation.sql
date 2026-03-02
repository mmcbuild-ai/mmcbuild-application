-- Cross-validation columns on compliance_findings
ALTER TABLE compliance_findings
  ADD COLUMN IF NOT EXISTS validation_tier SMALLINT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS agreement_score FLOAT,
  ADD COLUMN IF NOT EXISTS secondary_model TEXT,
  ADD COLUMN IF NOT EXISTS was_reconciled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_chunk_ids UUID[] DEFAULT '{}';
