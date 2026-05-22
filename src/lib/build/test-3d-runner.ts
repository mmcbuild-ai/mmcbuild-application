import "server-only";

import { extractSpatialLayout } from "@/lib/build/spatial/extractor";
import {
  extractFullHouse,
  type DecomposerDiagnostic,
} from "@/lib/build/spatial/full-house-extractor";
import { convertViaCloudConvert } from "@/lib/plans/dwg-converter";
import { extractSpatialLayoutFromDxf } from "@/lib/plans/dxf-extractor";
import {
  detectPlanKind,
  cloudConvertInputFormat,
  requiresPdfConversion,
  type PlanFileKind,
} from "@/lib/plans/file-kind";
import type { SpatialLayout } from "@/lib/build/spatial/types";
import type { PageTypeClassification } from "@/lib/build/spatial/page-classifier";

/**
 * Result shape returned by the test-3d extractor. Mirrors what the harness
 * UI consumes. When the job is async (Inngest path), this is serialised to
 * the test_3d_jobs.result jsonb column and read back by the status endpoint.
 */
export type Test3DResult = {
  layout: SpatialLayout | null;
  detectedPage?: number;
  totalPagesInspected?: number;
  pageUsed?: number;
  pdfPageCount?: number;
  kind?: PlanFileKind;
  convertedFrom?: PlanFileKind;
  error?: string;
  classifications?: PageTypeClassification[];
  elevationsExtracted?: number;
  sectionPage?: number;
  schedulePage?: number;
  decomposer?: DecomposerDiagnostic;
  extractedVia?: "dxf-direct" | "ai-vision";
};

/**
 * Core extraction routine. Pure function over (file bytes, name, optional
 * page hint) → Test3DResult. No auth, no Supabase, no job-state writes —
 * those happen in the caller (Server Action for legacy sync, Inngest
 * function for the new async path). Long-running by nature (~10s for
 * PDFs, 30s–4min for DWGs depending on which extractor path wins).
 */
export async function runTest3DExtraction(
  sourceBuffer: Buffer,
  fileName: string,
  pageInput?: string,
): Promise<Test3DResult> {
  const kind = detectPlanKind(fileName, null);
  if (!kind) {
    return { layout: null, error: `Unsupported file type: ${fileName}` };
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
            "WebP not supported by the current extractor (media-type mismatch). Convert to PNG or JPG and re-upload.",
        };
      }
      const mediaType: "image/png" | "image/jpeg" =
        ext === "png" ? "image/png" : "image/jpeg";
      directImage = {
        base64: sourceBuffer.toString("base64"),
        mediaType,
      };
    } else if (requiresPdfConversion(kind) || kind === "dwg") {
      // DWG path: try DXF-direct extraction FIRST (geometry from CAD entities,
      // no AI vision, no rasterisation). Only fall through to PDF + AI vision
      // if DXF returns no viable layout.
      if (kind === "dwg") {
        const dxfConv = await convertViaCloudConvert(
          sourceBuffer,
          fileName,
          "dwg",
          "dxf",
        );
        if (!("error" in dxfConv)) {
          const dxfLayout = extractSpatialLayoutFromDxf(dxfConv.buffer);
          if (dxfLayout) {
            if (!dxfLayout.roof) {
              dxfLayout.roof = {
                form: "gable",
                pitch_deg: 22.5,
                eave_overhang_m: 0.5,
              };
            }
            return {
              layout: dxfLayout,
              kind,
              convertedFrom: "dwg",
              extractedVia: "dxf-direct",
            };
          }
          console.log(
            "[test-3d-runner] DXF extraction returned null — falling through to PDF + AI vision",
          );
        } else {
          console.log(
            "[test-3d-runner] CloudConvert DWG → DXF failed, falling through to PDF:",
            dxfConv.error,
          );
        }
      }

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
    console.error("[test-3d-runner] extract failed:", err);
    return {
      layout: null,
      kind,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
