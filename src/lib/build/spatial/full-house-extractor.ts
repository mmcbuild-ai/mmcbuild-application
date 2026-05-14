/**
 * Full-house extractor — orchestrates v2-v4 extraction across all
 * page types in an architectural plan set.
 *
 * Pipeline:
 *   1. classifyAllPagesNative — single Sonnet call labels every page
 *   2. Fan out per-page-type extractors in parallel:
 *        - floor plan (existing extractFloorPlanFromPdf)
 *        - elevations (roof form / pitch / cladding)
 *        - section (storey heights)
 *        - schedule (default materials)
 *   3. Merge results into one SpatialLayout
 */

import "server-only";
import {
  classifyAllPagesNative,
  type PageTypeClassification,
} from "./page-classifier";
import {
  extractFloorPlanFromPdf,
  extractElevation,
  extractSection,
  extractSchedule,
  type ElevationExtraction,
  type SectionExtraction,
  type ScheduleExtraction,
} from "./extractor";
import type { SpatialLayout, RoofForm } from "./types";

export type FullHouseExtraction = {
  layout: SpatialLayout | null;
  classifications: PageTypeClassification[];
  floorPlanPage: number | null;
  elevationsExtracted: ElevationExtraction[];
  sectionExtracted: SectionExtraction | null;
  scheduleExtracted: ScheduleExtraction | null;
  totalPages: number | null;
  error?: string;
};

const ELEVATION_TYPES = new Set([
  "elevation_n",
  "elevation_s",
  "elevation_e",
  "elevation_w",
  "elevation_other",
]);

export async function extractFullHouse(
  pdfBase64: string,
  options?: { floorPlanPageOverride?: number },
): Promise<FullHouseExtraction> {
  const t0 = Date.now();
  console.log(
    `[extractFullHouse] start — pdf base64 length ${pdfBase64.length} chars (~${Math.round(pdfBase64.length / 1024 / 1024)} MB)`,
  );

  // 1. Classify all pages
  const classifications = await classifyAllPagesNative(pdfBase64);
  console.log(
    `[extractFullHouse] classifier returned ${classifications.length} pages at +${Date.now() - t0}ms`,
  );
  if (classifications.length === 0) {
    return {
      layout: null,
      classifications: [],
      floorPlanPage: null,
      elevationsExtracted: [],
      sectionExtracted: null,
      scheduleExtracted: null,
      totalPages: null,
      error: "Page classification failed",
    };
  }

  // 2. Find pages by type. Manual override wins.
  const floorPlanPage =
    options?.floorPlanPageOverride ??
    classifications.find((c) => c.type === "floor_plan_ground")?.pageNumber ??
    classifications.find((c) => c.type === "floor_plan_upper")?.pageNumber ??
    null;

  const elevationPages = classifications.filter((c) =>
    ELEVATION_TYPES.has(c.type),
  );
  const sectionPage =
    classifications.find((c) => c.type === "section")?.pageNumber ?? null;
  const schedulePage =
    classifications.find((c) => c.type === "schedule")?.pageNumber ?? null;

  // 3. Fan out extractions in parallel — allSettled so a single failure
  // (Anthropic rate limit, transient network) doesn't kill the whole run.
  const floorPlanPromise = floorPlanPage
    ? extractFloorPlanFromPdf(pdfBase64, { pageHint: floorPlanPage })
    : Promise.resolve(null);
  const elevationPromises = elevationPages.map((p) =>
    extractElevation(pdfBase64, p.pageNumber),
  );
  const sectionPromise = sectionPage
    ? extractSection(pdfBase64, sectionPage)
    : Promise.resolve(null);
  const schedulePromise = schedulePage
    ? extractSchedule(pdfBase64, schedulePage)
    : Promise.resolve(null);

  const settled = await Promise.allSettled([
    floorPlanPromise,
    Promise.allSettled(elevationPromises),
    sectionPromise,
    schedulePromise,
  ]);

  const floorPlanResult =
    settled[0].status === "fulfilled" ? settled[0].value : null;
  if (settled[0].status === "rejected") {
    console.error("[extractFullHouse] floor plan rejected:", settled[0].reason);
  }

  const elevationResults: (ElevationExtraction | null)[] =
    settled[1].status === "fulfilled"
      ? settled[1].value.map((r, i) => {
          if (r.status === "fulfilled") return r.value;
          console.error(
            `[extractFullHouse] elevation page ${elevationPages[i]?.pageNumber} rejected:`,
            r.reason,
          );
          return null;
        })
      : [];

  const sectionResult =
    settled[2].status === "fulfilled" ? settled[2].value : null;
  if (settled[2].status === "rejected") {
    console.error("[extractFullHouse] section rejected:", settled[2].reason);
  }

  const scheduleResult =
    settled[3].status === "fulfilled" ? settled[3].value : null;
  if (settled[3].status === "rejected") {
    console.error("[extractFullHouse] schedule rejected:", settled[3].reason);
  }

  const elevationsValid = elevationResults.filter(
    (e): e is ElevationExtraction => e != null && e.confidence > 0,
  );

  console.log(
    `[extractFullHouse] extractions complete at +${Date.now() - t0}ms — floorPlan=${floorPlanResult?.layout ? "ok" : "fail"}, elevations=${elevationsValid.length}/${elevationPages.length}, section=${sectionResult ? "ok" : "none"}, schedule=${scheduleResult ? "ok" : "none"}`,
  );

  if (!floorPlanResult || !floorPlanResult.layout) {
    return {
      layout: null,
      classifications,
      floorPlanPage,
      elevationsExtracted: elevationsValid,
      sectionExtracted: sectionResult,
      scheduleExtracted: scheduleResult,
      totalPages: floorPlanResult?.totalPages ?? classifications.length,
      error: floorPlanResult?.error ?? "No floor plan extracted",
    };
  }

  // 4. Merge into one SpatialLayout
  const layout: SpatialLayout = { ...floorPlanResult.layout };

  // Roof — pick highest-confidence elevation that has roof.form
  const elevationsWithRoof = elevationsValid.filter((e) => e.roof?.form);
  if (elevationsWithRoof.length > 0) {
    const best = [...elevationsWithRoof].sort(
      (a, b) => b.confidence - a.confidence,
    )[0];
    layout.roof = {
      form: (best.roof?.form ?? "gable") as RoofForm,
      pitch_deg: best.roof?.pitch_deg ?? 22.5,
      eave_overhang_m: best.roof?.eave_overhang_m ?? 0.5,
      ridge_height_m: best.roof?.ridge_height_m,
      material: best.roof?.material,
      colour: best.roof?.colour,
    };
  }

  // Wall height — average across elevations that reported one
  const heights = elevationsValid
    .map((e) => e.external_wall_height_m)
    .filter((h): h is number => typeof h === "number" && h > 0);
  if (heights.length > 0) {
    layout.wall_height = heights.reduce((s, h) => s + h, 0) / heights.length;
  }

  // Materials — schedule wins; fall back to dominant cladding across elevations
  if (scheduleResult?.materials) {
    layout.materials = scheduleResult.materials;
  } else if (elevationsValid.length > 0) {
    const claddingCounts = new Map<string, number>();
    for (const e of elevationsValid) {
      if (e.cladding) {
        claddingCounts.set(e.cladding, (claddingCounts.get(e.cladding) ?? 0) + 1);
      }
    }
    const dominant = [...claddingCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    layout.materials = {
      wall_default: dominant?.[0],
      wall_colour: elevationsValid.find((e) => e.cladding_colour)
        ?.cladding_colour,
      roof_material: layout.roof?.material,
      roof_colour: layout.roof?.colour,
      window_frame: elevationsValid.find((e) => e.window_frame)?.window_frame,
    };
  }

  // Storey details — from section if available; override wall_height with
  // ground floor measurement (more accurate than elevation estimate)
  if (sectionResult && sectionResult.storeys.length > 0) {
    layout.storey_details = sectionResult.storeys;
    const ground = sectionResult.storeys.find((s) => s.level === 0);
    if (ground?.floor_to_ceiling_m) {
      layout.wall_height = ground.floor_to_ceiling_m;
    }
  }

  // Average confidence across all extractions
  const confidences = [
    floorPlanResult.layout.confidence,
    ...elevationsValid.map((e) => e.confidence),
    sectionResult?.confidence ?? 0,
    scheduleResult?.confidence ?? 0,
  ].filter((c) => c > 0);
  if (confidences.length > 0) {
    layout.confidence =
      confidences.reduce((s, c) => s + c, 0) / confidences.length;
  }

  return {
    layout,
    classifications,
    floorPlanPage,
    elevationsExtracted: elevationsValid,
    sectionExtracted: sectionResult,
    scheduleExtracted: scheduleResult,
    totalPages: floorPlanResult.totalPages ?? classifications.length,
  };
}
