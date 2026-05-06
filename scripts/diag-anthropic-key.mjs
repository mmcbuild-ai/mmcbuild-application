#!/usr/bin/env node
/**
 * Diagnose ANTHROPIC_API_KEY state without exposing the secret.
 * Reads from .env.local, redacts the value, attempts a minimal API probe.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const key = process.env.ANTHROPIC_API_KEY;

console.log("\n═════ ANTHROPIC_API_KEY diagnostic ═════\n");

if (!key) {
  console.log("✗ ANTHROPIC_API_KEY is UNSET in .env.local");
  console.log("  Fix: add ANTHROPIC_API_KEY=sk-ant-api03-... to .env.local");
  process.exit(1);
}

console.log(`Key present?         Yes`);
console.log(`Length:              ${key.length} chars`);
console.log(`Starts with:         "${key.slice(0, 11)}..."`);
console.log(`Ends with:           "...${key.slice(-4)}"`);
console.log(`Expected prefix:     sk-ant-api03-  (newer keys; sk-ant-api01-/02- also valid)`);
console.log(`Has whitespace?      ${/\s/.test(key) ? "⚠️  YES — strip spaces/newlines" : "no"}`);
console.log(`Has quotes?          ${/^["']|["']$/.test(key) ? "⚠️  YES — strip quotes" : "no"}`);
console.log(`All ASCII?           ${/^[\x20-\x7E]+$/.test(key) ? "yes" : "⚠️  NO — non-ASCII char"}`);

// Minimal probe: models list requires any valid key, zero tokens consumed
console.log("\nProbing https://api.anthropic.com/v1/models ...");
const result = await new Promise((resolve) => {
  const req = https.request({
    hostname: "api.anthropic.com",
    path: "/v1/models",
    method: "GET",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
  }, (res) => {
    let raw = "";
    res.on("data", (c) => (raw += c));
    res.on("end", () => resolve({ status: res.statusCode, body: raw.slice(0, 400) }));
  });
  req.on("error", (e) => resolve({ status: 0, body: e.message }));
  req.end();
});

console.log(`Response:            ${result.status}`);
if (result.status === 200) {
  console.log(`Verdict:             ✅ Key is valid on the Anthropic API`);
  console.log(`Implication:         If /comply still 401s, the production env (Vercel) has a different key.`);
} else if (result.status === 401) {
  console.log(`Verdict:             ❌ Anthropic rejected this key`);
  console.log(`Body:                ${result.body}`);
  console.log(`\nLikely causes:`);
  console.log(`  1. Key rotated in Anthropic console — old value in .env.local`);
  console.log(`  2. Key never valid — typo on paste`);
  console.log(`  3. Org disabled / billing unpaid`);
  console.log(`\nFix: go to https://console.anthropic.com/settings/keys`);
  console.log(`     generate a new key, replace ANTHROPIC_API_KEY in .env.local`);
  console.log(`     if deploying to Vercel, also update it at`);
  console.log(`     https://vercel.com/<team>/mmcbuild/settings/environment-variables`);
} else {
  console.log(`Verdict:             ⚠️  Unexpected status`);
  console.log(`Body:                ${result.body}`);
}
