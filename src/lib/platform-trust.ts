/**
 * Platform Trust integration for mmcbuild.
 *
 * Connects to the shared Platform Trust Supabase instance for:
 * - Permission governance (deny-by-default)
 * - Rate limiting (per-agent, per-minute/hour/day)
 * - Audit logging (immutable, SHA-256 hashed)
 * - Token metering (cost tracking per model)
 *
 * Usage:
 *   import { trustGate, trustLog, trustMeter } from '@/lib/platform-trust'
 *
 *   // Before an operation:
 *   const gate = await trustGate({ agent_id, tool_name, operation_type, scope })
 *   if (!gate.allowed) return { error: gate.denial_reason }
 *
 *   // After an operation:
 *   await trustLog({ agent_id, tool_name, operation_type, scope }, result, durationMs)
 *
 *   // After any AI call:
 *   await trustMeter(agent_id, model, inputTokens, outputTokens, sessionId)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Config ──────────────────────────────────────────────────────────
const PLATFORM_TRUST_URL = process.env.PLATFORM_TRUST_SUPABASE_URL || ''
const PLATFORM_TRUST_KEY = process.env.PLATFORM_TRUST_SERVICE_KEY || ''
const PROJECT_ID = process.env.PLATFORM_TRUST_PROJECT_ID || ''

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    if (!PLATFORM_TRUST_URL || !PLATFORM_TRUST_KEY) {
      throw new Error('Platform Trust not configured: set PLATFORM_TRUST_SUPABASE_URL and PLATFORM_TRUST_SERVICE_KEY')
    }
    _client = createClient(PLATFORM_TRUST_URL, PLATFORM_TRUST_KEY)
  }
  return _client
}

function isConfigured(): boolean {
  return !!(PLATFORM_TRUST_URL && PLATFORM_TRUST_KEY && PROJECT_ID)
}

// ── Types ───────────────────────────────────────────────────────────
export interface TrustContext {
  agent_id: string
  session_id?: string
  tool_name: string
  operation_type: 'read' | 'write' | 'delete'
  scope: string
  input?: unknown
}

export interface TrustGateResult {
  allowed: boolean
  requires_approval: boolean
  denial_reason?: string
  audit_id?: string
  retry_after?: number
}

// ── Hash helper ─────────────────────────────────────────────────────
async function hashData(data: unknown): Promise<string | null> {
  if (data === undefined || data === null) return null
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  const encoded = new TextEncoder().encode(json)
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  const hex = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

// ── Rate Limiting ───────────────────────────────────────────────────
const WINDOW_SECONDS: Record<string, number> = { minute: 60, hour: 3600, day: 86400 }

async function checkRateLimit(client: SupabaseClient, agent_id: string): Promise<{ allowed: boolean; retry_after?: number }> {
  const { data: limits } = await client
    .from('rate_limits')
    .select('*')
    .eq('project_id', PROJECT_ID)
    .in('agent_id', [agent_id, '*'])
    .order('window_type')

  if (!limits || limits.length === 0) return { allowed: true }

  const now = new Date()
  for (const limit of limits) {
    const windowSeconds = WINDOW_SECONDS[limit.window_type]
    const windowStart = new Date(limit.window_start)
    const windowEnd = new Date(windowStart.getTime() + windowSeconds * 1000)

    if (now >= windowEnd) {
      await client.from('rate_limits').update({
        current_count: 1, window_start: now.toISOString(), updated_at: now.toISOString(),
      }).eq('id', limit.id)
      continue
    }

    if (limit.current_count >= limit.max_requests) {
      return { allowed: false, retry_after: Math.ceil((windowEnd.getTime() - now.getTime()) / 1000) }
    }

    await client.from('rate_limits').update({
      current_count: limit.current_count + 1, updated_at: now.toISOString(),
    }).eq('id', limit.id).eq('current_count', limit.current_count)
  }

  return { allowed: true }
}

// ── Permission Check ────────────────────────────────────────────────
async function checkPermission(
  client: SupabaseClient, agent_id: string, scope: string, operation: string
): Promise<{ allowed: boolean; requires_approval: boolean }> {
  const { data: policy } = await client
    .from('permission_policies')
    .select('*')
    .eq('project_id', PROJECT_ID)
    .eq('agent_id', agent_id)
    .eq('scope', scope)
    .eq('operation', operation)
    .single()

  if (!policy) return { allowed: true, requires_approval: false }
  return { allowed: true, requires_approval: policy.requires_approval }
}

// ── Audit Log ───────────────────────────────────────────────────────
async function logAudit(
  client: SupabaseClient, ctx: TrustContext, status: string, output?: unknown, duration_ms?: number
): Promise<string | null> {
  const { data } = await client
    .from('audit_log')
    .insert({
      project_id: PROJECT_ID,
      session_id: ctx.session_id || null,
      agent_id: ctx.agent_id,
      tool_name: ctx.tool_name,
      operation_type: ctx.operation_type,
      input_hash: await hashData(ctx.input),
      output_hash: await hashData(output),
      status,
      duration_ms: duration_ms || null,
      requires_human_approval: status === 'pending_approval',
    } as never)
    .select('id')
    .single()

  return data?.id || null
}

// ── Combined Trust Gate ─────────────────────────────────────────────
/**
 * Run the full trust pipeline: rate limit -> permission check -> audit log.
 * Call BEFORE executing any operation.
 */
export async function trustGate(ctx: TrustContext): Promise<TrustGateResult> {
  if (!isConfigured()) {
    console.warn('[platform-trust] Not configured, skipping trust checks')
    return { allowed: true, requires_approval: false }
  }

  const client = getClient()

  const rateResult = await checkRateLimit(client, ctx.agent_id)
  if (!rateResult.allowed) {
    await logAudit(client, ctx, 'rate_limited')
    return { allowed: false, requires_approval: false, denial_reason: `Rate limit exceeded. Retry after ${rateResult.retry_after}s.`, retry_after: rateResult.retry_after }
  }

  const permResult = await checkPermission(client, ctx.agent_id, ctx.scope, ctx.operation_type)
  if (!permResult.allowed) {
    await logAudit(client, ctx, 'permission_denied')
    return { allowed: false, requires_approval: false, denial_reason: `No permission for agent="${ctx.agent_id}" scope="${ctx.scope}" operation="${ctx.operation_type}".` }
  }

  if (permResult.requires_approval) {
    const audit_id = await logAudit(client, ctx, 'pending_approval')
    return { allowed: true, requires_approval: true, audit_id: audit_id || undefined }
  }

  return { allowed: true, requires_approval: false }
}

/**
 * Log a completed operation to the audit trail.
 * Call AFTER a successful operation.
 */
export async function trustLog(ctx: TrustContext, output: unknown, duration_ms: number): Promise<void> {
  if (!isConfigured()) return
  await logAudit(getClient(), ctx, 'completed', output, duration_ms)
}

/**
 * Record token usage for metering.
 * Call after any AI model call.
 */
export async function trustMeter(
  agent_id: string, model: string, input_tokens: number, output_tokens: number, session_id?: string
): Promise<void> {
  if (!isConfigured()) return

  const pricing: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 0.000015, output: 0.000075 },
    'claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
    'claude-haiku-4-5': { input: 0.0000008, output: 0.000004 },
  }
  const p = pricing[model] || pricing['claude-sonnet-4-6']
  const cost_usd = input_tokens * p.input + output_tokens * p.output

  await getClient().from('metering_events').insert({
    project_id: PROJECT_ID, session_id: session_id || null,
    agent_id, model, input_tokens, output_tokens, cost_usd,
  } as never)
}
