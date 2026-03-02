import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function AIPerformancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const orgId = profile.org_id;

  // Fetch AI usage stats
  const { data: usageStats } = await admin
    .from("ai_usage_log")
    .select("ai_function, model_id, provider, input_tokens, output_tokens, estimated_cost_usd, latency_ms, was_fallback")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  // Fetch feedback stats
  const { data: feedbackStats } = await admin
    .from("finding_feedback")
    .select("rating")
    .eq("org_id", orgId);

  // Compute aggregates
  const usage = (usageStats ?? []) as Array<{
    ai_function: string;
    model_id: string;
    provider: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    latency_ms: number;
    was_fallback: boolean;
  }>;

  const totalCost = usage.reduce((sum, u) => sum + (u.estimated_cost_usd ?? 0), 0);
  const totalCalls = usage.length;
  const avgLatency = totalCalls > 0
    ? Math.round(usage.reduce((sum, u) => sum + (u.latency_ms ?? 0), 0) / totalCalls)
    : 0;
  const fallbackCount = usage.filter((u) => u.was_fallback).length;

  // Group by model
  const byModel = new Map<string, { calls: number; cost: number; avgLatency: number }>();
  for (const u of usage) {
    const existing = byModel.get(u.model_id) ?? { calls: 0, cost: 0, avgLatency: 0 };
    existing.calls++;
    existing.cost += u.estimated_cost_usd ?? 0;
    existing.avgLatency += u.latency_ms ?? 0;
    byModel.set(u.model_id, existing);
  }
  for (const [, v] of byModel) {
    v.avgLatency = Math.round(v.avgLatency / v.calls);
  }

  // Feedback aggregates
  const feedback = (feedbackStats ?? []) as Array<{ rating: number }>;
  const totalFeedback = feedback.length;
  const positiveFeedback = feedback.filter((f) => f.rating === 1).length;
  const negativeFeedback = feedback.filter((f) => f.rating === -1).length;
  const feedbackRate = totalFeedback > 0
    ? Math.round((positiveFeedback / totalFeedback) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Performance</h2>
        <p className="text-sm text-muted-foreground">
          Model usage, costs, and accuracy metrics for your organisation.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total AI Calls" value={totalCalls.toLocaleString()} />
        <StatCard title="Total Cost" value={`$${totalCost.toFixed(2)}`} />
        <StatCard title="Avg Latency" value={`${avgLatency}ms`} />
        <StatCard title="Fallback Rate" value={
          totalCalls > 0 ? `${Math.round((fallbackCount / totalCalls) * 100)}%` : "0%"
        } />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Feedback" value={totalFeedback.toLocaleString()} />
        <StatCard title="Positive Rate" value={`${feedbackRate}%`} />
        <StatCard title="Negative" value={negativeFeedback.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Usage by Model (Last 500 calls)</CardTitle>
        </CardHeader>
        <CardContent>
          {byModel.size === 0 ? (
            <p className="text-sm text-muted-foreground">No AI usage data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Model</th>
                    <th className="text-right py-2 font-medium">Calls</th>
                    <th className="text-right py-2 font-medium">Cost</th>
                    <th className="text-right py-2 font-medium">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byModel.entries()]
                    .sort((a, b) => b[1].calls - a[1].calls)
                    .map(([model, stats]) => (
                      <tr key={model} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{model}</td>
                        <td className="py-2 text-right">{stats.calls}</td>
                        <td className="py-2 text-right">${stats.cost.toFixed(4)}</td>
                        <td className="py-2 text-right">{stats.avgLatency}ms</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
