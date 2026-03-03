"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createAdminClient() as unknown as any; }

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return profile;
}

export async function listRateSources() {
  await requireAdmin();

  const { data, error } = await db()
    .from("cost_rate_sources")
    .select("id, name, source_type, config, last_synced_at, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load rate sources: ${error.message}`);
  return data as {
    id: string;
    name: string;
    source_type: string;
    config: Record<string, unknown>;
    last_synced_at: string | null;
    is_active: boolean;
    created_at: string;
  }[];
}

export async function createRateSource(
  name: string,
  sourceType: "api" | "csv" | "manual",
  config: Record<string, unknown>
) {
  await requireAdmin();

  const { error } = await db()
    .from("cost_rate_sources")
    .insert({
      name,
      source_type: sourceType,
      config,
      is_active: true,
    } as never);

  if (error) throw new Error(`Failed to create rate source: ${error.message}`);
  revalidatePath("/settings/cost-rates");
}

export async function toggleRateSource(id: string, isActive: boolean) {
  await requireAdmin();

  const { error } = await db()
    .from("cost_rate_sources")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Failed to toggle rate source: ${error.message}`);
  revalidatePath("/settings/cost-rates");
}

export async function triggerSync(sourceId: string) {
  await requireAdmin();

  await inngest.send({
    name: "cost/rates.ingest-requested",
    data: { sourceId },
  });

  revalidatePath("/settings/cost-rates");
}
