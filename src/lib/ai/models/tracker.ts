/**
 * AI Usage Tracker — logs every AI call to ai_usage_log for cost monitoring.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface UsageRecord {
  orgId?: string;
  checkId?: string;
  aiFunction: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  estimatedCostUsd: number;
  latencyMs: number;
  wasFallback: boolean;
  errorMessage?: string;
}

/**
 * Log an AI usage record. Non-blocking — callers should .catch() errors.
 */
export async function trackUsage(record: UsageRecord): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("ai_usage_log").insert({
      org_id: record.orgId ?? null,
      check_id: record.checkId ?? null,
      ai_function: record.aiFunction,
      model_id: record.modelId,
      provider: record.provider,
      input_tokens: record.inputTokens,
      output_tokens: record.outputTokens,
      cache_creation_tokens: record.cacheCreationTokens ?? 0,
      cache_read_tokens: record.cacheReadTokens ?? 0,
      estimated_cost_usd: record.estimatedCostUsd,
      latency_ms: record.latencyMs,
      was_fallback: record.wasFallback,
      error_message: record.errorMessage ?? null,
    } as never);
  } catch (err) {
    console.error("[Tracker] Failed to log AI usage:", err);
  }
}
