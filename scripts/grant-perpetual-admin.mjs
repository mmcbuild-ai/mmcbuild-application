#!/usr/bin/env node
/**
 * Grant a user perpetual admin access:
 *   - profiles.role = 'owner' on their org
 *   - organisations.subscription_tier = 'enterprise'
 *   - trial_usage_count reset to 0, trial_ends_at pushed 100 years out
 *   - synthetic active enterprise subscription row with far-future period_end
 *     (idempotent — re-runs upsert the same synthetic stripe_subscription_id)
 *
 * Dry-run by default. Pass --confirm to apply.
 *
 * Usage:
 *   node scripts/grant-perpetual-admin.mjs <email>            # dry run
 *   node scripts/grant-perpetual-admin.mjs <email> --confirm  # apply
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

const email = process.argv[2];
const confirm = process.argv.includes("--confirm");
if (!email) {
  console.error("Usage: node scripts/grant-perpetual-admin.mjs <email> [--confirm]");
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} -> ${res.status}: ${body}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

const rest = (path, opts = {}) =>
  api(`/rest/v1/${path}`, {
    ...opts,
    headers: {
      Prefer: opts.method === "PATCH" || opts.method === "POST"
        ? "return=representation"
        : "return=minimal",
      ...(opts.headers || {}),
    },
  });

// 1. Find auth user by email (admin API)
const authUsers = await api(`/auth/v1/admin/users?per_page=200`);
const user = (authUsers?.users || []).find(
  (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
);
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}
console.log(`Auth user:  ${user.id}  ${user.email}`);

// 2. Find profile → org
const profiles = await rest(`profiles?user_id=eq.${user.id}&select=id,user_id,org_id,role,full_name`);
if (!profiles?.length) {
  console.error(`No profile row for user ${user.id}`);
  process.exit(1);
}
const profile = profiles[0];
console.log(`Profile:    ${profile.id}  role=${profile.role}  name=${profile.full_name ?? "(null)"}`);
console.log(`Org:        ${profile.org_id}`);

const orgs = await rest(
  `organisations?id=eq.${profile.org_id}&select=id,name,subscription_tier,trial_usage_count,trial_ends_at,stripe_customer_id`,
);
const org = orgs[0];
console.log(
  `            name="${org.name}" tier=${org.subscription_tier} usage=${org.trial_usage_count} trial_ends_at=${org.trial_ends_at}`,
);

const existingSubs = await rest(
  `subscriptions?org_id=eq.${org.id}&select=id,stripe_subscription_id,plan_id,status,current_period_end,usage_count,usage_limit&order=created_at.desc`,
);
console.log(`Existing subscriptions: ${existingSubs.length}`);
for (const s of existingSubs) {
  console.log(
    `  - ${s.stripe_subscription_id}  plan=${s.plan_id} status=${s.status} end=${s.current_period_end} usage=${s.usage_count}/${s.usage_limit}`,
  );
}

// Planned changes
const syntheticSubId = `perpetual_admin_${org.id}`;
const farFuture = new Date("2099-12-31T00:00:00Z").toISOString();
const trialEnd100y = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

console.log("\nPlanned changes:");
console.log(`  profiles.role                     -> owner  (was: ${profile.role})`);
console.log(`  organisations.subscription_tier   -> enterprise`);
console.log(`  organisations.trial_usage_count   -> 0`);
console.log(`  organisations.trial_ends_at       -> ${trialEnd100y}`);
console.log(`  subscriptions (upsert synthetic)  -> ${syntheticSubId}`);
console.log(`    plan_id=enterprise status=active current_period_end=${farFuture}`);
console.log(`    usage_count=0 usage_limit=999999`);

if (!confirm) {
  console.log("\nDry run. Re-run with --confirm to apply.");
  process.exit(0);
}

// 3. Apply — profile
await rest(`profiles?id=eq.${profile.id}`, {
  method: "PATCH",
  body: JSON.stringify({ role: "owner" }),
});
console.log("✓ profiles.role = owner");

// 4. Apply — org
await rest(`organisations?id=eq.${org.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    subscription_tier: "enterprise",
    trial_usage_count: 0,
    trial_ends_at: trialEnd100y,
  }),
});
console.log("✓ organisations updated (enterprise tier, trial extended, usage reset)");

// 5. Apply — subscription upsert
// Use the synthetic stripe_subscription_id as the unique key (UNIQUE constraint on column).
const stripeCustomerId = org.stripe_customer_id || `perpetual_admin_cust_${org.id}`;
const subBody = {
  org_id: org.id,
  stripe_subscription_id: syntheticSubId,
  stripe_customer_id: stripeCustomerId,
  plan_id: "enterprise",
  status: "active",
  current_period_start: new Date().toISOString(),
  current_period_end: farFuture,
  cancel_at_period_end: false,
  usage_count: 0,
  usage_limit: 999999,
};
await rest(`subscriptions?on_conflict=stripe_subscription_id`, {
  method: "POST",
  body: JSON.stringify(subBody),
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
});
console.log("✓ subscription upserted (active enterprise, period_end=2099-12-31)");

console.log(`\nDone. ${email} now has perpetual admin access to org "${org.name}".`);
