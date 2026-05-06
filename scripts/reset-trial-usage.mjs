#!/usr/bin/env node
/**
 * Admin tool: reset trial_usage_count on an organisation so Dennis can
 * keep testing /comply during the current debug session.
 *
 * Usage:
 *   node scripts/reset-trial-usage.mjs              # list orgs, pick Dennis's
 *   node scripts/reset-trial-usage.mjs <org-id>     # reset specific org
 *   node scripts/reset-trial-usage.mjs --all-mine   # reset every org owned by Dennis's auth user
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.method === "PATCH" ? "return=representation" : "return=minimal",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    console.error(`${path} → ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

const arg = process.argv[2];

if (!arg) {
  // List all orgs
  const orgs = await sb("organisations?select=id,name,trial_usage_count,trial_started_at,trial_ends_at&order=created_at.desc&limit=20");
  console.log("\nOrganisations (most recent 20):");
  console.log("id                                   | name                | usage | trial ends");
  console.log("-".repeat(100));
  for (const o of orgs) {
    console.log(
      `${o.id} | ${(o.name || "").padEnd(20).slice(0, 20)}| ${String(o.trial_usage_count ?? 0).padStart(5)} | ${o.trial_ends_at ?? "(none)"}`
    );
  }
  console.log("\nUsage: node scripts/reset-trial-usage.mjs <org-id>");
  process.exit(0);
}

const orgId = arg;
console.log(`\nBefore reset:`);
const before = await sb(`organisations?id=eq.${orgId}&select=id,name,trial_usage_count,trial_ends_at`);
if (!before?.length) {
  console.error(`Org ${orgId} not found`);
  process.exit(1);
}
console.log(`  ${before[0].name} (${before[0].id})`);
console.log(`  trial_usage_count: ${before[0].trial_usage_count}`);
console.log(`  trial_ends_at:     ${before[0].trial_ends_at}`);

// Reset usage to 0, and push trial_ends_at out 60 days if expired
const newTrialEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
const after = await sb(`organisations?id=eq.${orgId}`, {
  method: "PATCH",
  body: JSON.stringify({
    trial_usage_count: 0,
    trial_ends_at: newTrialEnd,
  }),
});

console.log(`\n✓ Reset complete`);
console.log(`  trial_usage_count: ${after?.[0]?.trial_usage_count ?? 0}`);
console.log(`  trial_ends_at:     ${after?.[0]?.trial_ends_at}\n`);
