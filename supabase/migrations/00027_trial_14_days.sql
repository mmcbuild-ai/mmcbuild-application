-- Change trial duration from 60 days to 14 days for new organisations
-- Existing organisations keep their current trial_ends_at

ALTER TABLE organisations
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + INTERVAL '14 days');
