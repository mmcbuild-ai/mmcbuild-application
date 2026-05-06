#!/usr/bin/env node
/**
 * Sprint 5 — Test Regime v1.0 Execution
 * 1. Create sprint on board 1 (2026-04-24 → 2026-05-07)
 * 2. Assign SCRUM-123 + 29 subtasks to Karen
 * 3. Add Karthik as watcher on all 30
 * 4. Move SCRUM-123 to Sprint 5 (subtasks inherit)
 * 5. Close SCRUM-80 with superseded comment
 * 6. Close SCRUM-83 as duplicate of SCRUM-80
 * Idempotent — safe to re-run.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      let v = rest.join("=").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[key.trim()] = v;
    }
  });
}

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;
const KAREN_EMAIL = process.env.KAREN_EMAIL;
const KARTHIK_EMAIL = process.env.KARTHIK_EMAIL;
if (!HOST || !EMAIL || !TOKEN || !KAREN_EMAIL || !KARTHIK_EMAIL) {
  console.error("Missing env: JIRA_HOST/JIRA_EMAIL/JIRA_TOKEN/KAREN_EMAIL/KARTHIK_EMAIL");
  process.exit(1);
}
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function api(method, path, body = null) {
  return new Promise((resolve) => {
    const data = body === null ? null : (typeof body === "string" ? body : JSON.stringify(body));
    const req = https.request({
      hostname: HOST, path, method,
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
        if (res.statusCode >= 400) return resolve({ error: res.statusCode, body: raw.slice(0, 300), path });
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(raw); }
      });
    });
    req.on("error", (e) => resolve({ error: "NETWORK", body: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

const doc = (paras) => ({ type: "doc", version: 1, content: paras.map(t => ({ type: "paragraph", content: [{ type: "text", text: t }] })) });

const TEST_KEYS = Array.from({ length: 29 }, (_, i) => `SCRUM-${124 + i}`);
const ALL_KEYS = ["SCRUM-123", ...TEST_KEYS];
const SPRINT_NAME = "Sprint 5 — Test Regime v1.0";
const SPRINT_GOAL = "Karen and Karthik review and sign off all 29 test cases in the Test Regime v1.0.";
const START = "2026-04-24T00:00:00.000+1000";
const END = "2026-05-07T23:59:59.000+1000";

async function main() {
  console.log(`\nSprint 5 execution — ${HOST}\n${"=".repeat(60)}\n`);

  // Users
  console.log("1. Resolving Karen and Karthik account IDs");
  const karenLookup = await api("GET", `/rest/api/3/user/search?query=${encodeURIComponent(KAREN_EMAIL)}`);
  const karthikLookup = await api("GET", `/rest/api/3/user/search?query=${encodeURIComponent(KARTHIK_EMAIL)}`);
  const karenId = Array.isArray(karenLookup) && karenLookup[0]?.accountId;
  const karthikId = Array.isArray(karthikLookup) && karthikLookup[0]?.accountId;
  if (!karenId || !karthikId) { console.error("   ✗ failed to resolve users", { karenLookup, karthikLookup }); process.exit(1); }
  console.log(`   ✓ Karen: ${karenLookup[0].displayName} (${karenId})`);
  console.log(`   ✓ Karthik: ${karthikLookup[0].displayName} (${karthikId})`);

  // Board
  console.log("\n2. Finding scrum board for project SCRUM");
  let boards = await api("GET", `/rest/agile/1.0/board?projectKeyOrId=SCRUM&type=scrum`);
  let board = boards?.values?.[0];
  if (!board) {
    boards = await api("GET", `/rest/agile/1.0/board?projectKeyOrId=SCRUM`);
    board = boards?.values?.find(b => b.type === "scrum") || boards?.values?.[0];
  }
  if (!board) {
    boards = await api("GET", `/rest/agile/1.0/board`);
    board = boards?.values?.find(b => b.type === "scrum") || boards?.values?.[0];
  }
  if (!board) { console.error("   ✗ no board", boards); process.exit(1); }
  console.log(`   ✓ Board ${board.id}: ${board.name} (${board.type})`);

  // Sprint — check existing
  console.log(`\n3. Creating or reusing "${SPRINT_NAME}"`);
  const existingSprints = await api("GET", `/rest/agile/1.0/board/${board.id}/sprint?state=future,active`);
  let sprint = (existingSprints?.values || []).find(s => s.name === SPRINT_NAME);
  if (sprint) {
    console.log(`   ↩ Reusing sprint ${sprint.id} (state: ${sprint.state})`);
  } else {
    const created = await api("POST", `/rest/agile/1.0/sprint`, {
      name: SPRINT_NAME,
      originBoardId: board.id,
      startDate: START,
      endDate: END,
      goal: SPRINT_GOAL,
    });
    if (created?.error) { console.error("   ✗ sprint create failed", created); process.exit(1); }
    sprint = created;
    console.log(`   ✓ Created sprint ${sprint.id}`);
  }

  // Assign + watcher on all 30 tickets
  console.log(`\n4. Assigning ${ALL_KEYS.length} tickets to Karen, adding Karthik as watcher`);
  let assigned = 0, watcherAdded = 0, fail = 0;
  for (const k of ALL_KEYS) {
    const a = await api("PUT", `/rest/api/3/issue/${k}`, { fields: { assignee: { accountId: karenId } } });
    if (a?.error) { console.log(`   ✗ ${k} assign: ${a.error} ${a.body}`); fail++; }
    else { assigned++; }

    const w = await api("POST", `/rest/api/3/issue/${k}/watchers`, `"${karthikId}"`);
    if (w?.error) { console.log(`   ✗ ${k} watcher: ${w.error} ${w.body}`); }
    else { watcherAdded++; }

    await delay(120);
  }
  console.log(`   ✓ Assigned: ${assigned} | Watcher added: ${watcherAdded} | Failed: ${fail}`);

  // Move parent to sprint
  console.log(`\n5. Moving SCRUM-123 (parent) to Sprint ${sprint.id}`);
  const moveRes = await api("POST", `/rest/agile/1.0/sprint/${sprint.id}/issue`, { issues: ["SCRUM-123"] });
  if (moveRes?.error) console.log(`   ✗ ${moveRes.error}: ${moveRes.body}`);
  else console.log(`   ✓ Parent moved — subtasks inherit`);

  // Also explicitly put subtasks on sprint (defensive — some Jira configs don't auto-inherit)
  const batchMove = await api("POST", `/rest/agile/1.0/sprint/${sprint.id}/issue`, { issues: TEST_KEYS });
  if (batchMove?.error) console.log(`   ⚠️  subtask batch-move: ${batchMove.error} — subtasks may still inherit from parent`);
  else console.log(`   ✓ 29 subtasks explicitly added to sprint`);

  // Close SCRUM-80
  console.log(`\n6. Closing SCRUM-80`);
  await closeIssue("SCRUM-80",
    "Superseded — this review has been broken out into 29 individual test tickets (SCRUM-124 to SCRUM-152) grouped under parent SCRUM-123. Tracked in Sprint 5 — Test Regime v1.0 Execution (2026-04-24 → 2026-05-07). Closing to avoid duplication.");

  // Close SCRUM-83 + link as duplicate
  console.log(`\n7. Closing SCRUM-83 as duplicate of SCRUM-80`);
  const linkRes = await api("POST", `/rest/api/3/issueLink`, {
    type: { name: "Duplicate" },
    inwardIssue: { key: "SCRUM-80" },   // SCRUM-83 "is duplicated by" no — direction depends on type
    outwardIssue: { key: "SCRUM-83" },
  });
  if (linkRes?.error) console.log(`   ⚠️  duplicate link: ${linkRes.error} ${linkRes.body}`);
  else console.log(`   ✓ Duplicate link created`);
  await closeIssue("SCRUM-83",
    "Duplicate of SCRUM-80 — superseded by the 29 individual test tickets (SCRUM-124 to SCRUM-152) under SCRUM-123 in Sprint 5 Test Regime v1.0 Execution. Closing as duplicate.");

  console.log(`\n${"=".repeat(60)}\n  ✅ Sprint 5 setup complete`);
  console.log(`\n  Board:  https://${HOST}/jira/software/projects/SCRUM/boards/${board.id}`);
  console.log(`  Sprint: https://${HOST}/jira/software/projects/SCRUM/boards/${board.id}?sprint=${sprint.id}`);
  console.log(`  Parent: https://${HOST}/browse/SCRUM-123\n`);
}

async function closeIssue(key, commentText) {
  // Find the transition id for a Done/Closed state
  const issue = await api("GET", `/rest/api/3/issue/${key}?fields=status`);
  if (issue?.error) { console.log(`   ✗ fetch ${key}: ${issue.error}`); return; }
  const currentStatus = issue.fields?.status?.name;
  if (["Done", "Closed", "Resolved", "Cancelled"].includes(currentStatus)) {
    console.log(`   ↩ ${key} already ${currentStatus} — posting comment only`);
    await api("POST", `/rest/api/3/issue/${key}/comment`, { body: doc([commentText]) });
    return;
  }
  const transitions = await api("GET", `/rest/api/3/issue/${key}/transitions`);
  const done = transitions?.transitions?.find((t) => /done|closed|resolved/i.test(t.name)) || transitions?.transitions?.find((t) => /done|closed|resolved/i.test(t.to?.name || ""));
  if (!done) { console.log(`   ✗ no done transition for ${key} — available: ${transitions?.transitions?.map(t => t.name).join(", ")}`); return; }
  const trans = await api("POST", `/rest/api/3/issue/${key}/transitions`, {
    transition: { id: done.id },
    update: { comment: [{ add: { body: doc([commentText]) } }] },
  });
  if (trans?.error) console.log(`   ✗ transition ${key}: ${trans.error} ${trans.body}`);
  else console.log(`   ✓ ${key} → ${done.name}, comment posted`);
}

main().catch((e) => { console.error(e); process.exit(1); });
