-- Migration 00048: Extend engineering-certs bucket MIME allowlist for DWG, Word, Excel
--
-- Karen reported on 2026-05-27 that DWG upload failed. Also need to support
-- geotechnical reports which may be in DOC/DOCX/XLS/XLSX formats.
-- This extends the bucket's allowed_mime_types to include these formats.
--
-- NOTE: the engineering-certs bucket was created manually with
-- allowed_mime_types = NULL (unrestricted) on at least the live project — the
-- intended base list (PDF + images) from migration 00007 was only a commented
-- block and never executed. A bare union over a NULL list would therefore have
-- collapsed the allowlist to ONLY the DWG/Office types and started rejecting
-- PDF/image cert uploads. We seed the original intended base types into the
-- union so the result is a superset (base + DWG/Office) regardless of whether
-- the bucket started NULL or already had the base list. Applied to the live
-- project (lztzyfeivpsbqbsfzctw) via the Storage API on 2026-06-07.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT m FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY[
      -- base types originally intended for this bucket (migration 00007)
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      -- DWG / CAD
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
