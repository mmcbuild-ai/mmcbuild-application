import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { estimateQuerySchema } from "@/lib/validators/marketplace";
import { trustGate } from "@/lib/platform-trust";
import { createPublicEstimate } from "@/lib/estimation/create-estimate";

// Node runtime: uses crypto + the service-role admin client + callModel.
// The estimate is a single cheap parse + deterministic maths, well under the
// edge timeout, so it runs synchronously (no Inngest needed).
export const runtime = "nodejs";

function hashIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = estimateQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ipHash = hashIp(req);

  // Abuse gate BEFORE any LLM spend. Keyed per-IP so a single client can't
  // hammer the public endpoint. Fails OPEN on gate-infrastructure error (not on
  // denial): the deterministic estimate costs sub-cent, so an unreachable trust
  // backend should not take the feature down. A denial (rate limit) returns 429.
  try {
    const gate = await trustGate({
      agent_id: `marketplace-estimate:${ipHash}`,
      tool_name: "marketplace_estimate",
      operation_type: "write",
      scope: "public",
      input: { query: parsed.data.query },
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: "Too many requests — please try again shortly", retryAfter: gate.retry_after ?? 60 },
        { status: 429 }
      );
    }
  } catch (gateErr) {
    console.warn(
      "[api/estimate] trustGate unavailable, proceeding (cheap deterministic estimate):",
      gateErr instanceof Error ? gateErr.message : gateErr
    );
  }

  try {
    const { token, status } = await createPublicEstimate({
      query: parsed.data.query,
      region: parsed.data.region,
      source: parsed.data.source,
      ipHash,
    });
    return NextResponse.json({ token, status });
  } catch (err) {
    console.error("[api/estimate] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Could not generate an estimate right now" },
      { status: 500 }
    );
  }
}
