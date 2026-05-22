-- Async job table for the /build/test-3d harness. The synchronous Server
-- Action runs the extraction inline, which works for PDFs (one Sonnet
-- call) but blows past the Vercel edge ~60s connection-close window for
-- DWG/RVT/SKP files that need CloudConvert + sheet decomposer + multiple
-- AI calls. This table lets the harness behave like the production /build
-- pipeline: enqueue → Inngest does the work async → poll status → render.

CREATE TABLE IF NOT EXISTS public.test_3d_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  page_input    text,
  status        text NOT NULL DEFAULT 'queued',
    -- queued | processing | done | error
  result        jsonb,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS test_3d_jobs_user_idx
  ON public.test_3d_jobs (user_id, created_at DESC);

ALTER TABLE public.test_3d_jobs ENABLE ROW LEVEL SECURITY;

-- A user can read + insert their own jobs. The Inngest worker uses the
-- service role and bypasses RLS entirely when it writes results.
DROP POLICY IF EXISTS "users read own test_3d jobs" ON public.test_3d_jobs;
CREATE POLICY "users read own test_3d jobs" ON public.test_3d_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own test_3d jobs" ON public.test_3d_jobs;
CREATE POLICY "users insert own test_3d jobs" ON public.test_3d_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
