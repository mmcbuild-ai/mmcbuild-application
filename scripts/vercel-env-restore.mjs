#!/usr/bin/env node
// Restore env vars to Vercel for the currently-linked project.
// Reads .env.restore.local at project root; pushes each non-empty value
// to Production, Preview, and Development. Skips placeholder values
// (anything ending in "..." or empty/blank).
//
// Run from project root:
//   node scripts/vercel-env-restore.mjs            # dry-run
//   node scripts/vercel-env-restore.mjs --apply    # actually push
//
// After all keys land successfully, delete .env.restore.local.

import { readFileSync, existsSync } from "fs";
import { spawn } from "child_process";

const APPLY = process.argv.includes("--apply");
const f = ".env.restore.local";
if (!existsSync(f)) {
  console.error(`Missing ${f}. Copy from ${f}.example and fill in values.`);
  process.exit(1);
}

const entries = readFileSync(f, "utf8")
  .split("\n")
  .map(l => l.trim())
  .filter(l => l && !l.startsWith("#"))
  .map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  });

const ENVS = ["production", "preview", "development"];

function pushOne(key, value, env) {
  return new Promise((resolve) => {
    const args = ["env", "add", key, env];
    const p = spawn("vercel", args, { stdio: ["pipe", "pipe", "pipe"], shell: true });
    let out = "", err = "";
    p.stdout.on("data", d => out += d.toString());
    p.stderr.on("data", d => err += d.toString());
    p.on("close", code => resolve({ code, out, err }));
    p.stdin.write(value + "\n");
    p.stdin.end();
  });
}

const skipped = [], toApply = [];
for (const [key, value] of entries) {
  if (!key) continue;
  if (!value || value.endsWith("...") || value === "") {
    skipped.push(key);
    continue;
  }
  toApply.push([key, value]);
}

console.log(`Will push: ${toApply.map(([k]) => k).join(", ") || "(none)"}`);
if (skipped.length) console.log(`Skipped (placeholder/empty): ${skipped.join(", ")}`);

if (!APPLY) {
  console.log("\nDry-run. Re-run with --apply to push to Vercel.");
  process.exit(0);
}

for (const [key, value] of toApply) {
  for (const env of ENVS) {
    process.stdout.write(`  ${key} -> ${env}... `);
    const r = await pushOne(key, value, env);
    if (r.code === 0) {
      console.log("ok");
    } else if (/already exists/i.test(r.err) || /already exists/i.test(r.out)) {
      console.log("already exists (skipped)");
    } else {
      console.log(`FAILED (exit ${r.code})`);
      console.log("    stderr:", r.err.split("\n").slice(0, 3).join(" | "));
    }
  }
}

console.log("\nDone. Verify with: vercel env ls");
console.log("Then DELETE .env.restore.local (it contains plaintext secrets).");
