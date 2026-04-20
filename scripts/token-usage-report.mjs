#!/usr/bin/env node
/**
 * SCRUM-73 — Token Usage Report
 *
 * Queries ai_usage_log via Supabase and produces a per-run token/cost summary
 * suitable for pricing model validation. Computes cost fresh from per-1M pricing
 * (bypasses the per-1k registry bug tracked in SCRUM-121).
 *
 * Usage:
 *   node scripts/token-usage-report.mjs                # last 20 check_ids
 *   node scripts/token-usage-report.mjs --since 24h    # last 24 hours
 *   node scripts/token-usage-report.mjs --check <id>   # specific check
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Correct per-1M pricing (as of Jan 2026). Drop-in replacement for the
// registry values until SCRUM-121 is fixed.
const PRICING_PER_M = {
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-4.5": { input: 1, output: 5 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "bge-reranker-v2-m3": { input: 0, output: 0 },
};

function costFor(modelId, inputTokens, outputTokens) {
  const p = PRICING_PER_M[modelId];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

async function sbQuery(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.error(`Supabase ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { since: null, check: null, limit: 20 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since") out.since = args[++i];
    else if (args[i] === "--check") out.check = args[++i];
    else if (args[i] === "--limit") out.limit = parseInt(args[++i], 10);
  }
  return out;
}

function sinceToIso(since) {
  if (!since) return null;
  const m = since.match(/^(\d+)([hd])$/);
  if (!m) return null;
  const amount = parseInt(m[1], 10);
  const unit = m[2];
  const ms = unit === "h" ? amount * 3_600_000 : amount * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

async function main() {
  const args = parseArgs();

  let filter = "select=*&order=created_at.desc";
  if (args.check) {
    filter += `&check_id=eq.${args.check}`;
  } else if (args.since) {
    const iso = sinceToIso(args.since);
    if (!iso) {
      console.error("Invalid --since format. Use e.g. 24h or 7d");
      process.exit(1);
    }
    filter += `&created_at=gte.${iso}`;
  } else {
    // Last N distinct check_ids
    filter += `&limit=500`;
  }

  const rows = await sbQuery(`ai_usage_log?${filter}`);
  if (rows.length === 0) {
    console.log("No ai_usage_log rows match. Run some compliance/build/quote flows first.");
    return;
  }

  // Group by check_id
  const byCheck = new Map();
  for (const r of rows) {
    const key = r.check_id ?? "no-check";
    if (!byCheck.has(key)) byCheck.set(key, []);
    byCheck.get(key).push(r);
  }

  // If no --check flag, trim to the N most recent check_ids
  let checkIds = [...byCheck.keys()];
  if (!args.check && !args.since) {
    const sorted = checkIds
      .map((k) => ({
        k,
        latest: Math.max(...byCheck.get(k).map((r) => new Date(r.created_at).getTime())),
      }))
      .sort((a, b) => b.latest - a.latest)
      .slice(0, args.limit);
    checkIds = sorted.map((x) => x.k);
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  let totalCacheWriteTokens = 0;
  let totalCacheReadTokens = 0;

  const runSummaries = [];

  for (const checkId of checkIds) {
    const calls = byCheck.get(checkId);
    let input = 0;
    let output = 0;
    let cost = 0;
    let cacheWrite = 0;
    let cacheRead = 0;
    const byFn = {};

    for (const c of calls) {
      input += c.input_tokens ?? 0;
      output += c.output_tokens ?? 0;
      cost += costFor(c.model_id, c.input_tokens ?? 0, c.output_tokens ?? 0);
      cacheWrite += c.cache_creation_tokens ?? 0; // will be 0 until schema adds column
      cacheRead += c.cache_read_tokens ?? 0;
      const fn = c.ai_function || "unknown";
      byFn[fn] = (byFn[fn] ?? 0) + 1;
    }

    runSummaries.push({
      checkId,
      calls: calls.length,
      input,
      output,
      cost,
      cacheWrite,
      cacheRead,
      byFn,
      earliest: calls.reduce(
        (a, b) => (new Date(a).getTime() < new Date(b.created_at).getTime() ? a : b.created_at),
        calls[0].created_at
      ),
    });

    totalInputTokens += input;
    totalOutputTokens += output;
    totalCost += cost;
    totalCacheWriteTokens += cacheWrite;
    totalCacheReadTokens += cacheRead;
  }

  // Print
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SCRUM-73 — Token Usage Report");
  console.log("═══════════════════════════════════════════════════════════════\n");
  console.log(`Runs analysed: ${runSummaries.length}`);
  console.log(`Total input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`Total output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`Total cost (recalculated, per-1M pricing): $${totalCost.toFixed(4)}`);
  if (totalCacheWriteTokens + totalCacheReadTokens > 0) {
    console.log(`Cache write tokens: ${totalCacheWriteTokens.toLocaleString()}`);
    console.log(`Cache read tokens: ${totalCacheReadTokens.toLocaleString()}`);
  }

  console.log("\n─── Per-run breakdown ──────────────────────────────────────\n");
  for (const r of runSummaries) {
    console.log(`check_id: ${r.checkId}`);
    console.log(`  ${r.calls} calls | input ${r.input.toLocaleString()} | output ${r.output.toLocaleString()} | cost $${r.cost.toFixed(4)}`);
    console.log(`  ai_functions: ${Object.entries(r.byFn).map(([k, v]) => `${k}×${v}`).join(", ")}`);
  }

  // Pricing projection
  const avgCostPerRun = totalCost / Math.max(runSummaries.length, 1);
  console.log("\n─── Pricing projection ─────────────────────────────────────\n");
  console.log(`Average cost per run: $${avgCostPerRun.toFixed(4)}`);
  console.log(`10 runs/month (Basic at $149): cost $${(avgCostPerRun * 10).toFixed(2)}, margin $${(149 - avgCostPerRun * 10).toFixed(2)} (${(((149 - avgCostPerRun * 10) / 149) * 100).toFixed(1)}%)`);
  console.log(`30 runs/month (Pro at $399): cost $${(avgCostPerRun * 30).toFixed(2)}, margin $${(399 - avgCostPerRun * 30).toFixed(2)} (${(((399 - avgCostPerRun * 30) / 399) * 100).toFixed(1)}%)`);
  console.log(`50 runs/month (stress test): cost $${(avgCostPerRun * 50).toFixed(2)}`);

  // Save markdown report
  const outDir = join(process.cwd(), "test-results");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, "token-usage-summary.md");

  const md = `# Token Usage Summary — SCRUM-73

**Generated:** ${new Date().toISOString()}
**Runs analysed:** ${runSummaries.length}
**Source:** ai_usage_log (cost recalculated using correct per-1M pricing; see SCRUM-121)

## Totals

| Metric | Value |
|--------|-------|
| Input tokens | ${totalInputTokens.toLocaleString()} |
| Output tokens | ${totalOutputTokens.toLocaleString()} |
| Cost (USD) | $${totalCost.toFixed(4)} |
| Avg cost per run | $${avgCostPerRun.toFixed(4)} |
${totalCacheWriteTokens + totalCacheReadTokens > 0 ? `| Cache write tokens | ${totalCacheWriteTokens.toLocaleString()} |\n| Cache read tokens | ${totalCacheReadTokens.toLocaleString()} |\n` : ""}

## Per-run breakdown

| check_id | Calls | Input | Output | Cost |
|----------|-------|-------|--------|------|
${runSummaries.map((r) => `| ${r.checkId} | ${r.calls} | ${r.input.toLocaleString()} | ${r.output.toLocaleString()} | $${r.cost.toFixed(4)} |`).join("\n")}

## Pricing projection

| Tier | Runs/mo | Projected cost | Revenue | Margin | Margin % |
|------|---------|----------------|---------|--------|----------|
| Basic | 10 | $${(avgCostPerRun * 10).toFixed(2)} | $149 | $${(149 - avgCostPerRun * 10).toFixed(2)} | ${(((149 - avgCostPerRun * 10) / 149) * 100).toFixed(1)}% |
| Professional | 30 | $${(avgCostPerRun * 30).toFixed(2)} | $399 | $${(399 - avgCostPerRun * 30).toFixed(2)} | ${(((399 - avgCostPerRun * 30) / 399) * 100).toFixed(1)}% |
| Stress (50) | 50 | $${(avgCostPerRun * 50).toFixed(2)} | — | — | — |

## Notes

- Cost figures recomputed from raw input/output tokens. The \`estimated_cost_usd\` column in \`ai_usage_log\` is currently inflated by 1000× due to the registry unit bug (SCRUM-121).
- Cache read/write columns will populate once the schema adds \`cache_creation_tokens\` and \`cache_read_tokens\` columns. Until then, cache metrics are console-logged per call and can be tailed from Inngest logs.
`;

  writeFileSync(mdPath, md);
  console.log(`\n✓ Summary written to ${mdPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
