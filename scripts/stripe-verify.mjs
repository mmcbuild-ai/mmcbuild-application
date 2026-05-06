#!/usr/bin/env node
/**
 * Verify Stripe env vars + test mode + active price IDs for TC-BILL-003.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Stripe from "stripe";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...r] = line.split("=");
    if (k && r.length && !process.env[k.trim()]) {
      let v = r.join("=").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[k.trim()] = v;
    }
  });
}

const REQUIRED = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_BASIC_PRICE_ID",
  "STRIPE_PROFESSIONAL_PRICE_ID",
];

console.log(`\nStripe verification for TC-BILL-003\n${"=".repeat(50)}\n`);

let allOk = true;
for (const v of REQUIRED) {
  const val = process.env[v];
  if (!val) { console.log(`  ✗ ${v} — NOT SET`); allOk = false; continue; }
  const preview = v.includes("SECRET") || v.includes("WEBHOOK") ? `${val.slice(0, 8)}…${val.slice(-4)}` : val;
  console.log(`  ✓ ${v} = ${preview}`);
}

const sk = process.env.STRIPE_SECRET_KEY;
if (sk) {
  const mode = sk.startsWith("sk_test_") ? "TEST" : sk.startsWith("sk_live_") ? "LIVE ⚠️" : "UNKNOWN";
  console.log(`\n  Stripe mode: ${mode}`);
  if (mode === "LIVE ⚠️") { console.log("  ⚠️  LIVE KEY detected — TC-BILL-003 should use test mode, not live!"); allOk = false; }
}

if (!allOk) { console.log("\n  ✗ Setup incomplete\n"); process.exit(1); }

// Verify the price IDs actually exist in this Stripe account
const stripe = new Stripe(sk, { apiVersion: "2025-09-30.clover" });

try {
  const basic = await stripe.prices.retrieve(process.env.STRIPE_BASIC_PRICE_ID);
  console.log(`\n  ✓ BASIC price: ${basic.currency.toUpperCase()} ${(basic.unit_amount / 100).toFixed(2)} / ${basic.recurring?.interval ?? "one-time"} (active=${basic.active})`);
} catch (e) {
  console.log(`  ✗ BASIC price retrieval failed: ${e.message}`);
  allOk = false;
}

try {
  const pro = await stripe.prices.retrieve(process.env.STRIPE_PROFESSIONAL_PRICE_ID);
  console.log(`  ✓ PROFESSIONAL price: ${pro.currency.toUpperCase()} ${(pro.unit_amount / 100).toFixed(2)} / ${pro.recurring?.interval ?? "one-time"} (active=${pro.active})`);
} catch (e) {
  console.log(`  ✗ PROFESSIONAL price retrieval failed: ${e.message}`);
  allOk = false;
}

if (!allOk) {
  console.log("\n  ✗ Price verification failed — TC-BILL-003 will not work\n");
  process.exit(1);
}

console.log(`\n  ✅ Stripe ready for TC-BILL-003`);
console.log(`\n  Karen's test card for the flow:`);
console.log(`    Number:  4242 4242 4242 4242`);
console.log(`    Expiry:  any future date (e.g., 12/29)`);
console.log(`    CVC:     any 3 digits (e.g., 123)`);
console.log(`    ZIP:     any 5 digits (e.g., 2000)\n`);
