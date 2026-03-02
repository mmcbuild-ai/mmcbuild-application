/**
 * Derive NatHERS climate zone (1-8) from GeoJSON polygon lookup,
 * with latitude-based approximation as fallback.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  findFeatureContainingPoint,
  type GeoJSONFeatureCollection,
} from "./geo-utils";

let climateDataCache: GeoJSONFeatureCollection | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadClimateData(): Promise<void> {
  if (climateDataCache) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from("site-data")
        .download("climate_clean.geojson");

      if (error || !data) {
        console.error("[climate] Failed to load GeoJSON:", error?.message);
        return;
      }

      const text = await data.text();
      climateDataCache = JSON.parse(text) as GeoJSONFeatureCollection;
      console.log(
        `[climate] Loaded ${climateDataCache.features?.length ?? 0} climate zones`
      );
    } catch (e) {
      console.error("[climate] Error loading GeoJSON:", e);
    }
  })();

  return loadingPromise;
}

/** Latitude-based fallback approximation */
function deriveClimateZoneFromLatitude(lat: number): number {
  if (lat > -12) return 1;
  if (lat > -20) return 2;
  if (lat > -23.5) return 3;
  if (lat > -27) return 4;
  if (lat > -31) return 5;
  if (lat > -35) return 6;
  if (lat > -39) return 7;
  return 8;
}

/** Extract zone number from the climate_description property */
function parseZoneFromProperties(
  properties: Record<string, unknown>
): number | null {
  const desc =
    (properties?.climate_description as string) ??
    (properties?.CLIMATE_DESCRIPTION as string) ??
    (properties?.zone as string) ??
    (properties?.ZONE as string) ??
    (properties?.climate_zone as string) ??
    null;

  if (!desc) return null;

  // Try to extract a number (e.g. "zone 6", "6", "Climate Zone 6")
  const match = desc.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export async function deriveClimateZone(
  lat: number,
  lng: number
): Promise<number> {
  await loadClimateData();

  if (climateDataCache) {
    const feature = findFeatureContainingPoint(climateDataCache, lat, lng);
    if (feature) {
      const zone = parseZoneFromProperties(feature.properties);
      if (zone && zone >= 1 && zone <= 8) {
        return zone;
      }
    }
  }

  // Fallback to latitude approximation
  return deriveClimateZoneFromLatitude(lat);
}
