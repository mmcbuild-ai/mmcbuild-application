"use server";

import { createClient } from "@/lib/supabase/server";
import { extractSpatialLayout } from "@/lib/build/spatial/extractor";
import { renderPdfPage } from "@/lib/build/spatial/pdf-to-image";
import { findFloorPlanPage } from "@/lib/build/spatial/page-classifier";
import type { SpatialLayout } from "@/lib/build/spatial/types";

export type Test3DResult = {
  layout: SpatialLayout | null;
  detectedPage?: number;
  totalPagesInspected?: number;
  pageUsed?: number;
  fileType?: string;
  error?: string;
};

export async function extractTest3D(formData: FormData): Promise<Test3DResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { layout: null, error: "Unauthorised" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { layout: null, error: "No file provided" };
  }

  const pageInput = formData.get("page");
  const requestedPage =
    typeof pageInput === "string" && pageInput.trim() !== ""
      ? Number(pageInput)
      : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "";

  try {
    if (mime === "application/pdf") {
      let pageNumber = requestedPage;
      let detectedPage: number | undefined;
      let totalPagesInspected: number | undefined;

      if (pageNumber == null) {
        const pick = await findFloorPlanPage(buffer);
        pageNumber = pick.pageNumber ?? 1;
        detectedPage = pick.pageNumber ?? 1;
        totalPagesInspected = pick.totalPagesRendered;
      }

      const imageBase64 = await renderPdfPage(buffer, pageNumber, 2.0);
      if (!imageBase64) {
        return {
          layout: null,
          fileType: mime,
          error: `Failed to render PDF page ${pageNumber}`,
        };
      }
      const layout = await extractSpatialLayout(imageBase64, "image/png");
      return {
        layout,
        detectedPage,
        totalPagesInspected,
        pageUsed: pageNumber,
        fileType: mime,
      };
    }

    if (mime === "image/png" || mime === "image/jpeg") {
      const base64 = buffer.toString("base64");
      const layout = await extractSpatialLayout(base64, mime);
      return { layout, fileType: mime };
    }

    return {
      layout: null,
      fileType: mime,
      error: `Unsupported file type: ${mime || "unknown"}. Try PDF, PNG, or JPG.`,
    };
  } catch (err) {
    console.error("[test-3d] extract failed:", err);
    return {
      layout: null,
      fileType: mime,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
