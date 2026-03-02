-- AI Usage Log: tracks every AI call for cost monitoring and debugging
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  check_id UUID REFERENCES compliance_checks(id) ON DELETE SET NULL,
  ai_function TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  was_fallback BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by org and time
CREATE INDEX idx_ai_usage_log_org_created ON ai_usage_log(org_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_check ON ai_usage_log(check_id) WHERE check_id IS NOT NULL;

-- RLS: org-scoped SELECT only (inserts via service role)
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org AI usage"
  ON ai_usage_log FOR SELECT
  USING (org_id = get_user_org_id());
