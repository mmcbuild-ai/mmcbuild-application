import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/db";
import { redirect } from "next/navigation";
import { CostRatesAdmin } from "./cost-rates-admin";

export default async function CostRatesPage() {
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

  // Fetch rate sources for the Sources tab
  const { data: sources } = await db()
    .from("cost_rate_sources")
    .select("id, name, source_type, config, last_synced_at, is_active, created_at")
    .order("created_at", { ascending: true });

  // Count rates per source
  const { data: rateCounts } = await db()
    .from("cost_reference_rates")
    .select("source_id");

  const sourceRateCounts: Record<string, number> = {};
  for (const r of (rateCounts ?? []) as { source_id: string | null }[]) {
    if (r.source_id) {
      sourceRateCounts[r.source_id] = (sourceRateCounts[r.source_id] ?? 0) + 1;
    }
  }

  // Get categories for filters
  const { data: catData } = await db()
    .from("cost_reference_rates")
    .select("category");
  const categories = Array.from(
    new Set((catData as { category: string }[] ?? []).map((r) => r.category))
  ).sort();

  return (
    <CostRatesAdmin
      sources={(sources ?? []) as {
        id: string;
        name: string;
        source_type: string;
        config: Record<string, unknown>;
        last_synced_at: string | null;
        is_active: boolean;
        created_at: string;
      }[]}
      sourceRateCounts={sourceRateCounts}
      categories={categories}
    />
  );
}
