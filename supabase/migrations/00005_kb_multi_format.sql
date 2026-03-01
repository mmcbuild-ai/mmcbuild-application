-- ============================================================
-- Migration 00005: Expand KB uploads to support multiple formats
-- ============================================================

-- Update the kb-uploads bucket to accept all supported file types
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/acad',
    'application/x-step',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
    'text/plain'
  ],
  file_size_limit = 104857600  -- 100 MB
WHERE id = 'kb-uploads';
