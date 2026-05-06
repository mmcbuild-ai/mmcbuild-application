#!/usr/bin/env node
/**
 * MMC Build — Jira Targeted Cleanup
 *
 * Closes superseded issues and transitions completed ones to Done.
 * Based on manual review of the audit output on 2026-04-10.
 *
 * Usage:
 *   node scripts/jira-apply-cleanup.mjs
 *
 * Reads from .env.local: JIRA_HOST, JIRA_EMAIL, JIRA_TOKEN
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

// ── Load .env.local ──────────────────────────────────────────────────────
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    });
  console.log("  ✓ Loaded .env.local");
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;

if (!EMAIL || !TOKEN) {
  console.error("\n❌ Missing credentials in .env.local");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function api(method, path, body = null) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };

    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST,
      path,
      method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (method === "DELETE" && res.statusCode === 204) return done({ ok: true });
        if (res.statusCode >= 400) {
          console.error(`    ✗ ${method} ${res.statusCode}: ${raw.slice(0, 200)}`);
          return done(null);
        }
        try { done(raw ? JSON.parse(raw) : {}); } catch { done(null); }
      });
    });
    req.on("error", (e) => { console.error(`    ✗ error: ${e.message}`); done(null); });
    req.setTimeout(30000, () => { req.destroy(); console.error(`    ✗ timeout`); done(null); });
    if (data) req.write(data);
    req.end();
  });
}

// ── Find the "Done" transition ID for a given issue ──────────────────────
async function findDoneTransitionId(issueKey) {
  const data = await api("GET", `/rest/api/3/issue/${issueKey}/transitions`);
  if (!data?.transitions) return null;
  const done = data.transitions.find(
    (t) => t.name.toLowerCase() === "done" || t.to?.name?.toLowerCase() === "done"
  );
  return done?.id || null;
}

// ── Add a comment to an issue ────────────────────────────────────────────
async function addComment(issueKey, text) {
  return api("POST", `/rest/api/3/issue/${issueKey}/comment`, {
    body: {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  });
}

// ── Transition to Done ───────────────────────────────────────────────────
async function transitionToDone(issueKey, reason) {
  const transitionId = await findDoneTransitionId(issueKey);
  if (!transitionId) {
    console.log(`    ✗ ${issueKey}: no "Done" transition available`);
    return false;
  }
  await addComment(issueKey, `Closed by cleanup script: ${reason}`);
  const result = await api("POST", `/rest/api/3/issue/${issueKey}/transitions`, {
    transition: { id: transitionId },
  });
  return result !== null;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧹 MMC Build — Jira Targeted Cleanup");
  console.log(`   ${HOST}\n`);

  // ── 1. Close SCRUM-31 (superseded by SCRUM-60) ──
  console.log("1. SCRUM-31 — Implement correct Figma colours/fonts");
  console.log("   Superseded by SCRUM-60 (Karen, In Progress)");
  const r1 = await transitionToDone("SCRUM-31", "Superseded by SCRUM-60 — Karen's Figma mockups task (In Progress)");
  console.log(`   ${r1 ? "✓ Closed" : "✗ Failed"}`);

  // ── 2. Close SCRUM-32 (superseded by SCRUM-79) ──
  console.log("\n2. SCRUM-32 — AusIndustry R&D registration FY2025/26");
  console.log("   Superseded by SCRUM-79 (Karen, In Review)");
  const r2 = await transitionToDone("SCRUM-32", "Superseded by SCRUM-79 — Karen's R&D registration task (In Review)");
  console.log(`   ${r2 ? "✓ Closed" : "✗ Failed"}`);

  // ── 3. Transition SCRUM-71 to Done (Confluence setup complete) ──
  console.log("\n3. SCRUM-71 — Set up Confluence QA space and grant team access");
  console.log("   Completed today — Confluence MB space created with 5 pages");
  const r3 = await transitionToDone("SCRUM-71", "Completed 2026-04-10 — Confluence MB space created with Sprint Status, Meeting Notes, UAT Test Results, R&D Evidence Log, Architecture Overview pages");
  console.log(`   ${r3 ? "✓ Done" : "✗ Failed"}`);

  // ── Summary ──
  const success = [r1, r2, r3].filter(Boolean).length;
  console.log("\n" + "═".repeat(50));
  console.log(`  ✅ Cleanup complete: ${success}/3 issues updated`);
  console.log("═".repeat(50));
  console.log(`\n  Board: https://${HOST}/jira/software/projects/SCRUM/boards/1\n`);

  // ── Reminders ──
  console.log("  Still needs your input:");
  console.log("  - SCRUM-68: GitHub repo consolidation — still relevant?");
  console.log("  - SCRUM-74: Review and triage Karen backlog items — done?");
}

main().catch((e) => {
  console.error("❌ ", e.message);
  process.exit(1);
});
