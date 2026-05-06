#!/usr/bin/env node
/**
 * Mark SCRUM-148 (TC-BILL-003) as blocked pending Stripe setup.
 * Adds a visible comment + "blocked" label so Karen knows to skip.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

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
const HOST = process.env.JIRA_HOST;
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString("base64");

const api = (m, p, b = null) => new Promise((res) => {
  const d = b ? JSON.stringify(b) : null;
  const req = https.request({
    hostname: HOST, path: p, method: m,
    headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", ...(d ? { "Content-Length": Buffer.byteLength(d) } : {}) },
  }, (r) => {
    let raw = "";
    r.on("data", (c) => (raw += c));
    r.on("end", () => {
      if (r.statusCode >= 400) return res({ error: r.statusCode, body: raw.slice(0, 300) });
      try { res(raw ? JSON.parse(raw) : {}); } catch { res(raw); }
    });
  });
  req.on("error", (e) => res({ error: e.message }));
  if (d) req.write(d);
  req.end();
});

const text = (t) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const bold = (t) => ({ type: "paragraph", content: [{ type: "text", text: t, marks: [{ type: "strong" }] }] });
const doc = (blocks) => ({ type: "doc", version: 1, content: blocks });

async function main() {
  console.log("\nMarking SCRUM-148 blocked pending Stripe setup\n");

  // Add "blocked" label
  const issue = await api("GET", "/rest/api/3/issue/SCRUM-148?fields=labels");
  const currentLabels = issue?.fields?.labels || [];
  if (!currentLabels.includes("blocked")) {
    const newLabels = [...currentLabels, "blocked"];
    const r = await api("PUT", "/rest/api/3/issue/SCRUM-148", { fields: { labels: newLabels } });
    console.log(`  labels → added "blocked": ${r?.error ? "✗ " + r.error : "✓"}`);
  } else {
    console.log(`  labels → "blocked" already present`);
  }

  // Post prominent comment
  const c = await api("POST", "/rest/api/3/issue/SCRUM-148/comment", {
    body: doc([
      bold("⛔ BLOCKED — DO NOT START YET"),
      text("This test requires Stripe test-mode keys (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_BASIC_PRICE_ID, STRIPE_PROFESSIONAL_PRICE_ID) which are not yet configured in the Vercel production environment."),
      text("Dennis is setting up the Stripe sandbox. Once complete, this comment will be updated and the 'blocked' label removed to signal this test is ready."),
      bold("Karen — please skip this ticket for now. Work through the other 28 tests in Sprint 5. I will ping you directly when this one unblocks."),
      text("All other 28 tests in Sprint 5 are fully runnable and independent of this blocker."),
    ]),
  });
  console.log(`  comment → ${c?.error ? "✗ " + c.error : "✓"}`);

  console.log("\n  ✅ SCRUM-148 marked blocked\n");
}
main().catch(e => { console.error(e); process.exit(1); });
