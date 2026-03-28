-- Add property intelligence columns to projects table
-- Source: property-services /derive endpoint (shared across F2K, MMC Build, DealFindrs)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_profile JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_lookup_id UUID;

-- Denormalised columns for direct queries and display
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS suburb TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS council TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lot_size_sqm NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS zoning TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS wind_region TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS climate_zone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bal TEXT;

COMMENT ON COLUMN projects.property_profile IS 'Full PropertyProfile from property-services /derive';
COMMENT ON COLUMN projects.property_lookup_id IS 'Cache ID from property-services for /assess calls';
