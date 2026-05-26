#!/usr/bin/env node
/**
 * setup-stripe-products.mjs
 *
 * Idempotently create the 5 MMC module products + monthly AUD prices in Stripe,
 * and print the price IDs in env-var form for the mmcbuild-application project.
 *
 * Prices/names MUST match src/lib/stripe/plans.ts:
 *   Comply A$99 · Build A$79 · Quote A$99 · Direct A$49 · Train A$49 (all /month, AUD)
 *
 * Usage (test mode for MVP):
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe-products.mjs
 *
 * Re-runnable: matches existing products by metadata.mmc_module and reuses a
 * matching active price instead of creating duplicates. Safe to run again.
 */
import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error(
    "Missing STRIPE_SECRET_KEY.\n" +
      "Run: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs"
  );
  process.exit(1);
}

const stripe = new Stripe(KEY);
const live = KEY.startsWith("sk_live_");
const CURRENCY = "aud";

// Must match src/lib/stripe/plans.ts
const MODULES = [
  { id: "comply", name: "MMC Comply", price: 99, env: "STRIPE_COMPLY_PRICE_ID" },
  { id: "build", name: "MMC Build", price: 79, env: "STRIPE_BUILD_PRICE_ID" },
  { id: "quote", name: "MMC Quote", price: 99, env: "STRIPE_QUOTE_PRICE_ID" },
  { id: "direct", name: "MMC Direct", price: 49, env: "STRIPE_DIRECT_PRICE_ID" },
  { id: "train", name: "MMC Train", price: 49, env: "STRIPE_TRAIN_PRICE_ID" },
];

async function findProduct(moduleId) {
  for await (const p of stripe.products.list({ active: true, limit: 100 })) {
    if (p.metadata?.mmc_module === moduleId) return p;
  }
  return null;
}

async function findPrice(productId, amountCents) {
  for await (const pr of stripe.prices.list({ product: productId, active: true, limit: 100 })) {
    if (
      pr.unit_amount === amountCents &&
      pr.currency === CURRENCY &&
      pr.recurring?.interval === "month"
    ) {
      return pr;
    }
  }
  return null;
}

async function main() {
  console.log(`Stripe mode: ${live ? "LIVE ⚠️" : "TEST"}\n`);
  const out = [];

  for (const m of MODULES) {
    const amount = m.price * 100;

    let product = await findProduct(m.id);
    if (product) {
      console.log(`= product exists  ${m.name}  (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: m.name,
        metadata: { mmc_module: m.id },
      });
      console.log(`+ created product ${m.name}  (${product.id})`);
    }

    let price = await findPrice(product.id, amount);
    if (price) {
      console.log(`  = price exists  A$${m.price}/mo  (${price.id})`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: amount,
        currency: CURRENCY,
        recurring: { interval: "month" },
        metadata: { mmc_module: m.id },
      });
      console.log(`  + created price A$${m.price}/mo  (${price.id})`);
    }

    out.push(`${m.env}=${price.id}`);
  }

  console.log(
    "\n--- paste these into mmcbuild-application Vercel (Production + Preview) ---\n"
  );
  console.log(out.join("\n"));
  console.log("");
}

main().catch((e) => {
  console.error("Stripe setup failed:", e.message);
  process.exit(1);
});
