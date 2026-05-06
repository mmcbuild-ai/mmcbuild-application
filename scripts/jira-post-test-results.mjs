#!/usr/bin/env node
/**
 * MMC Build — Post Playwright test results to Jira
 *
 * Reads test-results/regime-results.json (written by tests/e2e/regime-reporter.ts)
 * and posts a pass/fail comment on the matching Jira ticket for each result.
 *
 * Designed to run in CI after `pnpm test:e2e`. Uses GitHub Actions env vars
 * (GITHUB_SHA, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID) to build
 * a workflow run URL in the comment. Runs locally too — without GITHUB_* the
 * workflow URL is omitted.
 *
 * Never fails the CI job on API errors — Jira posting is best-effort. The
 * test suite's own exit code remains the source of truth for pass/fail.
 *
 * Pre-requisite:
 *   tests/.jira-state.json (produced by scripts/jira-test-regime.mjs)
 *
 * Run locally: node scripts/jira-post-test-results.mjs
 * Run in CI:   node scripts/jira-post-test-results.mjs (env vars injected)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

// ── Load .env.local (locally) ────────────────────────────────────────────
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length && !process.env[key.trim()])
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    });
}

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;

if (!HOST || !EMAIL || !TOKEN) {
  console.error("⚠️  Missing JIRA_HOST, JIRA_EMAIL, or JIRA_TOKEN — skipping Jira posting.");
  // Best-effort: exit 0 so CI doesn't fail on missing creds (e.g., fork PRs)
  process.exit(0);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Load inputs ──────────────────────────────────────────────────────────
const resultsPath = join(process.cwd(), "test-results", "regime-results.json");
const statePath = join(process.cwd(), "tests", ".jira-state.json");

if (!existsSync(resultsPath)) {
  console.error(`⚠️  ${resultsPath} missing — did Playwright run with regime-reporter?`);
  process.exit(0);
}
if (!existsSync(statePath)) {
  console.error(`⚠️  ${statePath} missing — run scripts/jira-test-regime.mjs first`);
  process.exit(0);
}

const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const jiraState = JSON.parse(readFileSync(statePath, "utf8"));

// ── GitHub Actions context ───────────────────────────────────────────────
const GITHUB_SHA = process.env.GITHUB_SHA || "";
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || "";
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || "";
const GITHUB_RUN_ATTEMPT = process.env.GITHUB_RUN_ATTEMPT || "";
const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME || "";

const workflowUrl =
  GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}${GITHUB_RUN_ATTEMPT ? `/attempts/${GITHUB_RUN_ATTEMPT}` : ""}`
    : null;

const shortSha = GITHUB_SHA ? GITHUB_SHA.substring(0, 7) : "local";

// ── Jira API helper ──────────────────────────────────────────────────────
function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            console.error(`  ⚠️  ${method} ${path} → ${res.statusCode}: ${raw.substring(0, 200)}`);
            resolve(null);
          } else {
            try {
              resolve(raw ? JSON.parse(raw) : {});
            } catch {
              resolve(raw);
            }
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── ADF document builders ────────────────────────────────────────────────
const doc = (content) => ({ type: "doc", version: 1, content });
const p = (text, marks) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
const strong = (text) => ({
  type: "text",
  text,
  marks: [{ type: "strong" }],
});
const linkNode = (text, href) => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href } }],
});
const codeBlock = (text) => ({
  type: "codeBlock",
  content: [{ type: "text", text }],
});

function buildComment(r) {
  const icon = r.status === "passed" ? "✅" : r.status === "skipped" ? "⏭️" : "❌";
  const label = r.status.toUpperCase();
  const durationSec = (r.duration / 1000).toFixed(1);

  const headerChunks = [
    { type: "text", text: `${icon} ` },
    strong(`${label} — ${r.tcId}`),
  ];

  const metaChunks = [{ type: "text", text: `Commit: ${shortSha}` }];
  if (GITHUB_REF_NAME) {
    metaChunks.push({ type: "text", text: ` · Branch: ${GITHUB_REF_NAME}` });
  }
  metaChunks.push({ type: "text", text: ` · Duration: ${durationSec}s` });
  if (workflowUrl) {
    metaChunks.push({ type: "text", text: " · " });
    metaChunks.push(linkNode("Workflow run", workflowUrl));
  }

  const content = [
    { type: "paragraph", content: headerChunks },
    { type: "paragraph", content: metaChunks },
  ];

  if (r.status === "failed" && r.error) {
    content.push({ type: "paragraph", content: [strong("Error (first lines):")] });
    content.push(codeBlock(r.error));
    if (r.recommendation) {
      content.push({
        type: "paragraph",
        content: [strong("Recommendation: "), { type: "text", text: r.recommendation }],
      });
    }
  }

  return doc(content);
}

async function postComment(issueKey, commentBody) {
  return api("POST", `/rest/api/3/issue/${issueKey}/comment`, { body: commentBody });
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n📮 MMC Build — Post test results to Jira");
  console.log(`   ${HOST}`);
  console.log(`   Commit: ${shortSha}${workflowUrl ? ` · ${workflowUrl}` : ""}`);
  console.log(`   Results: ${results.totalTests} (${results.passed}✅ ${results.failed}❌ ${results.skipped}⏭️)\n`);

  let posted = 0, skipped = 0, failed = 0;

  for (const r of results.results) {
    const jiraKey = jiraState.testCases[r.tcId];
    if (!jiraKey) {
      console.log(`   ⚠️  ${r.tcId}: no Jira key in state — skipping`);
      skipped++;
      continue;
    }

    await delay(200);
    const comment = buildComment(r);
    const result = await postComment(jiraKey, comment);

    if (result?.id) {
      const icon = r.status === "passed" ? "✅" : r.status === "skipped" ? "⏭️" : "❌";
      console.log(`   ${icon} ${jiraKey} ${r.tcId} — ${r.status}`);
      posted++;
    } else {
      console.log(`   ✗ ${jiraKey} ${r.tcId}: comment post failed`);
      failed++;
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ Jira posting complete");
  console.log("═".repeat(60));
  console.log(`  Posted: ${posted} | Skipped: ${skipped} | Failed: ${failed}\n`);

  // Always exit 0 — Jira posting is best-effort, not a build gate
  process.exit(0);
}

main().catch((e) => {
  console.error("⚠️ ", e.message);
  // Best-effort: don't fail CI on Jira errors
  process.exit(0);
});
