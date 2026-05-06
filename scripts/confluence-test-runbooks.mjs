#!/usr/bin/env node
/**
 * MMC Build — Confluence Test Runbook Pages
 *
 * For every test case in tests/manifest.json, creates a child page
 * under the "UAT Test Results" page in the MMC Build Confluence space.
 *
 * Each runbook page contains:
 *   - Purpose
 *   - Preconditions
 *   - Steps (ordered list)
 *   - Expected result
 *   - "Run on staging" deep link
 *   - Embedded Jira Issue macro (live status)
 *   - Result Log table (Karen / Karthik append rows)
 *
 * Idempotent — skips pages that already exist with the same title.
 *
 * Pre-requisite:
 *   node scripts/jira-test-regime.mjs   (produces tests/.jira-state.json)
 *
 * Run: node scripts/confluence-test-runbooks.mjs
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    });
  console.log("  ✓ Loaded .env.local");
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;

if (!EMAIL || !TOKEN) {
  console.error("\n❌ Missing credentials in .env.local (JIRA_EMAIL, JIRA_TOKEN)");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const WIKI = `https://${HOST}/wiki/rest/api`;

// ── Load manifest + Jira state ───────────────────────────────────────────
const manifestPath = join(process.cwd(), "tests", "manifest.json");
const statePath = join(process.cwd(), "tests", ".jira-state.json");

if (!existsSync(manifestPath)) {
  console.error(`❌ Manifest not found: ${manifestPath}`);
  process.exit(1);
}
if (!existsSync(statePath)) {
  console.error(`❌ Jira state not found: ${statePath}`);
  console.error("   Run scripts/jira-test-regime.mjs first to populate test ticket keys.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const jiraState = JSON.parse(readFileSync(statePath, "utf8"));
console.log(`  ✓ Manifest: ${manifest.testCases.length} test cases`);
console.log(`  ✓ Jira state: ${Object.keys(jiraState.testCases).length} ticket keys`);

// ── API helper ───────────────────────────────────────────────────────────
async function api(url, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Basic ${AUTH}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ ${method} ${res.status}: ${text.slice(0, 300)}`);
    return null;
  }
  return text ? JSON.parse(text) : {};
}

// ── Space + page lookup ──────────────────────────────────────────────────
async function findSpace() {
  for (const key of ["MB", "MMCBUILD", "MMC", "MMCB"]) {
    const space = await api(`${WIKI}/space/${key}`);
    if (space?.key) return space;
  }
  const all = await api(`${WIKI}/space?limit=50`);
  if (all?.results) {
    const match = all.results.find(
      (s) =>
        s.name?.toLowerCase().includes("mmc") ||
        s.name?.toLowerCase().includes("build")
    );
    if (match) return match;
  }
  return null;
}

async function findPage(spaceKey, title) {
  const r = await api(
    `${WIKI}/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}&type=page&limit=1`
  );
  return r?.results?.[0] || null;
}

// ── HTML escaping for storage format ─────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Build runbook page body in Confluence storage format ─────────────────
function buildRunbookBody(tc, jiraKey) {
  const stepsHtml = tc.steps.map((s) => `<li>${esc(s)}</li>`).join("\n    ");
  const preconditionsHtml = (tc.preconditions || [])
    .map((p) => `<li>${esc(p)}</li>`)
    .join("\n    ");

  const preconditionsBlock = preconditionsHtml
    ? `<h2>Preconditions</h2>\n<ul>\n    ${preconditionsHtml}\n</ul>`
    : "";

  const jiraMacro = jiraKey
    ? `<ac:structured-macro ac:name="jira" ac:schema-version="1">
  <ac:parameter ac:name="key">${esc(jiraKey)}</ac:parameter>
</ac:structured-macro>`
    : `<p><em>No Jira ticket linked — run jira-test-regime.mjs first.</em></p>`;

  const e2eBlock = tc.e2eSpec
    ? `<h2>Automated Coverage</h2>
<p>Playwright spec: <code>${esc(tc.e2eSpec)}</code></p>
<p>CI will post pass/fail comments on the linked Jira ticket after each E2E run.</p>`
    : `<h2>Automated Coverage</h2>
<p><em>Manual test only — no Playwright spec.</em></p>`;

  return `
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Test Case:</strong> ${esc(tc.tcId)} &mdash; ${esc(tc.title)}</p>
    <p><strong>Section:</strong> ${esc(tc.section)} &middot; <strong>Jira:</strong> ${esc(jiraKey || "not linked")}</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Purpose</h2>
<p>${esc(tc.purpose)}</p>

${preconditionsBlock}

<h2>How to Run the Test</h2>
<ol>
    ${stepsHtml}
</ol>

<h2>Expected Result</h2>
<p>${esc(tc.expected)}</p>

<h2>Run on Staging</h2>
<p>Platform: <a href="${esc(manifest.platformUrl)}">${esc(manifest.platformUrl)}</a></p>
<p>Test checklist: <a href="${esc(manifest.testPageUrl)}">${esc(manifest.testPageUrl)}</a></p>

${e2eBlock}

<h2>Jira Ticket (live status)</h2>
${jiraMacro}
<p>Log your findings as a comment on the Jira ticket above, or add a row to the Result Log below.</p>

<h2>Result Log</h2>
<table>
  <tr>
    <th>Date</th>
    <th>Tester</th>
    <th>Result</th>
    <th>Notes</th>
    <th>Jira comment link</th>
  </tr>
  <tr>
    <td><em>YYYY-MM-DD</em></td>
    <td><em>Your name</em></td>
    <td><em>Pass / Fail / Blocked / N/A</em></td>
    <td><em>What happened. Screenshots. Steps that differed.</em></td>
    <td><em>SCRUM-XX#comment-YYYY</em></td>
  </tr>
</table>

<h2>Review Checklist</h2>
<ul>
  <li>Is this test suitable for beta sign-off?</li>
  <li>Are the steps clear enough to follow without asking?</li>
  <li>Is the expected result clear?</li>
  <li>Any additional scenarios we should test for this feature?</li>
</ul>

<hr />
<p><em>Source of truth: <code>tests/manifest.json</code>. Do not edit this page's Purpose / Steps / Expected sections directly — update the manifest and re-run <code>scripts/confluence-test-runbooks.mjs</code>.</em></p>
`.trim();
}

// ── Create or update page ────────────────────────────────────────────────
async function upsertPage(spaceKey, parentId, title, body) {
  const existing = await findPage(spaceKey, title);
  if (existing) {
    // Update in place (new version)
    const current = await api(
      `${WIKI}/content/${existing.id}?expand=version`
    );
    const nextVersion = (current?.version?.number || 1) + 1;
    const result = await api(`${WIKI}/content/${existing.id}`, "PUT", {
      id: existing.id,
      type: "page",
      title,
      space: { key: spaceKey },
      body: { storage: { value: body, representation: "storage" } },
      version: { number: nextVersion },
      ...(parentId ? { ancestors: [{ id: parentId }] } : {}),
    });
    if (result?.id) {
      console.log(`  ↻ Updated: ${result.id} — ${title}`);
      return result;
    }
    return null;
  }

  const payload = {
    type: "page",
    title,
    space: { key: spaceKey },
    body: { storage: { value: body, representation: "storage" } },
    ...(parentId ? { ancestors: [{ id: parentId }] } : {}),
  };
  const result = await api(`${WIKI}/content`, "POST", payload);
  if (result?.id) {
    console.log(`  ✓ Created: ${result.id} — ${title}`);
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n📘 MMC Build — Confluence Test Runbooks");
  console.log(`   ${HOST}\n`);

  // 1. Find space
  console.log("1. Finding MMC Build space...");
  const space = await findSpace();
  if (!space) {
    console.error("   ❌ No MMC Build space found. Run scripts/confluence-setup.mjs first.");
    process.exit(1);
  }
  console.log(`   ✓ ${space.key} — ${space.name}`);

  // 2. Find UAT Test Results parent page
  console.log("\n2. Finding 'UAT Test Results' parent page...");
  const parent = await findPage(space.key, "UAT Test Results");
  if (!parent) {
    console.error("   ❌ 'UAT Test Results' page not found. Run scripts/confluence-setup.mjs first.");
    process.exit(1);
  }
  console.log(`   ✓ Parent: ${parent.id}`);

  // 3. Create/update one child page per test case
  console.log("\n3. Creating runbook pages...");
  const pageState = { space: space.key, parent: parent.id, generatedAt: new Date().toISOString(), pages: {} };
  let created = 0, updated = 0, failed = 0;

  for (const tc of manifest.testCases) {
    const title = `${tc.tcId} — ${tc.title}`;
    const jiraKey = jiraState.testCases[tc.tcId];
    if (!jiraKey) {
      console.log(`   ⚠️  ${tc.tcId} — no Jira key in state; page will be created without live status`);
    }

    const body = buildRunbookBody(tc, jiraKey);
    const before = await findPage(space.key, title);
    const result = await upsertPage(space.key, parent.id, title, body);

    if (result?.id) {
      pageState.pages[tc.tcId] = {
        id: result.id,
        title,
        url: `https://${HOST}/wiki/spaces/${space.key}/pages/${result.id}`,
        jiraKey: jiraKey || null,
      };
      if (before) updated++;
      else created++;
    } else {
      failed++;
    }
  }

  // 4. Persist page state for jira-link-confluence.mjs
  const outPath = join(process.cwd(), "tests", ".confluence-state.json");
  writeFileSync(outPath, JSON.stringify(pageState, null, 2));

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  ✅ Confluence runbooks complete");
  console.log("═".repeat(60));
  console.log(`\n  Space:   https://${HOST}/wiki/spaces/${space.key}/overview`);
  console.log(`  Parent:  https://${HOST}/wiki/spaces/${space.key}/pages/${parent.id}`);
  console.log(`  Created: ${created} | Updated: ${updated} | Failed: ${failed}`);
  console.log(`  State:   ${outPath}\n`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
