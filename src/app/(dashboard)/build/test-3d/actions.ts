"use server";

import { createClient } from "@/lib/supabase/server";
import {
  extractSpatialLayout,
  extractFloorPlanFromPdf,
} from "@/lib/build/spatial/extractor";
import { convertViaCloudConvert } from "@/lib/plans/dwg-converter";
import {
  detectPlanKind,
  cloudConvertInputFormat,
  requiresPdfConversion,
  type PlanFileKind,
} from "@/lib/plans/file-kind";
import type { SpatialLayout } from "@/lib/build/spatial/types";

export type Test3DResult = {
  layout: SpatialLayout | null;
  detectedPage?: number;
  totalPagesInspected?: number;
  pageUsed?: number;
  pdfPageCount?: number;
  kind?: PlanFileKind;
  convertedFrom?: PlanFileKind;
  error?: string;
};

export async function extractTest3D(input: {
  storagePath: string;
  fileName: string;
  pageInput?: string;
}): Promise<Test3DResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { layout: null, error: "Unauthorised" };

  const { storagePath, fileName, pageInput } = input;
  const kind = detectPlanKind(fileName, null);
  if (!kind) {
    return { layout: null, error: `Unsupported file type: ${fileName}` };
  }

  const { data: fileBlob, error: dlError } = await supabase.storage
    .from("plan-uploads")
    .download(storagePath);

  if (dlError || !fileBlob) {
    return {
      layout: null,
      kind,
      error: `Storage download failed: ${dlError?.message ?? "unknown"}`,
    };
  }

  const sourceBuffer = Buffer.from(await fileBlob.arrayBuffer());

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
      // Native PDF path — Anthropic reads the PDF directly. Skips
      // pdf-to-img / pdfjs-dist / @napi-rs/canvas entirely, which were
      // failing in the Vercel serverless bundle (missing DOMMatrix).
      const requestedPage =
        pageInput && pageInput.trim() !== ""
          ? Number(pageInput.trim())
          : undefined;

      const pdfBase64 = pdfBuffer.toString("base64");
      const result = await extractFloorPlanFromPdf(pdfBase64, {
        pageHint: requestedPage,
      });

      if (result.error || !result.layout) {
        return {
          layout: null,
          kind,
          convertedFrom,
          detectedPage: result.detectedPage ?? undefined,
          pdfPageCount: result.totalPages ?? undefined,
          error: result.error ?? "PDF extraction returned no layout",
        };
      }

      return {
        layout: result.layout,
        detectedPage:
          requestedPage == null ? (result.detectedPage ?? undefined) : undefined,
        pageUsed: requestedPage ?? (result.detectedPage ?? undefined),
        pdfPageCount: result.totalPages ?? undefined,
        kind,
        convertedFrom,
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
    console.error("[test-3d] extract failed:", err);
    return {
      layout: null,
      kind,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
