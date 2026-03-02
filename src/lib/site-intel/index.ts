/**
 * Site intelligence orchestrator.
 * Derives climate zone, wind region, and council/LGA from coordinates.
 */

import { deriveClimateZone } from "./climate";
import { deriveWindRegion } from "./wind-region";
import { deriveCouncil } from "./council";

export interface SiteIntelResult {
  climate_zone: number | null;
  wind_region: string | null;
  bal_rating: string | null;
  council_name: string | null;
  council_code: string | null;
  zoning: string | null;
}

export async function deriveSiteIntel(
  lat: number,
  lng: number
): Promise<SiteIntelResult> {
  const [climateZone, windResult, councilResult] = await Promise.all([
    deriveClimateZone(lat, lng).catch(() => null),
    deriveWindRegion(lat, lng).catch(() => ({ wind_region: null })),
    deriveCouncil(lat, lng).catch(() => ({
      council_name: null,
      council_code: null,
    })),
  ]);

  return {
    climate_zone: climateZone,
    wind_region: windResult.wind_region,
    bal_rating: null, // Requires external dataset — future enrichment
    council_name: councilResult.council_name,
    council_code: councilResult.council_code,
    zoning: null, // Requires external dataset — future enrichment
  };
}
