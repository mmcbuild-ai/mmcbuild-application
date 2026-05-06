#!/usr/bin/env node
/**
 * MMC Build — Create Jira issues for Test Regime v1.0 review
 *
 * Reads test cases from tests/manifest.json (single source of truth).
 * Creates one parent Story + N subtasks/tasks (one per test case) for
 * Karen and Karthik to review. Idempotent — skips existing issues.
 *
 * Labels applied:
 *   Parent:   manifest.jiraLabels.parent
 *   Each TC:  manifest.jiraLabels.all + <section-slug>
 *             + manifest.jiraLabels.withE2E (if e2eSpec defined)
 *
 * On success, writes tests/.jira-state.json mapping tcId -> jiraKey
 * for consumption by downstream scripts (confluence-test-runbooks,
 * jira-link-confluence, jira-post-test-results).
 *
 * Uses credentials from .env.local (same as jira_setup_v4.js).
 * Run: node scripts/jira-test-regime.mjs
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
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
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";

if (!HOST || !EMAIL || !TOKEN) {
  console.error("❌  Missing JIRA_HOST, JIRA_EMAIL, or JIRA_TOKEN in .env.local");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Load test manifest ───────────────────────────────────────────────────
const manifestPath = join(process.cwd(), "tests", "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`❌  Manifest not found: ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const TEST_CASES = manifest.testCases;
const PLATFORM_URL = manifest.platformUrl;
const TEST_PAGE_URL = manifest.testPageUrl;
console.log(`  ✓ Loaded manifest v${manifest.version} — ${TEST_CASES.length} test cases`);

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

const doc = (blocks) => ({
  type: "doc",
  version: 1,
  content: blocks,
});

const paragraph = (text) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const heading = (text, level = 3) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});

const bold = (text) => ({
  type: "text",
  text,
  marks: [{ type: "strong" }],
});

const link = (text, href) => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href } }],
});

const bulletList = (items) => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: typeof item === "string" ? [{ type: "text", text: item }] : item }],
  })),
});

const rule = () => ({ type: "rule" });

// ── Label builder ────────────────────────────────────────────────────────
function labelsForTc(tc) {
  const sectionSlug = tc.section.toLowerCase().replace(/\s+/g, "-");
  const labels = [...manifest.jiraLabels.all, sectionSlug];
  if (tc.e2eSpec) labels.push(...manifest.jiraLabels.withE2E);
  return labels;
}

// ── Jira document builders ───────────────────────────────────────────────
function buildDescription(tc) {
  const blocks = [
    heading("Purpose", 3),
    paragraph(tc.purpose),
    rule(),
  ];

  if (tc.preconditions && tc.preconditions.length) {
    blocks.push(heading("Preconditions", 3));
    blocks.push(bulletList(tc.preconditions));
    blocks.push(rule());
  }

  blocks.push(heading("How to Test", 3));
  blocks.push(bulletList(tc.steps));
  blocks.push(rule());
  blocks.push(heading("Expected Result", 3));
  blocks.push(paragraph(tc.expected));
  blocks.push(rule());

  if (tc.e2eSpec) {
    blocks.push(heading("Automated Coverage", 3));
    blocks.push(paragraph(`Playwright spec: ${tc.e2eSpec}`));
    blocks.push(paragraph("CI will post pass/fail comments on this issue after each E2E run."));
    blocks.push(rule());
  }

  blocks.push(heading("Review This Test", 3));
  blocks.push(paragraph("Please review and comment on this test case:"));
  blocks.push(bulletList([
    "Is this test suitable? (Yes / No / Needs changes)",
    "Are the steps clear enough to follow?",
    "Is the expected result clear?",
    "Any additional scenarios we should test for this feature?",
  ]));
  blocks.push(rule());
  blocks.push({
    type: "paragraph",
    content: [
      { type: "text", text: "Manual test checklist: " },
      link(TEST_PAGE_URL, TEST_PAGE_URL),
    ],
  });
  blocks.push({
    type: "paragraph",
    content: [
      { type: "text", text: "Platform: " },
      link(PLATFORM_URL, PLATFORM_URL),
    ],
  });
  return doc(blocks);
}

function buildParentDescription() {
  // Summary per section for the parent story
  const bySection = new Map();
  for (const tc of TEST_CASES) {
    const arr = bySection.get(tc.section) || [];
    arr.push(tc);
    bySection.set(tc.section, arr);
  }
  const sectionLines = Array.from(bySection.entries()).map(
    ([section, tcs]) => `${section} (${tcs.length} tests)`
  );

  return doc([
    heading(`Test Regime v${manifest.version} — Review Request`, 2),
    paragraph(
      `This story tracks the review of all ${TEST_CASES.length} test cases for MMC Build beta sign-off. ` +
      "Each test case is listed as a subtask below."
    ),
    rule(),
    heading("What We Need From You", 3),
    paragraph("For each test case (subtask), please review and comment on:"),
    bulletList([
      [bold("Suitable / Not Suitable"), { type: "text", text: " — Does this test cover the right thing? Is it testing what matters for beta readiness?" }],
      [bold("Clarity"), { type: "text", text: " — Are the test steps clear enough? Would you know how to run this test manually? If not, tell us what's unclear." }],
      [bold("Missing Tests"), { type: "text", text: " — Are there any scenarios we've missed that should be tested before beta launch?" }],
    ]),
    rule(),
    heading("How to Review", 3),
    bulletList([
      "Open each subtask below and read the Purpose, Steps, and Expected Result",
      "Follow the Confluence runbook link on the subtask to run the manual walkthrough",
      "Add a comment with your feedback (suitable/not suitable + any clarifications)",
      "When you've reviewed all tests, move this story to Done",
    ]),
    rule(),
    heading("Links", 3),
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Manual test checklist: " },
        link(TEST_PAGE_URL, TEST_PAGE_URL),
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Live platform: " },
        link(PLATFORM_URL, PLATFORM_URL),
      ],
    },
    rule(),
    heading("Test Summary", 3),
    paragraph(`${TEST_CASES.length} tests across ${bySection.size} sections:`),
    bulletList(sectionLines),
  ]);
}

// ── JQL search helpers ───────────────────────────────────────────────────
// Uses /rest/api/3/search/jql (POST) — the old GET /rest/api/3/search endpoint
// was removed by Atlassian (410 Gone). See:
// https://developer.atlassian.com/changelog/#CHANGE-2046
async function searchIssue(jql) {
  const r = await api("POST", "/rest/api/3/search/jql", {
    jql,
    fields: ["summary", "labels"],
    maxResults: 50,
  });
  return r?.issues || [];
}

async function findExistingParent() {
  // Prior runs used summary starting with "[Test Regime v" — match that.
  const jql = `project = ${PROJECT_KEY} AND labels = "test-regime" AND summary ~ "Test Regime" AND issuetype = Story`;
  const issues = await searchIssue(jql);
  return issues.find((i) => i.fields.summary.startsWith("[Test Regime v")) || null;
}

async function findExistingTc(tcId) {
  const jql = `project = ${PROJECT_KEY} AND labels = "test-regime" AND summary ~ "${tcId}"`;
  const issues = await searchIssue(jql);
  return issues.find((i) => i.fields.summary.includes(tcId)) || null;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧪 MMC Build — Test Regime Jira Setup");
  console.log(`   ${HOST} | Project: ${PROJECT_KEY}\n`);

  // 1. Get project
  console.log("1. Fetching project...");
  const project = await api("GET", `/rest/api/3/project/${PROJECT_KEY}`);
  if (!project) process.exit(1);
  const PROJECT_ID = project.id;
  console.log(`   ✓ ${project.name} (ID: ${PROJECT_ID})`);

  // 2. Get issue types
  console.log("2. Fetching issue types...");
  const types = await api("GET", `/rest/api/3/issuetype/project?projectId=${PROJECT_ID}`);
  const storyType = types?.find((t) => t.name === "Story");
  const subtaskType = types?.find((t) => t.name === "Sub-task" || t.name === "Subtask");
  const taskType = types?.find((t) => t.name === "Task");

  const childType = subtaskType || taskType;
  if (!storyType || !childType) {
    console.error("   ❌ Cannot find Story or Sub-task/Task issue types");
    console.log("   Available types:", types?.map((t) => t.name).join(", "));
    process.exit(1);
  }
  console.log(`   ✓ Story: ${storyType.id} | Child: ${childType.name} (${childType.id})`);

  // 3. Get users
  console.log("3. Resolving users...");
  const me = await api("GET", "/rest/api/3/myself");
  console.log(`   ✓ ${me?.displayName}`);

  let karenId = null, karthikId = null;
  const karenEmail = process.env.KAREN_EMAIL;
  const karthikEmail = process.env.KARTHIK_EMAIL;

  if (karenEmail) {
    const r = await api("GET", `/rest/api/3/user/search?query=${encodeURIComponent(karenEmail)}`);
    if (Array.isArray(r) && r[0]) {
      karenId = r[0].accountId;
      console.log(`   ✓ Karen: ${r[0].displayName}`);
    } else {
      console.log("   ⚠️  Karen not found");
    }
  }
  if (karthikEmail) {
    const r = await api("GET", `/rest/api/3/user/search?query=${encodeURIComponent(karthikEmail)}`);
    if (Array.isArray(r) && r[0]) {
      karthikId = r[0].accountId;
      console.log(`   ✓ Karthik: ${r[0].displayName}`);
    } else {
      console.log("   ⚠️  Karthik not found");
    }
  }

  // 4. Discover or create parent story
  console.log("\n4. Parent story — checking for existing...");
  let parent = await findExistingParent();
  if (parent) {
    console.log(`   ↩ Reusing ${parent.key} — ${parent.fields.summary}`);
  } else {
    console.log("   + Creating parent story...");
    const parentResult = await api("POST", "/rest/api/3/issue", {
      fields: {
        project: { id: PROJECT_ID },
        issuetype: { id: storyType.id },
        summary: `[Test Regime v${manifest.version}] Review all ${TEST_CASES.length} test cases before beta sign-off`,
        description: buildParentDescription(),
        labels: manifest.jiraLabels.parent,
        priority: { name: "High" },
      },
    });
    if (!parentResult?.key) {
      console.error("   ❌ Failed to create parent story");
      process.exit(1);
    }
    parent = { key: parentResult.key, fields: { summary: parentResult.fields?.summary || "" } };
    console.log(`   ✓ Created ${parent.key}`);
  }

  // 5. Create or reuse subtasks
  console.log("\n5. Test case subtasks...\n");
  const state = { parent: parent.key, generatedAt: new Date().toISOString(), testCases: {} };
  let created = 0, reused = 0, failed = 0;
  let currentSection = "";

  for (const tc of TEST_CASES) {
    if (tc.section !== currentSection) {
      currentSection = tc.section;
      console.log(`   📂 ${currentSection}`);
    }

    await delay(250);

    const existing = await findExistingTc(tc.tcId);
    if (existing) {
      console.log(`      ↩ ${existing.key} — ${tc.tcId} (reused)`);
      state.testCases[tc.tcId] = existing.key;
      reused++;
      continue;
    }

    const fields = {
      project: { id: PROJECT_ID },
      issuetype: { id: childType.id },
      summary: `[${tc.tcId}] ${tc.title}`,
      description: buildDescription(tc),
      labels: labelsForTc(tc),
      priority: { name: "Medium" },
    };

    if (subtaskType) {
      fields.parent = { key: parent.key };
    }

    const result = await api("POST", "/rest/api/3/issue", { fields });

    if (result?.key) {
      console.log(`      ✓ ${result.key} — ${tc.tcId}: ${tc.title.substring(0, 50)}...`);
      state.testCases[tc.tcId] = result.key;
      created++;

      if (!subtaskType && result.key) {
        await api("POST", "/rest/api/3/issueLink", {
          type: { name: "Blocks" },
          outwardIssue: { key: result.key },
          inwardIssue: { key: parent.key },
        });
      }
    } else {
      console.log(`      ✗ FAILED — ${tc.tcId}`);
      failed++;
    }
  }

  // 6. Add watchers (Karen and Karthik)
  // The api() helper JSON.stringifies the body — pass the accountId raw
  // (not pre-stringified), and Jira receives a valid JSON string body.
  if (karenId) {
    const w = await api("POST", `/rest/api/3/issue/${parent.key}/watchers`, karenId);
    console.log(w !== null ? "\n   ✓ Karen added as watcher" : "\n   ⚠️  Karen watcher add failed");
  }
  if (karthikId) {
    const w = await api("POST", `/rest/api/3/issue/${parent.key}/watchers`, karthikId);
    console.log(w !== null ? "   ✓ Karthik added as watcher" : "   ⚠️  Karthik watcher add failed");
  }

  // 7. Write state file for downstream scripts
  const statePath = join(process.cwd(), "tests", ".jira-state.json");
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`\n   ✓ State written: ${statePath}`);

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  ✅ Test Regime — Jira setup complete");
  console.log("═".repeat(60));
  console.log(`\n  Parent: https://${HOST}/browse/${parent.key}`);
  console.log(`  Created: ${created} | Reused: ${reused} | Failed: ${failed}`);
  console.log(`\n  Test page: ${TEST_PAGE_URL}`);
  console.log(`  Platform:  ${PLATFORM_URL}\n`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
