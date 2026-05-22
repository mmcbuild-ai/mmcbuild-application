import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/supabase/db";
import {
  detectPlanKind,
  cloudConvertInputFormat,
  requiresPdfConversion,
  type PlanFileKind,
} from "@/lib/plans/file-kind";
import { convertViaCloudConvert } from "@/lib/plans/dwg-converter";
import { extractSpatialLayoutFromDxf } from "@/lib/plans/dxf-extractor";
import { extractFullHouse } from "@/lib/build/spatial/full-house-extractor";
import { extractSpatialLayout } from "@/lib/build/spatial/extractor";
import type { Test3DResult } from "@/lib/build/test-3d-runner";

/**
 * Async runner for /build/test-3d uploads, split into per-stage step.run
 * blocks so each Vercel invocation fits inside the 300s maxDuration ceiling.
 * A single step.run wrapping the whole extraction blew past 300s on DWGs,
 * Vercel killed the invocation, Inngest's transport-level retries spun
 * forever without ever marking the job done or error.
 *
 * Stages (each its own Vercel invocation):
 *   mark-processing       — write started_at
 *   dwg-dxf-path          — DWG only: download → DXF → wall-layer extract
 *   pdf-path              — fallback/non-DWG: download → PDF → full-house
 *   write-result          — final status='done' + result jsonb
 *
 * The source file is re-downloaded from Storage inside each path step. The
 * round-trip is fast (15MB / a few seconds) and avoids passing 20MB+ base64
 * payloads through Inngest's per-step result-size limit (default 1MB).
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

    await step.run("mark-processing", async () => {
      await db()
        .from("test_3d_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    });

    const kind = detectPlanKind(fileName, null);
    if (!kind) {
      await markError(jobId, `Unsupported file type: ${fileName}`);
      return { jobId, status: "error" };
    }

    // Stage 1 — DWG-only DXF path. Returns a Test3DResult when it produces
    // a viable layout, null when the file isn't DWG or DXF didn't yield
    // a usable layout (caller falls through to the PDF path).
    if (kind === "dwg") {
      const dxfResult = await step.run("dwg-dxf-path", async () => {
        const buf = await downloadSourceBuffer(storagePath);
        if (!buf) return null;
        const dxfConv = await convertViaCloudConvert(buf, fileName, "dwg", "dxf");
        if ("error" in dxfConv) {
          console.log(
            "[run-test-3d-extraction] DWG→DXF failed:",
            dxfConv.error,
          );
          return null;
        }
        const layout = extractSpatialLayoutFromDxf(dxfConv.buffer);
        if (!layout) return null;
        if (!layout.roof) {
          layout.roof = {
            form: "gable",
            pitch_deg: 22.5,
            eave_overhang_m: 0.5,
          };
        }
        const result: Test3DResult = {
          layout,
          kind,
          convertedFrom: "dwg",
          extractedVia: "dxf-direct",
        };
        return result;
      });

      if (dxfResult) {
        await step.run("write-dxf-result", async () => {
          await db()
            .from("test_3d_jobs")
            .update({
              status: "done",
              result: dxfResult,
              finished_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        });
        return { jobId, status: "done", extractedVia: "dxf-direct" };
      }
    }

    // Stage 2 — PDF + AI vision path. Handles native PDFs, images, and the
    // DWG fallback when DXF didn't produce a layout. Returns the final
    // Test3DResult (including its own error field if extraction failed).
    const pdfResult = await step.run("pdf-path", async () => {
      return await runPdfPath(storagePath, kind, fileName, pageInput);
    });

    await step.run("write-result", async () => {
      await db()
        .from("test_3d_jobs")
        .update({
          status: "done",
          result: pdfResult,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    });

    return { jobId, status: "done" };
  },
);

async function downloadSourceBuffer(storagePath: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("plan-uploads")
    .download(storagePath);
  if (error || !data) {
    console.error("[run-test-3d-extraction] storage download failed:", error);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

async function markError(jobId: string, message: string) {
  await db()
    .from("test_3d_jobs")
    .update({
      status: "error",
      error: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/**
 * PDF / image / DWG-fallback extraction path. Mirrors the logic that was
 * previously in src/lib/build/test-3d-runner.ts for non-DXF inputs, but
 * inlined here so the entire path runs inside one step.run invocation
 * and we can keep the runner module focused on its current consumers
 * (legacy sync action paths if any).
 */
async function runPdfPath(
  storagePath: string,
  kind: PlanFileKind,
  fileName: string,
  pageInput?: string,
): Promise<Test3DResult> {
  const sourceBuffer = await downloadSourceBuffer(storagePath);
  if (!sourceBuffer) {
    return { layout: null, kind, error: "Storage download failed" };
  }

  try {
    let pdfBuffer: Buffer | null = null;
    let convertedFrom: PlanFileKind | undefined;
    let directImage: {
      base64: string;
      mediaType: "image/png" | "image/jpeg";
    } | null = null;

    if (kind === "pdf") {
      pdfBuffer = sourceBuffer;
    } else if (kind === "image") {
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "webp") {
        return {
          layout: null,
          kind,
          error:
            "WebP not supported by the current extractor. Convert to PNG/JPG and re-upload.",
        };
      }
      const mediaType: "image/png" | "image/jpeg" =
        ext === "png" ? "image/png" : "image/jpeg";
      directImage = {
        base64: sourceBuffer.toString("base64"),
        mediaType,
      };
    } else if (requiresPdfConversion(kind) || kind === "dwg") {
      const inputFormat =
        kind === "dwg" ? "dwg" : cloudConvertInputFormat(kind, fileName);
      if (!inputFormat) {
        return {
          layout: null,
          kind,
          error: `No CloudConvert input format for kind: ${kind}`,
        };
      }
      const conv = await convertViaCloudConvert(
        sourceBuffer,
        fileName,
        inputFormat,
        "pdf",
      );
      if ("error" in conv) {
        return {
          layout: null,
          kind,
          error: `CloudConvert ${kind} → PDF failed: ${conv.error}`,
        };
      }
      pdfBuffer = conv.buffer;
      convertedFrom = kind;
    } else {
      return {
        layout: null,
        kind,
        error: `Unsupported kind in harness: ${kind}`,
      };
    }

    if (pdfBuffer) {
      const requestedPage =
        pageInput && pageInput.trim() !== ""
          ? Number(pageInput.trim())
          : undefined;
      const pdfBase64 = pdfBuffer.toString("base64");
      const result = await extractFullHouse(pdfBase64, {
        floorPlanPageOverride: requestedPage,
      });

      if (result.error || !result.layout) {
        return {
          layout: null,
          kind,
          convertedFrom,
          detectedPage: result.floorPlanPage ?? undefined,
          pdfPageCount: result.totalPages ?? undefined,
          classifications: result.classifications,
          decomposer: result.decomposer,
          error: result.error ?? "PDF extraction returned no layout",
        };
      }

      return {
        layout: result.layout,
        detectedPage:
          requestedPage == null ? (result.floorPlanPage ?? undefined) : undefined,
        pageUsed: requestedPage ?? (result.floorPlanPage ?? undefined),
        pdfPageCount: result.totalPages ?? undefined,
        kind,
        convertedFrom,
        classifications: result.classifications,
        elevationsExtracted: result.elevationsExtracted.length,
        sectionPage: result.sectionExtracted?.pageNumber,
        schedulePage: result.scheduleExtracted?.pageNumber,
        decomposer: result.decomposer,
      };
    }

    if (directImage) {
      const layout = await extractSpatialLayout(
        directImage.base64,
        directImage.mediaType,
      );
      return { layout, kind };
    }

    return { layout: null, kind, error: "Unreachable code path" };
  } catch (err) {
    console.error("[run-test-3d-extraction] runPdfPath threw:", err);
    return {
      layout: null,
      kind,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
