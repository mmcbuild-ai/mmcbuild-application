-- Persona and tier access matrix
-- Sprint v0.3.0: Karen Burns sidebar + User Personas and Scenarios.xlsx

-- Persona role enum
DO $$ BEGIN
  CREATE TYPE user_persona AS ENUM (
    'builder', 'developer', 'architect_bd', 'design_and_build',
    'consultant', 'trade', 'admin'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add persona to profiles (tier already lives on organisations.subscription_tier)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS persona user_persona;

-- Usage limits table (per-user monthly run tracking for Trial tier)
CREATE TABLE IF NOT EXISTS usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  run_count integer DEFAULT 0,
  run_limit integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month_year)
);

ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON usage_limits;
CREATE POLICY "Users can view own usage"
  ON usage_limits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON usage_limits;
CREATE POLICY "Users can update own usage"
  ON usage_limits FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own usage" ON usage_limits;
CREATE POLICY "Users can insert own usage"
  ON usage_limits FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS usage_limits_updated_at ON usage_limits;
CREATE TRIGGER usage_limits_updated_at
  BEFORE UPDATE ON usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
