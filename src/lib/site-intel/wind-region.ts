/**
 * Derive AS4055 wind region from lat/lng using GeoJSON point-in-polygon.
 * Loads wind_regions.geojson from Supabase Storage on first call, cached in memory.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  findFeatureContainingPoint,
  type GeoJSONFeatureCollection,
} from "./geo-utils";

let windDataCache: GeoJSONFeatureCollection | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadWindData(): Promise<void> {
  if (windDataCache) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from("site-data")
        .download("wind_regions.geojson");

      if (error || !data) {
        console.error("[wind-region] Failed to load GeoJSON:", error?.message);
        return;
      }

      const text = await data.text();
      windDataCache = JSON.parse(text) as GeoJSONFeatureCollection;
      console.log(
        `[wind-region] Loaded ${windDataCache.features?.length ?? 0} wind regions`
      );
    } catch (e) {
      console.error("[wind-region] Error loading GeoJSON:", e);
    }
  })();

  return loadingPromise;
}

export interface WindResult {
  wind_region: string | null;
}

export async function deriveWindRegion(
  lat: number,
  lng: number
): Promise<WindResult> {
  await loadWindData();

  if (!windDataCache) {
    return { wind_region: null };
  }

  const feature = findFeatureContainingPoint(windDataCache, lat, lng);
  if (!feature) {
    return { wind_region: null };
  }

  const region =
    (feature.properties?.REGION as string) ??
    (feature.properties?.region as string) ??
    (feature.properties?.wind_region as string) ??
    null;

  return { wind_region: region };
}
