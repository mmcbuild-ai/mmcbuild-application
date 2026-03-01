-- ============================================================
-- MMC Build — Stage 1: MMC Comply Database Migration
-- ============================================================
-- Run after 00001_foundation.sql / setup_complete.sql
-- Adds tables for plan uploads, questionnaires, compliance
-- checks, findings, and document embeddings (RAG).
-- ============================================================


-- ============================================================
-- PART 1: New Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM (
    'uploading', 'processing', 'ready', 'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE check_status AS ENUM (
    'queued', 'processing', 'completed', 'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM (
    'low', 'medium', 'high', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE finding_severity AS ENUM (
    'compliant', 'advisory', 'non_compliant', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PART 2: Plans Table
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  page_count      INT,
  status          plan_status NOT NULL DEFAULT 'uploading',
  created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_project_id ON plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_org_id ON plans(org_id);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PART 3: Questionnaire Responses Table
-- ============================================================

CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  responses   JSONB NOT NULL DEFAULT '{}',
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_project_id ON questionnaire_responses(project_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_org_id ON questionnaire_responses(org_id);
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS questionnaire_responses_updated_at ON questionnaire_responses;
CREATE TRIGGER questionnaire_responses_updated_at
  BEFORE UPDATE ON questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PART 4: Compliance Checks Table
-- ============================================================

CREATE TABLE IF NOT EXISTS compliance_checks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  questionnaire_id  UUID REFERENCES questionnaire_responses(id) ON DELETE SET NULL,
  status            check_status NOT NULL DEFAULT 'queued',
  summary           TEXT,
  overall_risk      risk_level,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_by        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_project_id ON compliance_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_org_id ON compliance_checks(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_plan_id ON compliance_checks(plan_id);
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS compliance_checks_updated_at ON compliance_checks;
CREATE TRIGGER compliance_checks_updated_at
  BEFORE UPDATE ON compliance_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PART 5: Compliance Findings Table
-- ============================================================

CREATE TABLE IF NOT EXISTS compliance_findings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_id        UUID NOT NULL REFERENCES compliance_checks(id) ON DELETE CASCADE,
  ncc_section     TEXT NOT NULL,
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  recommendation  TEXT,
  severity        finding_severity NOT NULL DEFAULT 'advisory',
  confidence      FLOAT NOT NULL DEFAULT 0.0,
  ncc_citation    TEXT,
  page_references INT[] DEFAULT '{}',
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_check_id ON compliance_findings(check_id);
ALTER TABLE compliance_findings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART 6: Document Embeddings Table (for RAG)
-- ============================================================

CREATE TABLE IF NOT EXISTS document_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id   UUID NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id ON document_embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_source ON document_embeddings(source_type, source_id);

-- HNSW index for fast approximate nearest neighbour search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS document_embeddings_updated_at ON document_embeddings;
CREATE TRIGGER document_embeddings_updated_at
  BEFORE UPDATE ON document_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PART 7: RLS Policies — Plans
-- ============================================================

DROP POLICY IF EXISTS "Users can view plans in their org" ON plans;
CREATE POLICY "Users can view plans in their org"
  ON plans FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert plans in their org" ON plans;
CREATE POLICY "Users can insert plans in their org"
  ON plans FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND org_id = plans.org_id
        AND role IN ('owner', 'admin', 'architect', 'builder')
    )
  );

DROP POLICY IF EXISTS "Plan creators and admins can update plans" ON plans;
CREATE POLICY "Plan creators and admins can update plans"
  ON plans FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid() AND org_id = plans.org_id AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete plans" ON plans;
CREATE POLICY "Admins can delete plans"
  ON plans FOR DELETE
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND org_id = plans.org_id AND role IN ('owner', 'admin')
    )
  );


-- ============================================================
-- PART 8: RLS Policies — Questionnaire Responses
-- ============================================================

DROP POLICY IF EXISTS "Users can view questionnaires in their org" ON questionnaire_responses;
CREATE POLICY "Users can view questionnaires in their org"
  ON questionnaire_responses FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert questionnaires in their org" ON questionnaire_responses;
CREATE POLICY "Users can insert questionnaires in their org"
  ON questionnaire_responses FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND org_id = questionnaire_responses.org_id
        AND role IN ('owner', 'admin', 'architect', 'builder')
    )
  );

DROP POLICY IF EXISTS "Users can update questionnaires in their org" ON questionnaire_responses;
CREATE POLICY "Users can update questionnaires in their org"
  ON questionnaire_responses FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid() AND org_id = questionnaire_responses.org_id AND role IN ('owner', 'admin')
      )
    )
  );


-- ============================================================
-- PART 9: RLS Policies — Compliance Checks
-- ============================================================

DROP POLICY IF EXISTS "Users can view compliance checks in their org" ON compliance_checks;
CREATE POLICY "Users can view compliance checks in their org"
  ON compliance_checks FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert compliance checks in their org" ON compliance_checks;
CREATE POLICY "Users can insert compliance checks in their org"
  ON compliance_checks FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND org_id = compliance_checks.org_id
        AND role IN ('owner', 'admin', 'architect', 'builder')
    )
  );

DROP POLICY IF EXISTS "System can update compliance checks" ON compliance_checks;
CREATE POLICY "System can update compliance checks"
  ON compliance_checks FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());


-- ============================================================
-- PART 10: RLS Policies — Compliance Findings
-- ============================================================

DROP POLICY IF EXISTS "Users can view findings via check org" ON compliance_findings;
CREATE POLICY "Users can view findings via check org"
  ON compliance_findings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM compliance_checks
      WHERE compliance_checks.id = compliance_findings.check_id
        AND compliance_checks.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "System can insert findings" ON compliance_findings;
CREATE POLICY "System can insert findings"
  ON compliance_findings FOR INSERT
  WITH CHECK (true);


-- ============================================================
-- PART 11: RLS Policies — Document Embeddings
-- ============================================================

DROP POLICY IF EXISTS "Users can view embeddings in their org" ON document_embeddings;
CREATE POLICY "Users can view embeddings in their org"
  ON document_embeddings FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can insert embeddings" ON document_embeddings;
CREATE POLICY "System can insert embeddings"
  ON document_embeddings FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can delete embeddings" ON document_embeddings;
CREATE POLICY "System can delete embeddings"
  ON document_embeddings FOR DELETE
  USING (true);


-- ============================================================
-- PART 12: Hybrid Search RPC
-- ============================================================

CREATE OR REPLACE FUNCTION match_documents_hybrid(
  query_embedding VECTOR(1536),
  query_text TEXT DEFAULT '',
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_org_id UUID DEFAULT NULL,
  filter_source_type TEXT DEFAULT NULL,
  filter_source_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  source_type TEXT,
  source_id UUID,
  chunk_index INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc.id,
    doc.content,
    doc.metadata,
    doc.source_type,
    doc.source_id,
    doc.chunk_index,
    1 - (doc.embedding <=> query_embedding) AS similarity
  FROM document_embeddings doc
  WHERE 1 - (doc.embedding <=> query_embedding) > match_threshold
    AND (filter_org_id IS NULL OR doc.org_id = filter_org_id)
    AND (filter_source_type IS NULL OR doc.source_type = filter_source_type)
    AND (filter_source_id IS NULL OR doc.source_id = filter_source_id)
    AND (
      query_text = ''
      OR doc.content ILIKE '%' || query_text || '%'
    )
  ORDER BY doc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================================
-- DONE — Stage 1 Migration Complete
-- ============================================================
SELECT 'STAGE 1 MIGRATION COMPLETE' AS status,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_tables,
  (SELECT count(*) FROM pg_policies) AS rls_policies;
