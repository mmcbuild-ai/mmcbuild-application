-- Add spatial_layout column to design_checks for 3D plan viewer
-- Stores the AI-extracted spatial JSON (walls, rooms, openings, bounds)
ALTER TABLE design_checks
  ADD COLUMN spatial_layout JSONB;

-- Optional: index for non-null checks (find reports with 3D data)
CREATE INDEX idx_design_checks_has_spatial
  ON design_checks (id) WHERE spatial_layout IS NOT NULL;
