#!/usr/bin/env node
/**
 * Create tickets arising from MMC Build meeting on 2026-05-06 (Dennis + Karthik).
 * - Creates Sprint 6 if missing
 * - Creates 12 tickets, assigns, places into correct sprint
 * - Adds comment to SCRUM-120 noting logo shipped in a8c4631
 * - Adds comment to SCRUM-42 linking new prep tickets
 *
 * Run: node scripts/jira-create-meeting-2026-05-06.mjs
 *      node scripts/jira-create-meeting-2026-05-06.mjs --dry  (preview only)
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
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
const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");
const DRY = process.argv.includes("--dry");

const DENNIS = "712020:501aa73c-b0d8-405d-ab46-55a283207709";
const KAREN = "712020:394dbedd-1ff0-48c1-ab5d-4f6a49136935";
const KARTHIK = "607e5479074a0b006a5b2873";

const COMMON_LABELS = ["meeting-2026-05-06", "migration-mmcbuild"];

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: {
        Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => {
        let parsed = null;
        if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

function adfDoc(text) {
  return {
    type: "doc", version: 1,
    content: text.split("\n\n").map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

const TICKETS = [
  // ---- Sprint 5 (small / due now) ----
  {
    sprintTier: 5,
    summary: "[Migration prep] High-level design doc — Vercel + Supabase + Git architecture (with diagrams)",
    type: "Story", priority: "High", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik to produce a high-level design document covering the intended end-state of the MMC Build platform stack: Vercel (hosting both marketing site and app), Supabase (Auth + DB, Sydney region), Git repos (web + app), and the feature → release → main branching model.

Includes diagrams so the architecture is unambiguous before Sprint 7 ticket-breakdown begins.

Done when: doc is shared with Dennis and Karen for review and signoff.

Blocks: most Sprint 6/7 migration tickets.`,
  },
  {
    sprintTier: 5,
    summary: "[Migration prep] Write migration narrative + objectives for Dennis to break into Sprint 7 tickets",
    type: "Task", priority: "High", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik to write up the full narrative and objectives for the Base44 → Vercel/Supabase migration. Dennis prefers receiving a single narrative + objectives doc and will then split it into Sprint 7 tickets himself.

Done when: narrative is shared with Dennis (Confluence or shared doc OK) so he can ticket-break into Sprint 7.`,
  },
  {
    sprintTier: 5,
    summary: "[Migration prep] Send Karthik the list of Base44 repo files to migrate (linked to SCRUM-42)",
    type: "Task", priority: "Medium", assignee: DENNIS,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik raised this in the meeting — clarification that the migration target is "everything currently on the Base44-hosted site", with all Base44 references stripped and re-pointed at Vercel. No file-by-file selection needed; Dennis to confirm in writing on SCRUM-42.

Done when: comment on SCRUM-42 confirms scope = full site migration, Base44 refs eliminated.`,
  },
  {
    sprintTier: 5,
    summary: "[Migration prep] Document MMC Build guardrails + AI development process for Karthik review",
    type: "Task", priority: "Medium", assignee: DENNIS,
    body: `Source: meeting with Dennis on 2026-05-06.

Dennis offered to write up the guardrails and process currently used (CLAUDE.md global + project, gstack skills, sandbox/test/prod flow, security gate, paywall layering, etc.) so Karthik can cross-check and feed it into the production-ready VC-pack documentation.

Done when: docs/process-guardrails.md (or equivalent) shared with Karthik.`,
  },
  {
    sprintTier: 5,
    summary: "[Migration prep] Spin up Vercel + Supabase clone on Dennis's account as source-of-truth merge env",
    type: "Task", priority: "Medium", assignee: DENNIS,
    body: `Source: meeting with Dennis on 2026-05-06.

Dennis to first migrate Base44 → Vercel/Supabase under his own account (sandbox), so the merged "everything in one place" repo becomes the source of truth before cloning into MMC Build accounts. Phase 1 plan: Dennis sandbox = test, MMC accounts = prod (interim). Phase 2 (later): both test + prod under MMC.

Done when: site is live on Dennis's Vercel + Supabase, Base44 references stripped, ready to clone into MMC accounts (which Karthik provisions via the linked story).`,
  },
  {
    sprintTier: 5,
    summary: "[Migration prep] Brief Karen on additional account costs (Workspace seats + Vercel + Supabase)",
    type: "Task", priority: "Medium", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik will need additional Google Workspace accounts (one per service, to avoid using the admin account everywhere — security/blast-radius). He needs to pre-warn Karen about the recurring cost increase.

Done when: Karen acknowledges and approves the cost.`,
  },

  // ---- Sprint 6 (larger / sequenced) ----
  {
    sprintTier: 6,
    summary: "[Migration] Provision Vercel + Supabase + GitHub repos under MMC Build credentials, share access",
    type: "Story", priority: "High", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik to create new Vercel and Supabase accounts using MMC Build credentials (not personal), and share access with Dennis. Stack target: Vercel hosts marketing site + app, Supabase (Sydney region) handles Auth + DB + Storage, GitHub repo under MMC Build org.

Note: this creates the prod-side environment Dennis will clone his sandbox into. Depends on cost approval (separate ticket: brief Karen on costs).

Done when: Dennis can deploy a "hello world" change end-to-end through the new MMC Build stack.`,
  },
  {
    sprintTier: 6,
    summary: "[Migration] Break Karthik's migration narrative into Sprint 7 tickets",
    type: "Task", priority: "High", assignee: DENNIS,
    body: `Source: meeting with Dennis on 2026-05-06.

Once Karthik delivers the migration narrative + objectives, Dennis will split it into discrete Sprint 7 tickets covering: account provisioning handover, repo migration, deployment, DNS cutover, HubSpot relink, post-cutover verification.

Blocked by: Karthik's narrative writeup (Sprint 5 ticket).`,
  },
  {
    sprintTier: 6,
    summary: "[Migration] Re-link HubSpot ↔ website integration after Base44 cutover",
    type: "Story", priority: "Medium", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Base44 currently hosts the marketing site forms and pushes submissions into HubSpot. Migration off Base44 will break that integration. Karthik to re-establish HubSpot form-submission flow from the new Vercel-hosted site.

Done when: a form submission on the new Vercel site creates an entry in HubSpot, end-to-end.`,
  },
  {
    sprintTier: 6,
    summary: "[Migration] Create separate Google Workspace accounts per service (security blast-radius)",
    type: "Story", priority: "Medium", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik wants per-service Google Workspace accounts (e.g. one each for Vercel, Supabase, GitHub admin) rather than reusing the MMC Build admin account everywhere — so a single account compromise doesn't take the whole stack with it.

Depends on: Karen's cost approval (separate ticket).

Done when: each external service the platform depends on has its own dedicated Workspace identity, with credentials stored in the team password manager.`,
  },
  {
    sprintTier: 6,
    summary: "[VC] Infosec + data-residency tech doc for VC due diligence (Supabase Sydney)",
    type: "Story", priority: "High", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Karthik to write the technical documentation that goes into the VC due-diligence pack. Covers: data residency (Supabase DB + Storage in Sydney/AWS ap-southeast-2), authentication, RLS posture, environment isolation (test vs prod), secrets handling, deployment posture, incident response basics.

This is timing-critical — VC outreach starts in the next few weeks per the meeting.

Done when: doc is shared with Dennis for review and is in a state we'd hand to a prospective investor.`,
  },
  {
    sprintTier: 6,
    summary: "[Migration] Define + document feature → release → main branching workflow + PR approver rules",
    type: "Task", priority: "Medium", assignee: KARTHIK,
    body: `Source: meeting with Dennis on 2026-05-06.

Three-stage process agreed in the meeting:
- feature branch — Dennis pushes work
- release branch — PR from feature; approver = Karthik or Karen + Dennis; (later: automated tests gate)
- main / master — PR from release; second approval; protected branch

Karthik to set this up on the MMC Build GitHub repo (branch protection rules, required reviewers, merge restrictions) and document the workflow so Dennis can follow it consistently.

Automated tests on the release branch are explicitly deferred until the platform is more complex.

Done when: branch protection is enforced on the MMC Build repo and the workflow doc is in the team's docs.`,
  },
];

async function ensureSprint6(boardId) {
  const future = await api("GET", `/rest/agile/1.0/board/${boardId}/sprint?state=future`);
  const existing = (future.body?.values || []).find((s) => /sprint\s*6/i.test(s.name));
  if (existing) {
    console.log(`Sprint 6 already exists: [${existing.id}] ${existing.name}`);
    return existing.id;
  }
  console.log(`Creating Sprint 6...`);
  if (DRY) return "DRY-RUN-S6-ID";
  const created = await api("POST", `/rest/agile/1.0/sprint`, {
    name: "Sprint 6 — Base44 → Vercel/Supabase migration",
    originBoardId: boardId,
    goal: "Lock the migration plan, provision MMC-owned infrastructure, prepare VC due-diligence pack — so Sprint 7 can execute the cutover cleanly.",
  });
  if (created.body?.id) {
    console.log(`  ok Sprint 6 id ${created.body.id}`);
    return created.body.id;
  }
  console.error(`  ERROR creating Sprint 6: ${JSON.stringify(created.body).slice(0, 400)}`);
  return null;
}

async function findActiveSprint(boardId) {
  const r = await api("GET", `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
  return r.body?.values?.[0]?.id || null;
}

async function createIssue(t) {
  const fields = {
    project: { key: PROJECT },
    summary: t.summary,
    description: adfDoc(t.body),
    issuetype: { name: t.type },
    priority: { name: t.priority },
    assignee: { accountId: t.assignee },
    labels: COMMON_LABELS,
  };
  if (DRY) {
    console.log(`  DRY ${t.type.padEnd(5)} -> Sprint ${t.sprintTier}  [${t.assignee.slice(-4)}]  ${t.summary}`);
    return { key: `DRY-${Math.random().toString(36).slice(2, 6).toUpperCase()}` };
  }
  const r = await api("POST", `/rest/api/3/issue`, { fields });
  if (r.body?.key) {
    console.log(`  ok ${r.body.key.padEnd(11)} S${t.sprintTier}  ${t.summary}`);
    return { key: r.body.key };
  }
  console.error(`  ERROR creating "${t.summary}": ${JSON.stringify(r.body).slice(0, 400)}`);
  return null;
}

async function moveToSprint(sprintId, keys) {
  if (!keys.length) return;
  if (DRY) {
    console.log(`  DRY move ${keys.length} issues -> sprint ${sprintId}`);
    return;
  }
  const r = await api("POST", `/rest/agile/1.0/sprint/${sprintId}/issue`, { issues: keys });
  if (r.status >= 200 && r.status < 300) console.log(`  ok moved ${keys.length} issues into sprint ${sprintId}`);
  else console.error(`  ERROR moving to sprint ${sprintId}: ${JSON.stringify(r.body).slice(0, 400)}`);
}

async function comment(issueKey, text) {
  if (DRY) {
    console.log(`  DRY comment on ${issueKey}: ${text.slice(0, 80)}...`);
    return;
  }
  const r = await api("POST", `/rest/api/3/issue/${issueKey}/comment`, { body: adfDoc(text) });
  if (r.status >= 200 && r.status < 300) console.log(`  ok commented on ${issueKey}`);
  else console.error(`  ERROR comment on ${issueKey}: ${JSON.stringify(r.body).slice(0, 200)}`);
}

async function main() {
  console.log(`MMC Build meeting 2026-05-06 — Jira ticket creation`);
  console.log(`Mode: ${DRY ? "DRY RUN" : "LIVE"}`);
  console.log(`Project: ${PROJECT}\n`);

  const boards = await api("GET", `/rest/agile/1.0/board?projectKeyOrId=${PROJECT}`);
  const boardId = boards.body?.values?.[0]?.id;
  if (!boardId) { console.error("No board found"); process.exit(1); }
  console.log(`Board id: ${boardId}\n`);

  const sprint5Id = await findActiveSprint(boardId);
  console.log(`Active sprint id (Sprint 5): ${sprint5Id}`);
  const sprint6Id = await ensureSprint6(boardId);
  console.log(`Sprint 6 id: ${sprint6Id}\n`);

  console.log(`--- Creating ${TICKETS.length} issues ---`);
  const created = [];
  for (const t of TICKETS) {
    const c = await createIssue(t);
    if (c) created.push({ ...c, sprintTier: t.sprintTier });
  }

  console.log(`\n--- Sprint placement ---`);
  const s5keys = created.filter((c) => c.sprintTier === 5).map((c) => c.key);
  const s6keys = created.filter((c) => c.sprintTier === 6).map((c) => c.key);
  if (sprint5Id) await moveToSprint(sprint5Id, s5keys);
  if (sprint6Id && sprint6Id !== "DRY-RUN-S6-ID") await moveToSprint(sprint6Id, s6keys);

  console.log(`\n--- Cross-references ---`);
  await comment("SCRUM-120",
    "Logo work shipped in commit a8c4631 (feat(brand): add MMC Build logo across app). Closing this ticket — please verify and resolve. Tracked under meeting label meeting-2026-05-06."
  );
  const fileListKey = created.find((c) => c.sprintTier === 5 && /file-list|files to migrate/i.test(""))?.key;
  await comment("SCRUM-42",
    `Meeting 2026-05-06 with Karthik confirmed scope: full Base44 site migrates to Vercel; all Base44 refs stripped. No file-by-file selection needed. New Sprint 5/6 prep + migration tickets created under label meeting-2026-05-06.`
  );

  console.log(`\n--- Summary ---`);
  console.log(`Sprint 5 (${s5keys.length}): ${s5keys.join(", ")}`);
  console.log(`Sprint 6 (${s6keys.length}): ${s6keys.join(", ")}`);

  if (!DRY) {
    const out = join(process.cwd(), "scripts/.jira-meeting-2026-05-06-state.json");
    writeFileSync(out, JSON.stringify({ sprint5Id, sprint6Id, created, ranAt: new Date().toISOString() }, null, 2));
    console.log(`\nState saved: ${out}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
