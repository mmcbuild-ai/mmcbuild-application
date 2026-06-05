-- SCRUM-239: Add deregistered status to professionals
-- Allows business owners to soft-delete their MMC Direct listing

-- Add deregistered to professional_status enum
ALTER TYPE professional_status ADD VALUE IF NOT EXISTS 'deregistered';

-- Add deregistered_at timestamp for tracking when deregistration occurred
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS deregistered_at TIMESTAMPTZ;

-- Index for querying deregistered listings (admin/migration purposes)
CREATE INDEX IF NOT EXISTS idx_professionals_deregistered_at ON professionals(deregistered_at) WHERE status = 'deregistered';
