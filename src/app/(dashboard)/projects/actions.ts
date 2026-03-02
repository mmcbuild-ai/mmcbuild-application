"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { deriveSiteIntel } from "@/lib/site-intel";
import { getStaticMapUrl } from "@/lib/mapbox";

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");
  return profile as { id: string; org_id: string; role: string };
}

export async function createProject(formData: FormData) {
  const profile = await getProfile();
  const admin = createAdminClient();

  const name = formData.get("name") as string;
  const address = (formData.get("address") as string) || null;
  const latStr = formData.get("latitude") as string | null;
  const lngStr = formData.get("longitude") as string | null;
  const suburb = (formData.get("suburb") as string) || null;
  const postcode = (formData.get("postcode") as string) || null;
  const state = (formData.get("state") as string) || null;

  if (!name?.trim()) throw new Error("Project name is required");

  // Insert the project
  const { data: project, error } = await admin
    .from("projects")
    .insert({
      org_id: profile.org_id,
      name: name.trim(),
      address,
      status: "draft",
      created_by: profile.id,
    } as never)
    .select("id")
    .single();

  if (error || !project)
    throw new Error(`Failed to create project: ${error?.message}`);

  // Derive site intel if we have geocoded coordinates
  const lat = latStr ? parseFloat(latStr) : null;
  const lng = lngStr ? parseFloat(lngStr) : null;

  if (lat != null && lng != null && isFinite(lat) && isFinite(lng)) {
    try {
      const intel = await deriveSiteIntel(lat, lng);
      const staticMapUrl = getStaticMapUrl(lat, lng);

      await admin.from("project_site_intel").insert({
        project_id: project.id,
        org_id: profile.org_id,
        latitude: lat,
        longitude: lng,
        formatted_address: address,
        suburb: suburb || null,
        postcode: postcode || null,
        state: state || null,
        climate_zone: intel.climate_zone,
        wind_region: intel.wind_region,
        bal_rating: intel.bal_rating,
        council_name: intel.council_name,
        council_code: intel.council_code,
        zoning: intel.zoning,
        overlays: {},
        static_map_url: staticMapUrl || null,
        derived_at: new Date().toISOString(),
      } as never);
    } catch (e) {
      // Site intel derivation is best-effort — project still created
      console.error("[createProject] Site intel derivation failed:", e);
    }
  }

  revalidatePath("/projects");
}

export async function getProjectSiteIntel(projectId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("project_site_intel")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  return data;
}

export async function rederiveSiteIntel(projectId: string) {
  const profile = await getProfile();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("project_site_intel")
    .select("latitude, longitude")
    .eq("project_id", projectId)
    .single();

  if (!existing?.latitude || !existing?.longitude) {
    throw new Error("No coordinates available to re-derive");
  }

  const lat = existing.latitude;
  const lng = existing.longitude;
  const intel = await deriveSiteIntel(lat, lng);
  const staticMapUrl = getStaticMapUrl(lat, lng);

  const { error } = await admin
    .from("project_site_intel")
    .update({
      climate_zone: intel.climate_zone,
      wind_region: intel.wind_region,
      bal_rating: intel.bal_rating,
      council_name: intel.council_name,
      council_code: intel.council_code,
      zoning: intel.zoning,
      static_map_url: staticMapUrl || null,
      derived_at: new Date().toISOString(),
    } as never)
    .eq("project_id", projectId)
    .eq("org_id", profile.org_id);

  if (error) throw new Error(`Re-derive failed: ${error.message}`);

  revalidatePath(`/projects/${projectId}`);
}
