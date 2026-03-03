"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

function db() {
  return createAdminClient() as unknown as AnyDb;
}

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
    .select("id, project_id, org_id, plan_id, status, summary, started_at, completed_at, created_at")
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

export async function getProjectDesignChecks(projectId: string) {
  const { data } = await db()
    .from("design_checks")
    .select("id, status, summary, created_at, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
