import type { MapboxFeature, GeocodedAddress } from "./mapbox-types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/**
 * Forward geocode search via Mapbox Geocoding API v5.
 * Client-safe — uses the public token.
 */
export async function forwardSearch(query: string): Promise<MapboxFeature[]> {
  if (!query || query.length < 4 || !MAPBOX_TOKEN) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("country", "au");
  url.searchParams.set("types", "address,place,locality");
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "5");

  const resp = await fetch(url.toString());
  if (!resp.ok) return [];

  const data = await resp.json();
  return (data.features ?? []) as MapboxFeature[];
}

/** Extract postcode from Mapbox feature context */
export function extractPostcode(feature: MapboxFeature): string | null {
  const ctx = feature.context?.find((c) => c.id.startsWith("postcode"));
  return ctx?.text ?? null;
}

/** Extract suburb/locality from Mapbox feature context */
export function extractSuburb(feature: MapboxFeature): string | null {
  const ctx = feature.context?.find(
    (c) => c.id.startsWith("locality") || c.id.startsWith("place")
  );
  return ctx?.text ?? null;
}

/** Extract state from Mapbox feature context */
export function extractState(feature: MapboxFeature): string | null {
  const ctx = feature.context?.find((c) => c.id.startsWith("region"));
  return ctx?.short_code?.replace("AU-", "") ?? ctx?.text ?? null;
}

/** Convert a Mapbox feature to a GeocodedAddress */
export function featureToGeocodedAddress(
  feature: MapboxFeature
): GeocodedAddress {
  return {
    latitude: feature.center[1],
    longitude: feature.center[0],
    formatted_address: feature.place_name,
    suburb: extractSuburb(feature),
    postcode: extractPostcode(feature),
    state: extractState(feature),
  };
}

/**
 * Generate a Mapbox Static Map URL for a given lat/lng.
 * Uses the server-side secret token if available, falls back to public.
 */
export function getStaticMapUrl(
  lat: number,
  lng: number,
  options?: { width?: number; height?: number; zoom?: number }
): string {
  const token = process.env.MAPBOX_SECRET_TOKEN || MAPBOX_TOKEN;
  if (!token) return "";

  const w = options?.width ?? 600;
  const h = options?.height ?? 300;
  const z = options?.zoom ?? 15;

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ef4444(${lng},${lat})/${lng},${lat},${z},0/${w}x${h}@2x?access_token=${token}`;
}
