#!/usr/bin/env node
/**
 * MMC Build — Jira Audit & Cleanup
 *
 * Pulls all SCRUM issues, identifies duplicates / superseded / stale tasks,
 * prints a cleanup plan, then executes after confirmation.
 *
 * Usage:
 *   node scripts/jira-audit-cleanup.mjs            # dry-run (audit only)
 *   node scripts/jira-audit-cleanup.mjs --execute   # apply cleanup
 *
 * Reads from .env.local:
 *   JIRA_HOST, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
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
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;

if (!EMAIL || !TOKEN) {
  console.error("\n❌ Missing Jira credentials in .env.local");
  if (!EMAIL) console.error("   Add: JIRA_EMAIL=dennis@corporateaisolutions.com");
  if (!TOKEN) console.error("   Add: JIRA_TOKEN=your_api_token");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const EXECUTE = process.argv.includes("--execute");

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
          console.error(`  ✗ ${method} ${res.statusCode}: ${raw.slice(0, 200)}`);
          return done(null);
        }
        try { done(raw ? JSON.parse(raw) : {}); } catch { done(null); }
      });
    });
    req.on("error", (e) => {
      console.error(`  ✗ ${method} error: ${e.message}`);
      done(null);
    });
    req.setTimeout(30000, () => { req.destroy(); console.error(`  ✗ ${method} timeout (30s)`); done(null); });
    if (data) req.write(data);
    req.end();
  });
}

// ── Fetch all issues (via agile board endpoint — reliable pagination) ────
async function fetchAllIssues() {
  // First find the board ID
  const boards = await api("GET", `/rest/agile/1.0/board?projectKeyOrId=${PROJECT_KEY}`);
  const boardId = boards?.values?.[0]?.id;
  if (!boardId) {
    console.error("  ✗ No board found");
    return [];
  }
  console.log(`    Board ID: ${boardId}`);

  const issues = [];
  let startAt = 0;
  const maxResults = 50;
  while (true) {
    const data = await api(
      "GET",
      `/rest/agile/1.0/board/${boardId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=summary,status,issuetype,parent,labels,assignee,created,updated,resolution`
    );
    if (!data?.issues?.length) break;
    issues.push(...data.issues);
    console.log(`    ...fetched ${issues.length} / ${data.total}`);
    if (issues.length >= data.total) break;
    startAt += maxResults;
  }
  return issues;
}

// ── Duplicate detection ──────────────────────────────────────────────────
function normalise(summary) {
  return summary
    .replace(/^\[(S\d+-\w+|DONE|BLOCKED|PHASE \d+)\]\s*/i, "")
    .replace(/[—–-]\s*(shared state|immutable|enforce|admin|sync|correct|confirm|deliver|test|progress|generate).*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function findDuplicates(issues) {
  const groups = {};
  for (const issue of issues) {
    const norm = normalise(issue.fields.summary);
    if (!groups[norm]) groups[norm] = [];
    groups[norm].push(issue);
  }
  const dupes = [];
  for (const [norm, group] of Object.entries(groups)) {
    if (group.length > 1) {
      // Keep the newest (highest key number), flag the rest
      const sorted = group.sort((a, b) => {
        const aNum = parseInt(a.key.split("-")[1]);
        const bNum = parseInt(b.key.split("-")[1]);
        return bNum - aNum;
      });
      const keep = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        dupes.push({ remove: sorted[i], keepInstead: keep, reason: "duplicate", normKey: norm });
      }
    }
  }
  return dupes;
}

// ── Superseded detection ─────────────────────────────────────────────────
function findSuperseded(issues) {
  const superseded = [];

  // Sprint 3 stories that are "[DONE]" tagged AND have a newer sprint-3 version
  // Also catch old epics that were replaced (e.g. "MMC Comply" vs "MMC Comply Module")
  const oldEpicNames = ["MMC Comply", "MMC Build", "MMC Quote", "MMC Direct", "MMC Train", "Billing", "Infrastructure", "Dashboard & UX"];
  const newEpicNames = ["MMC Comply Module", "MMC Build Module", "MMC Quote Module", "MMC Direct Module", "MMC Train Module", "Billing & Stripe", "Infrastructure & DevOps", "Dashboard & UX"];

  for (const issue of issues) {
    const summary = issue.fields.summary;
    const type = issue.fields.issuetype?.name;

    // Old-style epic names superseded by new ones
    if (type === "Epic") {
      const oldIdx = oldEpicNames.indexOf(summary);
      if (oldIdx >= 0 && oldIdx < newEpicNames.length - 1) {
        // Check if the new-style epic exists
        const newEpic = issues.find(
          (i) => i.fields.issuetype?.name === "Epic" && i.fields.summary === newEpicNames[oldIdx] && i.key !== issue.key
        );
        if (newEpic) {
          superseded.push({ remove: issue, keepInstead: newEpic, reason: "superseded by renamed epic" });
        }
      }
    }

    // Old stories without sprint prefix that have a newer [S3-*] version
    if (type === "Story" && !summary.startsWith("[")) {
      const norm = normalise(summary);
      const newer = issues.find(
        (i) =>
          i.key !== issue.key &&
          i.fields.issuetype?.name === "Story" &&
          normalise(i.fields.summary) === norm &&
          i.fields.summary.startsWith("[")
      );
      if (newer) {
        superseded.push({ remove: issue, keepInstead: newer, reason: "superseded by prefixed version" });
      }
    }
  }

  return superseded;
}

// ── Stale detection ──────────────────────────────────────────────────────
function findStale(issues) {
  const stale = [];
  for (const issue of issues) {
    const summary = issue.fields.summary;
    // Test issues that should have been cleaned up
    if (/^TEST\b/i.test(summary) || /delete me/i.test(summary) || /^test —/i.test(summary)) {
      stale.push({ remove: issue, reason: "test/scratch issue" });
    }
  }
  return stale;
}

// ── Print report ─────────────────────────────────────────────────────────
function printReport(allIssues, dupes, superseded, stale) {
  console.log("\n" + "═".repeat(60));
  console.log("  JIRA AUDIT REPORT");
  console.log("═".repeat(60));

  // Summary by type and status
  const byType = {};
  const byStatus = {};
  for (const i of allIssues) {
    const type = i.fields.issuetype?.name || "Unknown";
    const status = i.fields.status?.name || "Unknown";
    byType[type] = (byType[type] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  console.log(`\n  Total issues: ${allIssues.length}`);
  console.log("  By type:", Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(", "));
  console.log("  By status:", Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", "));

  // All issues listing
  console.log("\n" + "─".repeat(60));
  console.log("  ALL ISSUES");
  console.log("─".repeat(60));
  for (const i of allIssues) {
    const status = i.fields.status?.name || "?";
    const type = i.fields.issuetype?.name || "?";
    const assignee = i.fields.assignee?.displayName || "unassigned";
    const padKey = i.key.padEnd(10);
    const padType = type.padEnd(6);
    const padStatus = status.padEnd(12);
    console.log(`  ${padKey} ${padType} ${padStatus} ${assignee.padEnd(15)} ${i.fields.summary.substring(0, 60)}`);
  }

  // Cleanup candidates
  const allCleanup = [
    ...dupes.map((d) => ({ ...d, category: "DUPLICATE" })),
    ...superseded.map((d) => ({ ...d, category: "SUPERSEDED" })),
    ...stale.map((d) => ({ ...d, category: "STALE" })),
  ];

  if (allCleanup.length === 0) {
    console.log("\n  ✅ No duplicates, superseded, or stale issues found.");
    return allCleanup;
  }

  console.log("\n" + "─".repeat(60));
  console.log("  CLEANUP CANDIDATES");
  console.log("─".repeat(60));

  for (const item of allCleanup) {
    const status = item.remove.fields.status?.name || "?";
    console.log(`\n  ${item.category}: ${item.remove.key} — ${item.remove.fields.summary}`);
    console.log(`    Status: ${status} | Reason: ${item.reason}`);
    if (item.keepInstead) {
      console.log(`    Keep instead: ${item.keepInstead.key} — ${item.keepInstead.fields.summary}`);
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log(`  Total cleanup candidates: ${allCleanup.length}`);
  if (!EXECUTE) {
    console.log("  Run with --execute to apply cleanup");
  }
  console.log("─".repeat(60));

  return allCleanup;
}

// ── Execute cleanup ──────────────────────────────────────────────────────
async function executeCleanup(items) {
  if (!EXECUTE || items.length === 0) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`\n  ⚠️  Delete ${items.length} issues? (yes/no): `, resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "yes") {
    console.log("  Cancelled.");
    return;
  }

  console.log("\n  Executing cleanup...");
  let deleted = 0;
  for (const item of items) {
    const result = await api("DELETE", `/rest/api/3/issue/${item.remove.key}?deleteSubtasks=true`);
    if (result) {
      console.log(`  ✓ Deleted ${item.remove.key}`);
      deleted++;
    } else {
      console.log(`  ✗ Failed to delete ${item.remove.key}`);
    }
  }
  console.log(`\n  ✅ Deleted ${deleted}/${items.length} issues`);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍 MMC Build — Jira Audit & Cleanup");
  console.log(`   ${HOST} | Project: ${PROJECT_KEY}`);
  console.log(`   Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN (audit only)"}\n`);

  console.log("  Fetching all issues...");
  const allIssues = await fetchAllIssues();
  console.log(`  ✓ Found ${allIssues.length} issues`);

  const dupes = findDuplicates(allIssues);
  const superseded = findSuperseded(allIssues);
  const stale = findStale(allIssues);

  const cleanup = printReport(allIssues, dupes, superseded, stale);
  await executeCleanup(cleanup);
}

main().catch((e) => {
  console.error("❌ ", e.message);
  process.exit(1);
});
