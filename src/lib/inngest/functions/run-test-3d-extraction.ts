import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/supabase/db";
import { runTest3DExtraction } from "@/lib/build/test-3d-runner";

/**
 * Async runner for /build/test-3d uploads. The Server Action enqueues a row
 * in test_3d_jobs (status='queued') and fires this event. We download the
 * uploaded plan from Supabase Storage, run the same extractor the legacy
 * synchronous action used, and write the result back to the job row. The
 * harness UI polls getTest3DStatus until status='done' or 'error'.
 *
 * Bypasses the Vercel edge 60s window by being async — the function can
 * take up to the Inngest step budget (default ~15 min).
 */
export const runTest3DExtractionFn = inngest.createFunction(
  {
    id: "run-test-3d-extraction",
    name: "Run Test-3D Extraction",
    retries: 0,
  },
  { event: "test3d/extract.requested" },
  async ({ event, step }) => {
    const { jobId, storagePath, fileName, pageInput } = event.data;
    const admin = createAdminClient();

    await step.run("mark-processing", async () => {
      await db()
        .from("test_3d_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    });

    const sourceBuffer = await step.run("download-source", async () => {
      const { data, error } = await admin.storage
        .from("plan-uploads")
        .download(storagePath);
      if (error || !data) {
        throw new Error(
          `Storage download failed: ${error?.message ?? "unknown"}`,
        );
      }
      const arr = await data.arrayBuffer();
      // step.run results must be JSON-serialisable; encode as base64 so we
      // can rehydrate the Buffer in the next step.
      return Buffer.from(arr).toString("base64");
    });

    // The extraction itself isn't wrapped in step.run — it's a single long
    // operation (10s to several minutes) that doesn't benefit from Inngest
    // checkpointing the same way the I/O steps do. If it throws, the catch
    // below writes the error to the job row and returns; we don't want
    // Inngest to retry the whole extraction on transient AI errors (cost).
    let result;
    try {
      const buf = Buffer.from(sourceBuffer, "base64");
      result = await runTest3DExtraction(buf, fileName, pageInput);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[run-test-3d-extraction] runner threw:", message);
      await db()
        .from("test_3d_jobs")
        .update({
          status: "error",
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return { jobId, status: "error", error: message };
    }

    await step.run("write-result", async () => {
      await db()
        .from("test_3d_jobs")
        .update({
          status: "done",
          result,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    });

    return { jobId, status: "done" };
  },
);
