-- Enhanced RAG: add full-text search vector + improved hybrid search

-- Add TSVECTOR column for full-text search (generated from content)
ALTER TABLE document_embeddings
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_search_vector
  ON document_embeddings USING GIN (search_vector);

-- Replace match_documents_hybrid with improved version using ts_rank
CREATE OR REPLACE FUNCTION match_documents_hybrid(
  query_embedding VECTOR(1536),
  query_text TEXT DEFAULT '',
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_org_id UUID DEFAULT NULL,
  filter_source_type TEXT DEFAULT NULL,
  filter_source_id UUID DEFAULT NULL,
  include_system BOOLEAN DEFAULT false
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
DECLARE
  ts_query TSQUERY;
BEGIN
  -- Build tsquery from the text query (if provided)
  IF query_text <> '' THEN
    ts_query := plainto_tsquery('english', query_text);
  ELSE
    ts_query := NULL;
  END IF;

  RETURN QUERY
  SELECT
    doc.id,
    doc.content,
    doc.metadata,
    doc.source_type,
    doc.source_id,
    doc.chunk_index,
    -- Blended score: 70% cosine similarity + 30% full-text rank
    CASE
      WHEN ts_query IS NOT NULL AND doc.search_vector @@ ts_query THEN
        (0.7 * (1 - (doc.embedding <=> query_embedding))
         + 0.3 * ts_rank(doc.search_vector, ts_query))::FLOAT
      ELSE
        (1 - (doc.embedding <=> query_embedding))::FLOAT
    END AS similarity
  FROM document_embeddings doc
  WHERE (1 - (doc.embedding <=> query_embedding)) > match_threshold
    AND (
      (filter_org_id IS NULL OR doc.org_id = filter_org_id)
      OR (include_system AND doc.org_id = '00000000-0000-0000-0000-000000000000'::uuid)
    )
    AND (filter_source_type IS NULL OR doc.source_type = filter_source_type)
    AND (filter_source_id IS NULL OR doc.source_id = filter_source_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
