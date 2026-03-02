-- Finding-level feedback for continuous improvement
CREATE TABLE IF NOT EXISTS finding_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES compliance_findings(id) ON DELETE CASCADE,
  check_id UUID NOT NULL REFERENCES compliance_checks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= -1 AND rating <= 1),
  correction_severity TEXT CHECK (correction_severity IN ('compliant', 'advisory', 'non_compliant', 'critical')),
  correction_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_finding_feedback_finding ON finding_feedback(finding_id);
CREATE INDEX idx_finding_feedback_org ON finding_feedback(org_id, created_at DESC);
CREATE INDEX idx_finding_feedback_check ON finding_feedback(check_id);

-- RLS
ALTER TABLE finding_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org feedback"
  ON finding_feedback FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can insert own org feedback"
  ON finding_feedback FOR INSERT
  WITH CHECK (org_id = get_user_org_id() AND user_id = auth.uid());

-- Materialized view for model performance dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS model_performance AS
SELECT
  model_id,
  ai_function,
  COUNT(*) AS total_calls,
  ROUND(AVG(latency_ms)) AS avg_latency_ms,
  ROUND(AVG(estimated_cost_usd)::numeric, 6) AS avg_cost_usd,
  COUNT(*) FILTER (WHERE was_fallback) AS fallback_count,
  MAX(created_at) AS last_used_at
FROM ai_usage_log
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY model_id, ai_function;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_performance_pk
  ON model_performance(model_id, ai_function);

-- Refresh function (call from cron or after checks)
CREATE OR REPLACE FUNCTION refresh_model_performance()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY model_performance;
END;
$$;
