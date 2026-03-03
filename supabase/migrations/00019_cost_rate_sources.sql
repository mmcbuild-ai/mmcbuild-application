-- Cost Rate Sources & Provenance (Stage 4 enhancement)
-- Adds source tracking for cost reference rates and provenance for line items.

-- cost_rate_sources — registry of data sources for cost rates
CREATE TABLE cost_rate_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('api', 'csv', 'manual')),
  config JSONB NOT NULL DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS — shared platform resource

-- Seed default source for existing rates
INSERT INTO cost_rate_sources (id, name, source_type, config, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'MMC Build Seed Data (NSW 2025)', 'manual', '{}', true);

-- Add provenance columns to cost_reference_rates
ALTER TABLE cost_reference_rates
  ADD COLUMN source_id UUID REFERENCES cost_rate_sources(id),
  ADD COLUMN source_detail TEXT,
  ADD COLUMN effective_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN expires_at DATE;

-- Backfill existing rates with the seed source
UPDATE cost_reference_rates
SET source_id = '00000000-0000-0000-0000-000000000001'
WHERE source_id IS NULL;

CREATE INDEX idx_cost_reference_rates_source ON cost_reference_rates(source_id);
CREATE INDEX idx_cost_reference_rates_effective ON cost_reference_rates(effective_date);

-- Add provenance columns to cost_line_items
ALTER TABLE cost_line_items
  ADD COLUMN rate_source_name TEXT,
  ADD COLUMN rate_source_detail TEXT;
