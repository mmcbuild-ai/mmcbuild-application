"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/supabase/db";
import { revalidatePath } from "next/cache";

export async function requestDesignOptimisation(
  projectId: string,
  planId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Create design check record
  const { data: check, error } = await db()
    .from("design_checks")
    .insert({
      project_id: projectId,
      org_id: profile.org_id,
      plan_id: planId,
      status: "queued",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !check) {
    return { error: `Failed to create design check: ${(error as { message: string })?.message}` };
  }

  // Fire Inngest event
  await inngest.send({
    name: "design/optimisation.requested",
    data: {
      projectId,
      planId,
    },
  });

  return { checkId: (check as { id: string }).id };
}

export async function getDesignReport(checkId: string) {
  const { data: check, error: checkError } = await db()
    .from("design_checks")
    .select("id, project_id, org_id, plan_id, status, summary, spatial_layout, started_at, completed_at, created_at")
    .eq("id", checkId)
    .single();

  if (checkError || !check) {
    return { error: "Design check not found", check: null, suggestions: [] };
  }

  const { data: suggestions } = await db()
    .from("design_suggestions")
    .select("*")
    .eq("check_id", checkId)
    .order("sort_order", { ascending: true });

  return { check, suggestions: suggestions ?? [] };
}

export async function updateSelectedSystems(
  projectId: string,
  systems: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };

  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select("org_id")
    .eq("id", projectId)
    .single();

  if (!project || project.org_id !== profile.org_id) {
    return { error: "Project not found" };
  }

  const { error } = await admin
    .from("projects")
    .update({
      selected_systems: systems,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", projectId);

  if (error) return { error: `Failed to update systems: ${error.message}` };

  revalidatePath(`/build/${projectId}`);
  revalidatePath(`/comply/${projectId}`);
  revalidatePath(`/quote/${projectId}`);
  return { success: true };
}

export async function getProjectSelectedSystems(projectId: string): Promise<string[]> {
  const { data } = await db()
    .from("projects")
    .select("selected_systems")
    .eq("id", projectId)
    .single();

  if (!data) return [];
  const systems = (data as { selected_systems: string[] | null }).selected_systems;
  return Array.isArray(systems) ? systems : [];
}

export async function getProjectDesignChecks(projectId: string) {
  const { data } = await db()
    .from("design_checks")
    .select("id, status, summary, created_at, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
