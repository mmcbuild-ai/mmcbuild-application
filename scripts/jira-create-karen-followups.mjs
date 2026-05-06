#!/usr/bin/env node
/**
 * Create one Jira ticket per Karen test-feedback requirement.
 * Each is placed in the BACKLOG (no sprint) with a 'from-karen-feedback' label
 * and a reference back to the source test-case ticket.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function adfDoc(text) {
  return {
    type: "doc", version: 1,
    content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

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
      res.on("data", (c) => (raw += c));
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

const TICKETS = [
  {
    summary: "MMC Comply: accept additional upload formats (DWG, SKT, RVT, DOCX)",
    type: "Story", priority: "Medium",
    labels: ["from-karen-feedback", "comply", "uploads", "v0.5.0-candidate"],
    source: "SCRUM-127",
    body: `Karen feedback (SCRUM-127, 30 Apr 2026): "A 'valid' upload is assuming that they have PDF format, this needs to be expanded to DWG, SKT, RVT, Word format also."

Current state: file picker on /comply only accepts application/pdf.

Scope:
- DOCX: small lift — extract text via mammoth or similar, feed into existing analysis pipeline
- DWG / SKT / RVT: significant — these are CAD/BIM binary formats. Options: (a) use CloudConvert / Autodesk Forge to convert to PDF server-side then run existing pipeline; (b) require user to export to PDF in their CAD tool; (c) extract metadata + screenshot via headless CAD service.

Acceptance criteria:
- File picker accepts .pdf, .docx, .dwg, .skt, .rvt
- Each format runs through compliance analysis and produces equivalent report quality
- Clear error message if conversion fails
- TC-COMPLY-001 retest passes for all five formats

Dependencies / risks:
- CAD parsing requires third-party service or library — adds infra cost. Decide vendor before starting.
- Token cost may differ per format — confirm pricing model.`,
  },
  {
    summary: "MMC Comply: warn user when uploaded documents are insufficient for analysis",
    type: "Story", priority: "Medium",
    labels: ["from-karen-feedback", "comply", "ux", "v0.5.0-candidate"],
    source: "SCRUM-127",
    body: `Karen feedback (SCRUM-127, 30 Apr 2026): "No message comes up if you have not uploaded sufficient documents to complete the other module tasks ie: no plans, no plans with measurements, no elevations, etc."

Current state: Comply runs analysis against whatever is uploaded. If essential docs are missing the AI either guesses or produces a low-quality report — user has no warning before paying the run cost.

Scope:
- Define minimum doc set per analysis tier (e.g. plans + elevations + spec, vs plans-only, vs full set)
- Add a pre-analysis check: scan uploaded files, classify (plan / elevation / measurement / spec / etc.), flag missing essentials
- Show a banner before allowing "Run analysis": "Missing: floor plan with measurements, elevation views. Continue anyway? (Quality may be reduced.)"
- Allow override but log to analytics for product learning

Acceptance criteria:
- Upload set with only one PDF spec doc → user sees warning before paying for run
- Upload full set → no warning, analysis proceeds
- TC-COMPLY-001 follow-up retest by Karen confirms warning visible`,
  },
  {
    summary: "MMC Comply: pre-validate inputs at project-question level to reduce analysis fails",
    type: "Story", priority: "Medium",
    labels: ["from-karen-feedback", "comply", "ux", "v0.5.0-candidate"],
    source: "SCRUM-127",
    body: `Karen feedback (SCRUM-127, 30 Apr 2026): "There was too many fails in MMC Comply that could be resolved at the project question level."

Hypothesis: many compliance fails are not real non-compliance — they are missing project context the AI compensates for by assuming worst-case (e.g. "no climate zone specified → assume worst zone"). If the project intake form captured that context up-front, fewer fails.

Scope:
- Audit recent compliance reports for fails attributable to missing project context
- Identify the 5–10 highest-frequency missing inputs (climate zone, BAL rating, soil class, building class, storey count, etc.)
- Add those questions to the project creation / edit flow
- Pass answers into the compliance prompt so the AI uses ground truth instead of worst-case assumptions

Acceptance criteria:
- 30%+ reduction in fails on Karen's existing test plans after re-running with project context populated
- New fields persisted to projects table; visible/editable on project page`,
  },
  {
    summary: "MMC Comply: add Word/DOCX export option for compliance reports",
    type: "Story", priority: "Medium",
    labels: ["from-karen-feedback", "comply", "exports", "word-export", "v0.5.0-candidate"],
    source: "SCRUM-127, SCRUM-131",
    body: `Karen feedback (SCRUM-127 + SCRUM-131, 30 Apr 2026): "Export format should also include Word format for editing." / "Compliance report did export out correctly as a PDF. It would have been good to also have a Word format option as well so they can edit it."

Current state: PDF export only (jspdf). Karen has now requested Word export THREE times across Comply + Quote modules.

Scope:
- Add docx library (e.g. 'docx' npm package, server-side generation)
- Port existing compliance report layout from jspdf to docx — section headers, tables, citations
- Add "Export as Word" button alongside existing "Export as PDF"
- Increment src/lib/report-versions.ts compliance report version with reason

Acceptance criteria:
- Generated .docx opens in Word, looks visually consistent with PDF version
- All NCC citations preserved as hyperlinks
- Tables editable in Word
- TC-COMPLY-005 extended with Word export verification

Decision needed before implementation: confirm Word is on roadmap (Karen's repeated requests indicate yes; Dennis to ratify scope at 30 Apr meeting).`,
  },
  {
    summary: "MMC Quote: add Word/DOCX export option for quote reports",
    type: "Story", priority: "Medium",
    labels: ["from-karen-feedback", "quote", "exports", "word-export", "v0.5.0-candidate"],
    source: "SCRUM-137",
    body: `Karen feedback (SCRUM-137, 30 Apr 2026): "Yes the quote exports out as a PDF successfully. I would also be nice to have an option to export in Word format so they can edit it afterwards."

Sister ticket to the Comply Word-export item. Same library, same pattern — implement together as a v0.5.0 deliverable.

Scope:
- Reuse the docx generation utility built for compliance reports
- Port quote report layout (line items table, totals, rate sources, project header) to docx
- Add "Export as Word" button to /quote results page
- Increment src/lib/report-versions.ts quote report version

Acceptance criteria:
- Quote .docx export contains identical line items, totals, rate-source footnotes as PDF
- Editable in Word for builders sending to clients
- TC-QUOTE-002 extended with Word export verification`,
  },
  {
    summary: "MMC Quote: SIP selection produces wrong Wall data; fence MMC line item appears unexpectedly",
    type: "Bug", priority: "High",
    labels: ["from-karen-feedback", "quote", "data-integrity", "v0.4.x-hotfix-candidate"],
    source: "SCRUM-138",
    body: `Karen feedback (SCRUM-138, 30 Apr 2026): "We need to get clarity about what the quote was based on. If SIP was selected, then the data for Wall is not correct and why fence MMC was included."

Two distinct defects in one quote run:
1. WALL DATA WRONG — when SIP (Structural Insulated Panel) is selected as the wall system, the Wall line items in the quote do not reflect SIP material costs. Either SIP is not mapped to a cost reference rate, or the rate lookup is falling back to a default wall cost.
2. UNEXPECTED FENCE LINE — MMC fencing appearing in a quote where the project did not specify fencing. Either a default scope item is being added, or material selection is bleeding across categories.

Investigation steps:
1. Reproduce: rebuild Karen's last project with SIP wall selected, no fence — observe quote output
2. Check src/lib/ai/agent/tools/lookup-cost-rate.ts for SIP material code mapping
3. Check src/lib/ai/agent/tools/* for any default-scope additions
4. Check the cost_reference_rates table for SIP rows; compare to what other wall systems return

Severity: HIGH — quote data integrity is the trust spine of MMC Quote. Any wrong number erodes adoption.`,
  },
  {
    summary: "Test infra: provide testers a path to reach Build module empty-state (unblocks TC-BUILD-003)",
    type: "Task", priority: "Medium",
    labels: ["from-karen-feedback", "test-regime", "build", "v0.5.0-candidate"],
    source: "SCRUM-134",
    body: `Karen blocker (SCRUM-134, 30 Apr 2026): "I can't complete this test as I have already got projects under my login." / "Can't complete this test as I already have saved projects."

TC-BUILD-003 verifies the empty-state redirect when a user has no projects. Karen (and any returning tester) cannot reach that state without deleting all their projects, which is destructive and unattractive.

Three options for tonight's discussion:
1. Provision a second test login per tester with zero projects — fastest, no product change
2. Add an admin "delete all my projects" action testers can run before each retest — moderate, code change
3. Adopt a per-tester "test workspace" that resets between QA runs — heavier, but reusable for future regression testing

Recommendation: Option 1 for Sprint 5 unblock; Option 3 as v0.6.0+ infrastructure investment.`,
  },
  {
    summary: "Verify trial run-counter initialisation for Karen's account (unblocks TC-COMPLY-003)",
    type: "Task", priority: "Low",
    labels: ["from-karen-feedback", "billing", "verification"],
    source: "SCRUM-129",
    body: `Karen question (SCRUM-129, 30 Apr 2026): "I had a trial end but I am not sure if the 10 runs had been setup against my login from the beginning?"

Likely no product bug — just need to verify her account in Supabase and post evidence to SCRUM-129.

Steps:
1. Query organisations row for Karen's org_id: trial_started_at, trial_usage_count, trial_ends_at
2. Query billing_events log for her org for the run-counter increments
3. Post screenshot / table to SCRUM-129 confirming counter behaviour
4. If counter was indeed off → real bug, escalate

Owner: Dennis. Estimated 15 minutes.`,
  },
];

const main = async () => {
  console.log(`Creating ${TICKETS.length} Karen-feedback follow-up tickets in ${PROJECT_KEY}...\n`);
  const created = [];
  for (const t of TICKETS) {
    const description = `Source: ${t.source}\n\n${t.body}`;
    const r = await api("POST", "/rest/api/3/issue", {
      fields: {
        project: { key: PROJECT_KEY },
        summary: t.summary,
        description: adfDoc(description),
        issuetype: { name: t.type },
        labels: t.labels,
        priority: { name: t.priority },
      },
    });
    if (r.body?.key) {
      console.log(`✓ ${r.body.key.padEnd(12)} [${t.type.padEnd(5)}] ${t.priority.padEnd(6)} ${t.summary.slice(0, 60)}`);
      created.push({ key: r.body.key, source: t.source, summary: t.summary });
    } else {
      console.log(`✗ FAILED   ${t.summary.slice(0, 60)}`);
      console.log(`  ${JSON.stringify(r.body).slice(0, 300)}`);
    }
  }
  console.log(`\n${created.length}/${TICKETS.length} created.`);
  console.log("\nFor agenda update:");
  for (const c of created) console.log(`  - ${c.key} (from ${c.source}) — ${c.summary}`);
};
main().catch(e => { console.error(e); process.exit(1); });
