#!/usr/bin/env node
/**
 * Find every open SCRUM ticket without an assignee, pick a sensible owner,
 * post the standard "raised but not pushed" comment asking the owner to
 * confirm whether the ticket is still required, can be deleted, or has
 * been subsumed.
 *
 * Heuristic for picking the owner:
 *   - Karthik    : stage gates (financial milestones), explicit Figma
 *                  integration tickets
 *   - Karen      : Figma design tickets, icons / subheaders / persona /
 *                  empty-description UX tickets she likely raised
 *   - Dennis     : default — code, bugs, features, anything technical
 *
 * Skips: Epic, Subtask, anything already assigned, anything labelled
 *        do-not-sweep, completed tickets.
 *
 * Modes:
 *   (default)   Dry run — print the assignment plan, no Jira writes
 *   --apply     Apply assignments and post comments
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...r] = line.split("=");
    if (k && r.length && !process.env[k.trim()])
      process.env[k.trim()] = r.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`
).toString("base64");

const APPLY = process.argv.includes("--apply");

const OWNERS = {
  Dennis:  { id: "712020:501aa73c-b0d8-405d-ab46-55a283207709", name: "Dennis"  },
  Karthik: { id: "607e5479074a0b006a5b2873",                    name: "Karthik" },
  Karen:   { id: "712020:394dbedd-1ff0-48c1-ab5d-4f6a49136935", name: "Karen"   },
};

// ---- per-owner comment templates -------------------------------------------
const STD_COMMENT_EXTERNAL = (name) =>
  `${name} — this was raised but hasn't been pushed forward. Tagging you as the owner during the 2026-05-05 ticket sweep.\n\nCan you confirm one of:\n  1. Still required → leave as-is, I'll factor it into Sprint 6 planning\n  2. Can be deleted → reply "delete" and I'll close it\n  3. Subsumed by another ticket → reply with the SCRUM-NN it should link to and I'll close as duplicate\n\nNo action = remains open and orphaned, which is what we're trying to stop. Please respond before the next sweep.`;

const STD_COMMENT_DENNIS = () =>
  `Tracking — added you as owner during the 2026-05-05 ticket sweep so this stops being orphaned.\n\nDecide before Sprint 6 planning:\n  1. Schedule into Sprint 6 → move to In Progress when started\n  2. Long-term backlog → leave as-is\n  3. Delete or close as superseded → action and resolve\n\nAny ticket without an owner that hasn't been touched in 30 days will surface again on the next jira-sweep run.`;

// ---- per-ticket explicit overrides (where heuristic is uncertain) ----------
// Anything not listed here falls through to the heuristic.
const OVERRIDES = {
  // Stage gates — Karthik handles GBTA financial milestones
  "SCRUM-63":  "Karthik",
  "SCRUM-64":  "Karthik",
  "SCRUM-65":  "Karthik",
  "SCRUM-66":  "Karthik",
  // Figma integration work — Karthik historically owned this thread
  "SCRUM-116": "Karthik",
  // UX design / Figma work Karen raised
  "SCRUM-119": "Karen",
  "SCRUM-120": "Karen",
  // Karen-raised questionnaire rename — likely now obsolete (already commented)
  "SCRUM-176": "Karen",
};

// ---- heuristic --------------------------------------------------------------
function pickOwner(issue) {
  if (OVERRIDES[issue.key]) return OWNERS[OVERRIDES[issue.key]];
  const summary = issue.fields?.summary || "";
  const lower = summary.toLowerCase();
  // Test case stories — Karen owns the test sign-offs
  if (summary.startsWith("[TC-")) return OWNERS.Karen;
  // Anything Figma / design / subheader → Karen
  if (/figma|subheader|design mockup|colour|color palette/.test(lower)) {
    return OWNERS.Karen;
  }
  // Default: Dennis (sole engineer)
  return OWNERS.Dennis;
}

// ---- http -------------------------------------------------------------------
function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request(
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
          let parsed = null;
          if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) r.write(data);
    r.end();
  });
}

const adfDoc = (text) => ({
  type: "doc",
  version: 1,
  content: text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  })),
});

// ---- main -------------------------------------------------------------------
async function main() {
  // All open tickets in the project
  const jql = encodeURIComponent(
    `project=${PROJECT} AND statusCategory != Done AND assignee is EMPTY ORDER BY key DESC`
  );
  const r = await req(
    "GET",
    `/rest/api/3/search/jql?jql=${jql}&fields=summary,status,issuetype,labels&maxResults=200`
  );
  const issues = r.body?.issues || [];

  const plan = [];
  for (const i of issues) {
    const type = i.fields?.issuetype?.name || "";
    const labels = i.fields?.labels || [];
    if (type === "Epic" || type === "Subtask") continue;
    if (labels.includes("do-not-sweep")) continue;

    const owner = pickOwner(i);
    plan.push({
      key: i.key,
      summary: i.fields?.summary || "",
      type,
      status: i.fields?.status?.name,
      ownerKey: Object.entries(OWNERS).find(([, v]) => v.id === owner.id)[0],
      ownerId: owner.id,
    });
  }

  // Print plan
  console.log(`Orphan-assignment plan: ${plan.length} ticket(s)\n`);
  const byOwner = { Dennis: [], Karthik: [], Karen: [] };
  for (const p of plan) byOwner[p.ownerKey].push(p);

  for (const o of ["Karthik", "Karen", "Dennis"]) {
    if (!byOwner[o].length) continue;
    console.log(`\n=== → ${o} (${byOwner[o].length}) ===`);
    for (const p of byOwner[o]) {
      console.log(`  ${p.key.padEnd(11)} [${p.type.padEnd(7)}] ${p.summary.slice(0, 75)}`);
    }
  }

  if (!APPLY) {
    console.log("\n---\nDry run. Re-run with --apply to assign and comment.");
    return;
  }

  // Apply
  console.log("\n---\nApplying...");
  let ok = 0, fail = 0;
  for (const p of plan) {
    const a = await req("PUT", `/rest/api/3/issue/${p.key}`, {
      fields: { assignee: { accountId: p.ownerId } },
    });
    if (a.status >= 400) {
      console.log(`  ✗ ${p.key} assignee → ${p.ownerKey} (${a.status}): ${JSON.stringify(a.body).slice(0, 150)}`);
      fail++;
      continue;
    }

    const comment = p.ownerKey === "Dennis"
      ? STD_COMMENT_DENNIS()
      : STD_COMMENT_EXTERNAL(p.ownerKey);
    const c = await req("POST", `/rest/api/3/issue/${p.key}/comment`, { body: adfDoc(comment) });
    if (c.status >= 400) {
      console.log(`  ✗ ${p.key} comment failed (${c.status})`);
      fail++;
    } else {
      console.log(`  ✓ ${p.key} → ${p.ownerKey}`);
      ok++;
    }
  }
  console.log(`\nApplied ${ok}, failed ${fail}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
