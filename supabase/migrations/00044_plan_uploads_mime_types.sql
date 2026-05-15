-- Migration: extend plan-uploads bucket MIME allowlist for CAD / Revit / SketchUp / Word
--
-- The bucket previously allowed PDF and common image types. Karen reported on
-- 2026-05-14 that DWG upload failed; we reproduced today with
-- "mime type application/octet-stream is not supported" (browser default) and
-- then "mime type application/acad is not supported" after the client started
-- sending the correct MIME via a Blob wrapper.
--
-- This migration adds the MIME types our file-kind detector (contentTypeForKind
-- in src/lib/plans/file-kind.ts) returns for each supported plan file type, so
-- the bucket policy stops blocking valid uploads. Uses array_cat with DISTINCT
-- to merge with the existing allow list rather than overwriting it.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT m FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY[
      'application/acad',                                                            -- DWG
      'application/vnd.sketchup.skp',                                                -- SKP
      'application/octet-stream',                                                    -- RVT (no standard MIME)
      'application/msword',                                                          -- DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'      -- DOCX
    ]
  ) m
)
WHERE id = 'plan-uploads';
