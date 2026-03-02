/**
 * Derive council/LGA from lat/lng using GeoJSON point-in-polygon.
 * Loads australia_lga.geojson (council_clean.geojson) from Supabase Storage.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  findFeatureContainingPoint,
  type GeoJSONFeatureCollection,
} from "./geo-utils";

let councilDataCache: GeoJSONFeatureCollection | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadCouncilData(): Promise<void> {
  if (councilDataCache) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from("site-data")
        .download("council_clean.geojson");

      if (error || !data) {
        console.error("[council] Failed to load GeoJSON:", error?.message);
        return;
      }

      const text = await data.text();
      councilDataCache = JSON.parse(text) as GeoJSONFeatureCollection;
      console.log(
        `[council] Loaded ${councilDataCache.features?.length ?? 0} council boundaries`
      );
    } catch (e) {
      console.error("[council] Error loading GeoJSON:", e);
    }
  })();

  return loadingPromise;
}

export interface CouncilResult {
  council_name: string | null;
  council_code: string | null;
}

export async function deriveCouncil(
  lat: number,
  lng: number
): Promise<CouncilResult> {
  await loadCouncilData();

  if (!councilDataCache) {
    return { council_name: null, council_code: null };
  }

  const feature = findFeatureContainingPoint(councilDataCache, lat, lng);
  if (!feature) {
    return { council_name: null, council_code: null };
  }

  const props = feature.properties;

  // Handle possible array values (as seen in F2K reference)
  const rawName =
    props?.lga_name ?? props?.LGA_NAME ?? props?.council_name ?? props?.name;
  const rawCode =
    props?.council_code ?? props?.LGA_CODE ?? props?.lga_code;

  const council_name = Array.isArray(rawName)
    ? (rawName[0] as string)
    : (rawName as string) ?? null;
  const council_code = Array.isArray(rawCode)
    ? (rawCode[0] as string)
    : (rawCode as string) ?? null;

  return { council_name, council_code };
}
