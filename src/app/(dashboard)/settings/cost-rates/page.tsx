import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/db";
import { redirect } from "next/navigation";
import { RateSourceCard } from "@/components/settings/rate-source-card";
import { NewRateSourceForm } from "@/components/settings/new-rate-source-form";

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

  const { data: sources } = await db()
    .from("cost_rate_sources")
    .select("id, name, source_type, config, last_synced_at, is_active, created_at")
    .order("created_at", { ascending: true });

  const rateSources = (sources ?? []) as {
    id: string;
    name: string;
    source_type: string;
    config: Record<string, unknown>;
    last_synced_at: string | null;
    is_active: boolean;
    created_at: string;
  }[];

  // Count rates per source
  const { data: rateCounts } = await db()
    .from("cost_reference_rates")
    .select("source_id");

  const sourceRateCounts = new Map<string, number>();
  for (const r of (rateCounts ?? []) as { source_id: string | null }[]) {
    if (r.source_id) {
      sourceRateCounts.set(r.source_id, (sourceRateCounts.get(r.source_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Cost Rate Sources</h1>
        <p className="text-sm text-muted-foreground">
          Manage external data sources for construction cost rates. Rates from
          active sources are used by the MMC Quote cost estimation engine.
        </p>
      </div>

      {/* Existing sources */}
      <div className="space-y-3">
        {rateSources.map((source) => (
          <div key={source.id}>
            <RateSourceCard source={source} />
            <p className="text-xs text-muted-foreground mt-1 ml-1">
              {sourceRateCounts.get(source.id) ?? 0} reference rate{(sourceRateCounts.get(source.id) ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
        {rateSources.length === 0 && (
          <div className="rounded-md border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No rate sources configured yet.
            </p>
          </div>
        )}
      </div>

      {/* Add new source */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold mb-3">Add Rate Source</h2>
        <NewRateSourceForm />
      </div>
    </div>
  );
}
