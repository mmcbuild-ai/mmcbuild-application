import type { SpatialLayout } from "@/lib/build/spatial/types";
import type { DecomposerDiagnostic } from "@/lib/build/spatial/full-house-extractor";
import type { PlanFileKind } from "@/lib/plans/file-kind";
import type { PageTypeClassification } from "@/lib/build/spatial/page-classifier";

/**
 * Result shape of the 3D extraction pipeline. Returned by the single
 * `run-test-3d-extraction` Inngest function (the one process used by the
 * production /build module, the projects flow, AND the test-3d harness) and
 * serialised into `test_3d_jobs.result` (jsonb), read back by the status
 * endpoint + the harness UI.
 *
 * This lives in a dedicated, side-effect-free types module (NOT in a
 * `"use server"` action file and NOT in the old `test-3d-runner.ts`) so every
 * consumer — client harness, server action, Inngest worker — imports the same
 * type from one place. Type-only imports are erased at build, so a client
 * component importing this never pulls a server-only module.
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
