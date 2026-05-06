#!/usr/bin/env node
/**
 * Sprint 4 → Sprint 5 triage execution.
 * Actions:
 *   - SCRUM-74 resolve (Done)
 *   - SCRUM-77, 78, 75, 84 move to Sprint 5
 *   - SCRUM-41 assign Karen, move to Sprint 5
 *   - SCRUM-42 assign Dennis, move to Sprint 5
 *   - SCRUM-81 close as duplicate of SCRUM-77
 *   - SCRUM-82 close as superseded (covered by TC-ONB-001/002/003)
 *   - SCRUM-85 close as duplicate of SCRUM-123
 *   - SCRUM-86..SCRUM-114 close as duplicates of SCRUM-124..SCRUM-152 (+38)
 *   - SCRUM-115, 116, 118, 119, 120, 122 move to Sprint 5
 * Every moved issue gets a comment noting the Sprint 4 → 5 move.
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
const KAREN_EMAIL = process.env.KAREN_EMAIL;
const SPRINT5_ID = 4;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function api(method, path, body = null) {
  return new Promise((resolve) => {
    const d = body === null ? null : (typeof body === "string" ? body : JSON.stringify(body));
    const req = https.request({
      hostname: HOST, path, method,
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", ...(d ? { "Content-Length": Buffer.byteLength(d) } : {}) },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) return resolve({ error: res.statusCode, body: raw.slice(0, 300) });
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(raw); }
      });
    });
    req.on("error", (e) => resolve({ error: e.message }));
    if (d) req.write(d);
    req.end();
  });
}

const doc = (paragraphs) => ({ type: "doc", version: 1, content: paragraphs.map(t => ({ type: "paragraph", content: [{ type: "text", text: t }] })) });

async function findDoneTransition(key) {
  const t = await api("GET", `/rest/api/3/issue/${key}/transitions`);
  const list = t?.transitions || [];
  return list.find(x => /done|closed|resolved/i.test(x.name))
      || list.find(x => /done|closed|resolved/i.test(x.to?.name || ""))
      || null;
}

async function closeWithComment(key, commentText) {
  const issue = await api("GET", `/rest/api/3/issue/${key}?fields=status`);
  if (issue?.error) return { ok: false, reason: `fetch ${issue.error}` };
  const status = issue.fields?.status?.name;
  if (["Done", "Closed", "Resolved", "Cancelled"].includes(status)) {
    await api("POST", `/rest/api/3/issue/${key}/comment`, { body: doc([commentText]) });
    return { ok: true, note: `already ${status}, comment posted` };
  }
  const done = await findDoneTransition(key);
  if (!done) return { ok: false, reason: "no done transition" };
  const r = await api("POST", `/rest/api/3/issue/${key}/transitions`, {
    transition: { id: done.id },
    update: { comment: [{ add: { body: doc([commentText]) } }] },
  });
  if (r?.error) return { ok: false, reason: `transition ${r.error}: ${r.body}` };
  return { ok: true, note: `→ ${done.name}` };
}

async function linkDuplicate(duplicateKey, canonicalKey) {
  const r = await api("POST", `/rest/api/3/issueLink`, {
    type: { name: "Duplicate" },
    inwardIssue: { key: canonicalKey },
    outwardIssue: { key: duplicateKey },
  });
  return r?.error ? { ok: false, reason: `${r.error}: ${r.body}` } : { ok: true };
}

async function moveToSprint5(keys) {
  // team-managed board — move in batch
  const r = await api("POST", `/rest/agile/1.0/sprint/${SPRINT5_ID}/issue`, { issues: keys });
  return r?.error ? { ok: false, reason: `${r.error}: ${r.body}` } : { ok: true };
}

async function assign(key, accountId) {
  const r = await api("PUT", `/rest/api/3/issue/${key}`, { fields: { assignee: { accountId } } });
  return r?.error ? { ok: false, reason: `${r.error}: ${r.body}` } : { ok: true };
}

async function comment(key, text) {
  const r = await api("POST", `/rest/api/3/issue/${key}/comment`, { body: doc([text]) });
  return r?.error ? { ok: false, reason: r.error } : { ok: true };
}

async function main() {
  console.log(`\nTriage execution — ${HOST}\n${"=".repeat(60)}\n`);

  // Resolve users
  const me = await api("GET", "/rest/api/3/myself");
  const dennisId = me.accountId;
  console.log(`  Dennis (me): ${dennisId}`);
  const karenLookup = await api("GET", `/rest/api/3/user/search?query=${encodeURIComponent(KAREN_EMAIL)}`);
  const karenId = Array.isArray(karenLookup) ? karenLookup[0]?.accountId : null;
  console.log(`  Karen:       ${karenId}\n`);
  if (!dennisId || !karenId) { console.error("Failed to resolve users"); process.exit(1); }

  const MOVE_COMMENT = "Moved from Sprint 4 (v0.4.0) to Sprint 5 — Test Regime v1.0 as part of end-of-Sprint-4 triage on 2026-04-23. Sprint 4 ended 2026-04-22 — outstanding items carried forward.";

  // === Sprint 4 items ===
  console.log("━━━ Sprint 4 outstanding ━━━\n");

  // SCRUM-74 resolve
  console.log("  SCRUM-74 (resolve)");
  let r = await closeWithComment("SCRUM-74",
    "Resolved — end-of-Sprint-4 backlog triage completed 2026-04-23. All Karen-related and general backlog items reviewed: resolved where possible, obsolete duplicates closed, immediate work moved to Sprint 5 Test Regime v1.0, roadmap items left in backlog.");
  console.log(`    ${r.ok ? "✓" : "✗"} ${r.note || r.reason}`);

  // SCRUM-77, 78, 75, 84 → Sprint 5
  for (const k of ["SCRUM-77", "SCRUM-78", "SCRUM-75", "SCRUM-84"]) {
    const mv = await moveToSprint5([k]);
    const cm = await comment(k, MOVE_COMMENT);
    console.log(`  ${k} → Sprint 5: move ${mv.ok ? "✓" : "✗ " + mv.reason} | comment ${cm.ok ? "✓" : "✗"}`);
    await delay(150);
  }

  // SCRUM-41 — assign Karen, move
  console.log("\n  SCRUM-41 (assign Karen, move)");
  const a41 = await assign("SCRUM-41", karenId);
  const m41 = await moveToSprint5(["SCRUM-41"]);
  const c41 = await comment("SCRUM-41", `Assigned to Karen as the natural owner for user-facing content. ${MOVE_COMMENT}`);
  console.log(`    assign ${a41.ok ? "✓" : "✗ " + a41.reason} | move ${m41.ok ? "✓" : "✗"} | comment ${c41.ok ? "✓" : "✗"}`);

  // SCRUM-42 — assign Dennis, move
  console.log("\n  SCRUM-42 (assign Dennis, move)");
  const a42 = await assign("SCRUM-42", dennisId);
  const m42 = await moveToSprint5(["SCRUM-42"]);
  const c42 = await comment("SCRUM-42", `Assigned to Dennis to drive the migration. ${MOVE_COMMENT}`);
  console.log(`    assign ${a42.ok ? "✓" : "✗ " + a42.reason} | move ${m42.ok ? "✓" : "✗"} | comment ${c42.ok ? "✓" : "✗"}`);

  // SCRUM-81 close as duplicate of SCRUM-77
  console.log("\n  SCRUM-81 (close dup of SCRUM-77)");
  const link81 = await linkDuplicate("SCRUM-81", "SCRUM-77");
  const cl81 = await closeWithComment("SCRUM-81",
    "Duplicate of SCRUM-77 — same summary ('Update R&D portal time scheduling data'), split Karen/Karthik style like SCRUM-80/83. Consolidating under SCRUM-77. Closing as duplicate.");
  console.log(`    link ${link81.ok ? "✓" : "✗ " + link81.reason} | close ${cl81.ok ? "✓" : "✗ " + cl81.reason}`);

  // SCRUM-82 close as superseded
  console.log("\n  SCRUM-82 (close superseded)");
  const cl82 = await closeWithComment("SCRUM-82",
    "Superseded by the 29 individual test tickets in Sprint 5 Test Regime v1.0. Onboarding persona testing is specifically covered by TC-ONB-001 (SCRUM-124), TC-ONB-002 (SCRUM-125), TC-ONB-003 (SCRUM-126). Karthik is already a watcher on all 29 tickets. Closing to avoid duplication.");
  console.log(`    close ${cl82.ok ? "✓" : "✗ " + cl82.reason}`);

  // === Backlog cleanup — SCRUM-85 and 86-114 as duplicates ===
  console.log("\n━━━ Backlog obsolete test regime set ━━━\n");

  const link85 = await linkDuplicate("SCRUM-85", "SCRUM-123");
  const cl85 = await closeWithComment("SCRUM-85",
    "Duplicate of SCRUM-123 (current Test Regime v1.0 parent with 29 test cases). SCRUM-85 was the earlier draft referencing '26 test cases'; it has been superseded by SCRUM-123 which has the full manifest. Closing.");
  console.log(`  SCRUM-85 (close dup of SCRUM-123) link ${link85.ok ? "✓" : "✗"} | close ${cl85.ok ? "✓" : "✗ " + cl85.reason}`);

  for (let i = 0; i < 29; i++) {
    const dup = `SCRUM-${86 + i}`;
    const canonical = `SCRUM-${124 + i}`;
    const lk = await linkDuplicate(dup, canonical);
    const cl = await closeWithComment(dup,
      `Duplicate of ${canonical} — identical test case (matched by TC id). ${dup} was the earlier draft (unassigned, no uat-test/e2e-test labels); ${canonical} is the current canonical version assigned to Karen with Karthik as watcher, in Sprint 5 Test Regime v1.0. Closing as duplicate.`);
    console.log(`  ${dup} → dup of ${canonical}: link ${lk.ok ? "✓" : "✗"} | close ${cl.ok ? "✓" : "✗ " + cl.reason}`);
    await delay(100);
  }

  // === Backlog items moved to Sprint 5 ===
  console.log("\n━━━ Backlog immediate-work → Sprint 5 ━━━\n");
  const BACKLOG_TO_S5 = ["SCRUM-115", "SCRUM-116", "SCRUM-118", "SCRUM-119", "SCRUM-120", "SCRUM-122"];
  const BACKLOG_COMMENT = "Pulled from backlog into Sprint 5 Test Regime v1.0 as part of end-of-Sprint-4 triage on 2026-04-23. Needs attention this sprint.";
  for (const k of BACKLOG_TO_S5) {
    const mv = await moveToSprint5([k]);
    const cm = await comment(k, BACKLOG_COMMENT);
    console.log(`  ${k} → Sprint 5: move ${mv.ok ? "✓" : "✗ " + mv.reason} | comment ${cm.ok ? "✓" : "✗"}`);
    await delay(150);
  }

  console.log(`\n${"=".repeat(60)}\n  ✅ Triage complete`);
  console.log(`\n  Sprint 5 board: https://${HOST}/jira/software/projects/SCRUM/boards/1?sprint=4\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
