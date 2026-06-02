-- Migration 00048: Extend engineering-certs bucket MIME allowlist for DWG, Word, Excel
--
-- Karen reported on 2026-05-27 that DWG upload failed. Also need to support
-- geotechnical reports which may be in DOC/DOCX/XLS/XLSX formats.
-- This extends the bucket's allowed_mime_types to include these formats.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT m FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY[
      'application/acad',
      'image/vnd.dwg',
      'image/x-dwg',
      'application/dwg',
      'application/x-dwg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-office'
    ]
  ) m
)
WHERE id = 'engineering-certs';
