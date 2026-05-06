#!/usr/bin/env node
/**
 * Action Karen's 2026-04-28 → 2026-04-30 test-pass feedback.
 *
 * Phase 1 — create five follow-up tickets (returned keys captured for use in phase 2):
 *   A) Onboarding regression — persona selection broken on first login (Bug, High)   [SCRUM-124]
 *   B) Comply file-format support — DWG/SKT/RVT/Word + PDF                            [SCRUM-127, 128]
 *   C) Comply empty-state messaging when uploaded plans incomplete                    [SCRUM-127]
 *   D) Comply project-questionnaire surface fixes to reduce downstream fails          [SCRUM-127]
 *   E) Quote bug — SIP wall data incorrect; fence MMC included unexpectedly           [SCRUM-138]
 *
 * Phase 2 — comment on Karen's open feedback threads:
 *   SCRUM-124, 127, 128, 129, 131, 132, 133, 134, 137, 138
 *
 * Word-export asks (Karen on SCRUM-131 + SCRUM-137) → already shipped in
 * SCRUM-156/SCRUM-157 (commit 01d2e70). Comment points her at the existing button.
 *
 * Run: node scripts/jira-action-karen-test-pass.mjs [--dry-run]
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
const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

function adfDoc(text) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
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
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

const postComment = (key, body) =>
  api("POST", `/rest/api/3/issue/${key}/comment`, { body: adfDoc(body) });

async function createTicket(t) {
  return api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: t.summary,
      description: adfDoc(t.body),
      issuetype: { name: t.type },
      labels: t.labels,
      priority: { name: t.priority },
    },
  });
}

// ---------------------------------------------------------------------------
// PHASE 1 — tickets to create
// ---------------------------------------------------------------------------

const TICKETS = {
  A: {
    summary: "Onboarding regression: persona selection no longer working on first login",
    type: "Bug",
    priority: "High",
    labels: ["karen-feedback-2026-04-30", "onboarding", "regression", "comply"],
    body: `Reported by Karen on SCRUM-124 (TC-ONB-001) on 2026-04-28:

  "This is no longer working on login but is still in settings."

The first-login persona selection redirect (covered by TC-ONB-001 / SCRUM-124, closed Done 2026-04-13) has regressed. Persona selection still works inside Settings, but the post-registration onboarding flow is no longer routing new users through it.

Acceptance criteria:
  - New registration → redirect to /onboarding/persona before first dashboard render
  - Persona save persists to profiles.persona and onboarding_completed_at
  - Existing users with persona already set are not re-prompted
  - Add/restore E2E coverage (tests/e2e/onboarding.spec.ts) so this regression is caught next time

Likely root cause to investigate first: middleware order / persona-set check after the recent dashboard parallelisation work (commit ed4375f). Also check src/app/(auth)/actions.ts — onboarding redirect logic may have been bypassed by the prefetched-magic-link tolerance fix (commit 5b7d09e).`,
  },
  B: {
    summary: "Comply: accept additional plan formats (DWG, SKT, RVT, Word) — currently PDF only",
    type: "Story",
    priority: "Medium",
    labels: ["karen-feedback-2026-04-30", "comply", "uploads", "file-format", "icp-architects"],
    body: `Reported by Karen on SCRUM-127 (TC-COMPLY-001) and SCRUM-128 (TC-COMPLY-002) on 2026-04-30:

  "A 'valid' upload is assuming that they have PDF format, this needs to be expanded to DWG, SKT, RVT, Word format also."
  "Only PDF files appear for uploading."

Our ICP is architects/designers. Their working files are SketchUp (.skp), Revit (.rvt), AutoCAD (.dwg), and Word — not PDF. PDF-only upload forces them to export their working file to PDF before they can use Comply, adding friction at exactly the moment we want them to engage.

Scope:
  - Accept .dwg, .skp (SketchUp), .rvt (Revit), .doc/.docx in the upload picker
  - For each non-PDF format, extract a renderable representation server-side (or render via a worker) before passing to the compliance pipeline
  - Pricing/cost considerations: rasterising DWG/RVT at scale is non-trivial — may need a background job (Inngest, > 5s) and a "processing" state in the UI
  - Update accept attribute on FileInput + the "Only PDF" placeholder copy
  - Update SCRUM-127/SCRUM-128 test fixtures to include each new format

Watch-outs:
  - DWG/RVT render libraries are usually commercial. Consider Autodesk Forge / APS (paid) or an open-source viewer with limitations.
  - Document the format-coverage matrix (which features work on which formats) somewhere visible to architect users — partial support is worse than honest "PDF only for now".`,
  },
  C: {
    summary: "Comply: empty-state guidance when uploaded plans are incomplete",
    type: "Story",
    priority: "Medium",
    labels: ["karen-feedback-2026-04-30", "comply", "ux", "empty-state"],
    body: `Reported by Karen on SCRUM-127 (TC-COMPLY-001) on 2026-04-30:

  "No message comes up if you have not uploaded sufficient documents to complete the other module tasks ie: no plans, no plans with measurements, no elevations, etc."

Today, Comply runs the AI pipeline regardless of whether the upload contains the inputs each downstream module needs. The user only finds out something is missing when MMC Build / MMC Quote silently produce thin or empty outputs further downstream.

Acceptance:
  - After upload, Comply should detect and surface what's missing (no floor plans, no elevations, no dimensions visible, no schedule of finishes, etc.)
  - Show a checklist at upload-completion time: "We found ✓ floor plans, ✓ elevations, ✗ no dimensions detected — Quote and Build will be limited"
  - User can choose to (a) re-upload with missing assets, (b) proceed anyway with the limitation acknowledged, (c) cancel
  - Detection signal can come from the existing extraction pipeline (no new AI model needed) — flag what was/wasn't found and surface those flags in the UI

This unblocks two things downstream: clearer expectations for Quote/Build outputs, and better quality complaints (Karen's instinct that "too many fails could be resolved at the project question level" — see related ticket).`,
  },
  D: {
    summary: "Comply: surface project-questionnaire fixes for common compliance fails",
    type: "Story",
    priority: "Medium",
    labels: ["karen-feedback-2026-04-30", "comply", "ux", "questionnaire"],
    body: `Reported by Karen on SCRUM-127 (TC-COMPLY-001) on 2026-04-30:

  "There was too many fails in MMC Comply that could be resolved at the project question level"

A meaningful fraction of compliance fails are not actually plan defects — they're missing or wrong answers in the project questionnaire (climate zone, wind region, BAL rating, soil class, building class, exposure category, etc.) that the compliance engine then mis-applies against the plan.

Acceptance:
  - When a fail is determined to depend on a questionnaire answer, the compliance report links inline to the specific questionnaire question, not just the NCC clause
  - Surface a "Re-run with corrected answer" affordance on the report row, not just a generic "edit project"
  - Track the click-through rate from compliance-fail → questionnaire-edit, to validate this is actually moving the needle on Karen's complaint

Concrete first cut: tag each rule in the compliance ruleset with the questionnaire fields it depends on; when a fail fires, map back to those fields and render the deep-link.`,
  },
  E: {
    summary: "Quote bug: SIP wall data incorrect; fence MMC line item included unexpectedly",
    type: "Bug",
    priority: "High",
    labels: ["karen-feedback-2026-04-30", "quote", "correctness"],
    body: `Reported by Karen on SCRUM-138 (TC-QUOTE-003) on 2026-04-30:

  "We need to get clarity about what the quote was based on. If SIP was selected, then the data for Wall is not correct and why fence MMC was included."

This is a quote engine correctness bug, not UX. Two distinct issues in the same report:

  1. Wall material data is wrong when SIP (Structural Insulated Panel) is selected as the wall system. Either the wrong material catalogue rate is being looked up, or SIP-specific wall thickness/area calculations aren't being applied.

  2. A fence MMC line item appears in the output even though no fence was selected. Either the line-item generator has an unconditional fence inclusion, or there is a miscategorisation upstream (something is being detected as "fence" and routed through fence-MMC pricing).

Investigation notes:
  - Start at src/app/(dashboard)/quote/actions.ts and the cost-estimate Inngest function
  - Check the materials → line items mapping — likely lives in a router function near the quote engine entrypoint
  - Pull the actual report Karen tested to confirm both issues — Karen, can you attach the PDF/Word from your 2026-04-30 test run, or share the project ID, so we can reproduce against your data?

Regression test: once fixed, add a unit test covering "SIP-only wall selection → no fence MMC, correct wall data" so this can't recur silently.`,
  },
};

// ---------------------------------------------------------------------------
// PHASE 2 — comment templates (build at runtime so they can include new keys)
// ---------------------------------------------------------------------------

function buildComments(newKeys) {
  const A = newKeys.A || "(creation failed)";
  const B = newKeys.B || "(creation failed)";
  const C = newKeys.C || "(creation failed)";
  const D = newKeys.D || "(creation failed)";
  const E = newKeys.E || "(creation failed)";

  return {
    "SCRUM-124": `Hi Karen — confirmed regression. Onboarding persona-selection on first login isn't routing correctly any more (the Settings path you mentioned still works). Raised as ${A} for triage and fix; this test case stays Done as the closure was valid at the time, and ${A} will track the current break + the regression test to prevent it recurring.`,

    "SCRUM-127": `Hi Karen — thanks, all three points captured as separate tickets so they can be triaged independently:

  • ${B} — accept DWG, SKT, RVT, Word formats (your file-format point)
  • ${C} — empty-state messaging when uploaded plans are incomplete (no plans, no measurements, no elevations)
  • ${D} — surface project-question-level fixes for common compliance fails

Word export was actually shipped on 2026-04-30 (SCRUM-156, Comply). The button should be visible on the report page next to the PDF export — please re-test and let me know if it's not showing in your UI.`,

    "SCRUM-128": `Hi Karen — file-format expansion (DWG/SKT/RVT/Word) tracked as ${B}. This ticket can stay closed since the test passed against current PDF-only behaviour; ${B} owns the broader format support work going forward.`,

    "SCRUM-129": `Hi Karen — to confirm the trial limit setup: yes, the 10-run cap is enforced from the moment the account is created (not from any later activation step). Your trial counter should have been at 0/10 from your first login.

If you'd like to verify the count for your test account, I can pull the run history from the database — happy to do so on request. If you reached the limit and would like the counter reset for further testing, let me know.`,

    "SCRUM-131": `Hi Karen — Word export was actually shipped on 2026-04-30 in SCRUM-156 (commit 01d2e70). The Word export button should now appear next to the PDF export on the compliance report page. Please re-test — if it's not visible in your UI, it'd be a deployment/cache issue worth raising as a new bug.`,

    "SCRUM-132": `Hi Karen — agreed, this needs re-testing once the current redesign work lands. I'll re-open / re-run this test case at the close of the v0.4.x iteration sprint and update the ticket. Thanks for flagging it.`,

    "SCRUM-133": `Hi Karen — agreed, re-test required after the redesign. Will run this through again at the end of the v0.4.x iteration sprint and update the ticket with results. Leaving as Done for now since the current pass was valid at closure.`,

    "SCRUM-134": `Hi Karen — yes, this is a known test-infra gap: testers with existing projects can't reach the empty state. Tracking under SCRUM-159 ("Test infra: provide testers a path to reach Build module empty-state"), which will set up a way to provision a clean tester account on demand. This test case is blocked on SCRUM-159.`,

    "SCRUM-137": `Hi Karen — Word export was shipped on 2026-04-30 in SCRUM-157 (commit 01d2e70). The Word download button should now appear alongside the PDF export on the quote report page. Please re-test — if it's not showing in your UI, raise as a new bug and I'll investigate.`,

    "SCRUM-138": `Hi Karen — both issues taken seriously, raised as ${E} (Bug, High) for investigation. Two separate problems in the same output:

  1. Wall material data wrong when SIP is the selected wall system
  2. Fence MMC line item included even though no fence was selected

To reproduce against your exact data, could you either (a) attach the PDF/Word report from your 2026-04-30 test run to ${E}, or (b) share the project ID so I can pull the exact inputs? Will close this test case in favour of ${E} as the live tracker for the bug fix.`,
  };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`Host: ${HOST}\n`);

  if (dryRun) {
    console.log("Phase 1 — would create:");
    for (const [k, t] of Object.entries(TICKETS)) {
      console.log(`  ${k}) [${t.type}/${t.priority}] ${t.summary}`);
    }
    console.log("\nPhase 2 — would comment on:");
    for (const k of Object.keys(buildComments({}))) console.log(`  ${k}`);
    return;
  }

  // Phase 1 — create tickets
  console.log("── PHASE 1: creating follow-up tickets ──");
  const newKeys = {};
  for (const [marker, t] of Object.entries(TICKETS)) {
    const r = await createTicket(t);
    if (r.body?.key) {
      console.log(`  ✓ ${marker} → ${r.body.key} — ${t.summary.slice(0, 70)}…`);
      newKeys[marker] = r.body.key;
    } else {
      console.log(`  ✗ ${marker} FAILED: ${JSON.stringify(r.body).slice(0, 200)}`);
    }
  }

  // Phase 2 — post comments using the captured keys
  console.log("\n── PHASE 2: posting comments on Karen's threads ──");
  const comments = buildComments(newKeys);
  let ok = 0;
  for (const [key, body] of Object.entries(comments)) {
    const r = await postComment(key, body);
    if (r.status >= 400) {
      console.log(`  ✗ ${key} — ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    } else {
      console.log(`  ✓ ${key} — comment posted`);
      ok++;
    }
  }
  console.log(`\n${ok}/${Object.keys(comments).length} comments posted.`);
  console.log(`New tickets: ${Object.values(newKeys).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
