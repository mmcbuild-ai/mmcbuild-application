import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitize } from "@/lib/security-gate";
import { estimateFromQuery } from "./estimate-from-query";

/**
 * Server-side orchestrator for a public, anonymous instant estimate.
 *
 *   sanitize(query) → persist anon enquiry → estimateFromQuery (deterministic)
 *     → persist estimate → issue opaque retrieval token (remediation pattern)
 *
 * Uses the service-role admin client because anon rows (org_id NULL) are
 * reachable only via service role (RLS denies user-facing access until claimed).
 * Table names are cast `as never` — these tables are newer than the generated
 * Supabase types, matching the established pattern in /api/remediation.
 */

const TOKEN_TTL_DAYS = 30;

export interface CreatedEstimate {
  token: string;
  status: "complete" | "no_rate" | "parse_failed";
}

export async function createPublicEstimate(input: {
  query: string;
  region?: string;
  source: "search" | "voice";
  discoveredIntent?: unknown;
  ipHash: string;
}): Promise<CreatedEstimate> {
  const admin = createAdminClient();

  // Untrusted public input — strip injection patterns before the LLM parse.
  const { sanitized } = sanitize(input.query);

  // 1. Anonymous enquiry (org_id / created_by NULL until claimed at signup).
  const { data: enquiry, error: enqErr } = await admin
    .from("marketplace_enquiries" as never)
    .insert({
      source: input.source,
      raw_query: sanitized,
      discovered_intent: input.discoveredIntent ?? null,
      region: input.region ?? "NSW",
      ip_hash: input.ipHash,
    } as never)
    .select("id")
    .single();
  if (enqErr || !enquiry) {
    throw new Error(`enquiry insert failed: ${(enqErr as { message?: string } | null)?.message ?? "unknown"}`);
  }
  const enquiryId = (enquiry as { id: string }).id;

  // 2. Deterministic estimate (price from the rate table, not the LLM).
  const est = await estimateFromQuery({ query: sanitized, region: input.region });
  const status: "complete" | "failed" = est.status === "parse_failed" ? "failed" : "complete";

  // 3. Persist the estimate.
  const { data: estimate, error: estErr } = await admin
    .from("marketplace_estimates" as never)
    .insert({
      enquiry_id: enquiryId,
      rate_source_type: est.rateSourceType,
      status,
      low_cents: est.lowCents,
      high_cents: est.highCents,
      currency: est.currency,
      line_items: est.lineItems,
      disclaimer: est.disclaimer,
      completed_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (estErr || !estimate) {
    throw new Error(`estimate insert failed: ${(estErr as { message?: string } | null)?.message ?? "unknown"}`);
  }
  const estimateId = (estimate as { id: string }).id;

  // 4. Opaque retrieval token (stored token + expiry, per the remediation pattern).
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
  const { error: tokErr } = await admin
    .from("marketplace_estimate_tokens" as never)
    .insert({ estimate_id: estimateId, token, expires_at: expiresAt } as never);
  if (tokErr) {
    throw new Error(`token insert failed: ${(tokErr as { message?: string }).message ?? "unknown"}`);
  }

  return { token, status: est.status };
}
