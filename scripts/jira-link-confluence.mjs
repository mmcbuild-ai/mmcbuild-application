#!/usr/bin/env node
/**
 * MMC Build — Link Jira tickets to Confluence runbook pages
 *
 * Adds a "remote link" on each Jira ticket pointing to the corresponding
 * Confluence runbook page. Idempotent via globalId — re-running updates
 * the existing link rather than creating duplicates.
 *
 * Pre-requisites:
 *   node scripts/jira-test-regime.mjs          (produces tests/.jira-state.json)
 *   node scripts/confluence-test-runbooks.mjs  (produces tests/.confluence-state.json)
 *
 * Run: node scripts/jira-link-confluence.mjs
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
      if (key && rest.length)
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    });
  console.log("  ✓ Loaded .env.local");
}

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;

if (!HOST || !EMAIL || !TOKEN) {
  console.error("❌ Missing JIRA_HOST, JIRA_EMAIL, or JIRA_TOKEN in .env.local");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Load state files ─────────────────────────────────────────────────────
const jiraStatePath = join(process.cwd(), "tests", ".jira-state.json");
const confluenceStatePath = join(process.cwd(), "tests", ".confluence-state.json");

if (!existsSync(jiraStatePath)) {
  console.error(`❌ ${jiraStatePath} missing — run scripts/jira-test-regime.mjs first`);
  process.exit(1);
}
if (!existsSync(confluenceStatePath)) {
  console.error(`❌ ${confluenceStatePath} missing — run scripts/confluence-test-runbooks.mjs first`);
  process.exit(1);
}

const jiraState = JSON.parse(readFileSync(jiraStatePath, "utf8"));
const confluenceState = JSON.parse(readFileSync(confluenceStatePath, "utf8"));

// ── Jira API helper (https) ──────────────────────────────────────────────
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

// ── Add / update remote link ─────────────────────────────────────────────
async function upsertRemoteLink(issueKey, page) {
  // globalId makes this idempotent — same globalId replaces the prior link
  const globalId = `confluence-runbook-${page.id}`;
  const payload = {
    globalId,
    application: {
      type: "com.atlassian.confluence",
      name: "Confluence",
    },
    relationship: "documented by",
    object: {
      url: page.url,
      title: `${page.title} (Confluence runbook)`,
      summary: "Manual test runbook with steps, expected result, and result log.",
      icon: {
        url16x16: `https://${HOST}/wiki/s/favicon.ico`,
        title: "Confluence",
      },
    },
  };
  return api("POST", `/rest/api/3/issue/${issueKey}/remotelink`, payload);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔗 MMC Build — Link Jira → Confluence");
  console.log(`   ${HOST}\n`);

  const tcIds = Object.keys(confluenceState.pages);
  console.log(`   ${tcIds.length} test cases to link\n`);

  let linked = 0, skipped = 0, failed = 0;

  for (const tcId of tcIds) {
    const jiraKey = jiraState.testCases[tcId];
    const page = confluenceState.pages[tcId];

    if (!jiraKey) {
      console.log(`   ⚠️  ${tcId}: no Jira key in state — skipping`);
      skipped++;
      continue;
    }
    if (!page?.id || !page?.url) {
      console.log(`   ⚠️  ${tcId}: no Confluence page in state — skipping`);
      skipped++;
      continue;
    }

    await delay(200);
    const result = await upsertRemoteLink(jiraKey, page);
    if (result) {
      console.log(`   ✓ ${jiraKey} → ${page.url}`);
      linked++;
    } else {
      console.log(`   ✗ ${jiraKey}: failed to add remote link`);
      failed++;
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ Link pass complete");
  console.log("═".repeat(60));
  console.log(`  Linked: ${linked} | Skipped: ${skipped} | Failed: ${failed}\n`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
