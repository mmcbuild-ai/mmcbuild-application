#!/usr/bin/env node
/**
 * Create Jira tickets for action items from the Karen + Dennis MMC Build review
 * meeting on 2026-05-01.
 *
 * Source transcript:
 *   C:\Users\denni\Downloads\2026-05-01 13.06.28 MMC Build _Build_ Module Meeting\transcript.md
 *
 * Two ticket sets:
 *   DONE  (A1–A5) — already implemented in the working tree on 2026-05-02/03.
 *                   Created and immediately transitioned to Done with a completion
 *                   comment and file references.
 *   TODO  (N1–N10) — new backlog items raised during the meeting that aren't
 *                    already covered by SCRUM-132/133/153/154/155/161/162/163.
 *
 * Cross-reference comments are also posted on SCRUM-132, SCRUM-133, SCRUM-155
 * to flag retest/dependency overlap with the items shipped here.
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
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

const TRANSCRIPT_REF =
  "Source: 2026-05-01 MMC Build module review with Karen — local transcript at " +
  '"Downloads\\2026-05-01 13.06.28 MMC Build _Build_ Module Meeting\\transcript.md".';

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
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed = null;
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = raw;
            }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ status: 0, body: "timeout" });
    });
    if (data) req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// DONE tickets — A1..A5 — implemented in the working tree on 2026-05-02/03
// ---------------------------------------------------------------------------

const DONE_TICKETS = [
  {
    code: "A1",
    summary:
      "Build/Comply/Quote: replace large hero with compact header + ExplainerVideo on module landing pages",
    type: "Story",
    priority: "Medium",
    labels: ["build", "comply", "quote", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 00:00–10:00 mark: "having a small little bit at the top where it sort of explains, and then having something of a little button for video, so that if someone's using this module for the first time, they could sort of go in there and it just says step-by-step how they need to actually work with MMC Build... it was just a lot of wasted real estate that wasn't really doing anything. I just scrolled down and ignored it."

Done:
- src/app/(dashboard)/build/page.tsx — replaced ModuleHero with compact icon+title+description block, added ExplainerVideo with three contextual bullets (Prefab/Volumetric, SIP/CLT Panels, Hybrid)
- src/app/(dashboard)/comply/page.tsx — added ExplainerVideo with pathway selection / certification trail / why-it-matters bullets
- src/app/(dashboard)/quote/page.tsx — added ExplainerVideo (parallel treatment)
- src/components/shared/explainer-video.tsx — new shared component (text + bullets layout, video URL TBD per N9)
- "Setup required" badge relabelled to "Not activated" with an explicit hint pointing the user to the Projects page to activate before running an analysis

Acceptance:
- Verified the new layout removes the centred module hero and presents the explainer above the projects grid on /build, /comply, /quote
- Existing module navigation, project cards, and "Create" actions remain functional

Out of scope (separate ticket): generation of the actual explainer video MP4s — see N9 (HeyGen-driven generation).`,
  },
  {
    code: "A2",
    summary:
      'Projects: add "Project Status" intake step (design stage, project goals, submission timeline)',
    type: "Story",
    priority: "Medium",
    labels: ["projects", "build", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 10:00–20:00 mark, talking through the Emily-the-architect persona: "asking questions around what do you want to do with this project? Do you want to reduce time? Is that an issue? Do you want repeatability?... How important is sustainability, and have you already got DA approved plans?"

Done:
- src/components/projects/questionnaire-form.tsx — new Step 0 "Project Status" prepended to the wizard:
  * Design stage select: Concept / Schematic / Design Development / Documentation (DA-ready) / CC ready / Submitted (post-DA) / Submitted (post-CC)
  * Project goals multi-select (pipe-delimited): Explore MMC options early, Validate compliance pathway, Compare cost vs traditional, Brief the client, Submission-ready evidence pack, Educate myself on MMC
  * Submission timeline select: No fixed date / Within 4 weeks / 1–3 months / 3–6 months / Already submitted
- Step indices renumbered downstream (visibleSteps logic updated)
- Hint copy under "Design stage" reinforces ICP messaging: "MMC analysis pays off most at concept and schematic stages — before drawings lock and before council submission."

Acceptance:
- Wizard renders the new step first; existing 8 steps follow unchanged
- Responses persist to project_questionnaire_responses with three new keys (design_stage, project_goals, submission_timeline)
- Existing projects without these responses don't break the wizard (default empty strings)

Notes:
- Overlaps with SCRUM-155 (Comply pre-validate at project-question level) — these intake answers serve both modules. Cross-link comment posted on SCRUM-155.`,
  },
  {
    code: "A3",
    summary:
      "Build report: interactive suggestion decisions (pursuing / considering / rejected / undecided) with notes",
    type: "Story",
    priority: "High",
    labels: ["build", "ai-report", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 30:00–40:00 mark: "I'm going to click off that one because I don't want bathroom pods thank you very much but I do want the trusses and I do want the wall panels... it's actually because we're taking on board their input and their refinement as we go to sort of give them what they're looking for rather than sort of giving them a very broad story of everything."

Done:
- src/components/build/suggestion-card.tsx — added decision UI per suggestion:
  * Four states: undecided / pursuing / considering / rejected
  * Coloured left-border per state (teal / emerald / amber / rose)
  * Per-suggestion note textarea (collapsible)
  * Persists via setSuggestionDecision server action with optimistic UI + transition pending state
- src/app/(dashboard)/build/actions.ts — new setSuggestionDecision server action:
  * Auth + org-scope check (joins design_suggestions → design_checks for org_id verification)
  * Updates decision, decided_by, decided_at, decision_note columns
  * Revalidates the report path
- src/components/build/design-report.tsx — added DecisionSummary aggregate card and ReportLegend; removed the old static "Avg Time / Cost / Waste" stat cards (Karen: "medium impact based on what?")

Acceptance:
- User can click pursuing/considering/rejected on any suggestion; selection persists across reload
- Decision count summary updates after each selection
- Notes save on blur of the textarea; visible after reload
- RLS / org-scope check prevents cross-tenant edits

Out of scope (separate ticket): wiring decisions back into the 3D viewer to filter the rendered components — see N1.`,
  },
  {
    code: "A4",
    summary:
      'Build report: remove meaningless "Avg Time / Cost / Waste" stat cards, replace with decision summary + legend',
    type: "Story",
    priority: "Medium",
    labels: ["build", "ai-report", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 30:00–40:00 mark: "they're saying that there is some components that have a medium sort of impact... medium impact based on what? If we didn't ask them a question of what they're trying to achieve, how do we know if it's medium achieving it?"

Done:
- src/components/build/design-report.tsx — removed avgTimeSavings / avgCostSavings / avgWasteReduction StatCard block (the "medium impact" arithmetic mean of unrelated metrics that Karen called out)
- Replaced with:
  * DecisionSummary — counts of pursuing / considering / rejected / undecided suggestions
  * ReportLegend — explains complexity badge meaning, decision colours, and how to use the page

Acceptance:
- Report page no longer shows the three averaged percent stat cards
- DecisionSummary updates live as the user makes A3 decisions
- ReportLegend is visible above the suggestions list, not tucked away

Note: this is the visible half of the fix. Re-weighting confidence/impact scores by user-stated goals is the separate AI-side fix — see N2.`,
  },
  {
    code: "A5",
    summary:
      'Projects: confirm "Save and Activate" exit + relabel "Setup required" → "Not activated" with hint',
    type: "Task",
    priority: "Low",
    labels: ["projects", "build", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 00:00–10:00 mark: "But if you wanted to just activate it, you would have to go all the way to the end. Is that right now?... So at that point, it should just say save and activate."

Done:
- src/components/projects/wizard-nav.tsx:114 — "Save and Activate" CTA confirmed at the final wizard step (already present, validated against transcript)
- src/app/(dashboard)/build/page.tsx — "Setup required" badge relabelled to "Not activated" with an explicit caption: "Go to Projects and activate the project before running a Build analysis."
- src/components/projects/create-project-dialog.tsx — added DialogDescription so users know up-front what the wizard will collect, and surfaced submit errors

Acceptance:
- A draft project on the Build landing page now shows "Not activated" + the activation hint instead of the ambiguous "Setup required"
- Clicking the project navigates to the project page, where the wizard exit button reads "Save and Activate"

Notes:
- Doesn't fully resolve Karen's broader confusion that activating a project from the Build landing page bounces her back to Projects. Deeper flow rework is captured separately if needed.`,
  },
];

// ---------------------------------------------------------------------------
// TODO tickets — N1..N10 — new items from the meeting (backlog)
// ---------------------------------------------------------------------------

const TODO_TICKETS = [
  {
    code: "N1",
    summary:
      "Build: link suggestion decisions to 3D viewer (deselected components disappear from render)",
    type: "Story",
    priority: "High",
    labels: ["build", "3d-viewer", "ai-report", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 30:00–40:00 mark: "by clicking this off it actually affected the 3d render by removing those components out of it."

Today A3 (suggestion-card.tsx) lets the user mark each suggestion pursuing / considering / rejected, but the 3D viewer (PlanComparison3D) renders independently of those choices. The "after MMC" view should reflect the user's curated set, not the AI's full recommended set.

Scope:
1. Pass the live decision map from the report page down to PlanComparison3D
2. PlanComparison3D filters affected_wall_ids / affected_room_ids by decision:
   - pursuing → render in the "MMC" colour
   - considering → render with a 50% opacity / dotted style
   - rejected → render as the original geometry (no MMC swap)
   - undecided → current default
3. Re-render the comparison live when the user toggles a decision (use the existing transition pending state from A3 to debounce)

Depends on:
- SCRUM-161 (affected_wall_ids extraction) — must be populated for the filter to work
- A3 decisions persistence

Acceptance:
- Toggle "rejected" on a SIP wall suggestion → 3D view stops colouring those wall_ids
- Toggle "pursuing" on a roof-truss suggestion → 3D view colours the affected geometry as MMC
- Existing keyboard accessibility preserved

Out of scope: actually mutating the underlying plan geometry (round → straight wall etc) — see N5.`,
  },
  {
    code: "N2",
    summary:
      "Build: re-weight suggestion confidence + impact by user-stated project goals",
    type: "Story",
    priority: "High",
    labels: ["build", "ai-prompt", "scoring", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 30:00–40:00 mark: "If we didn't ask them a question of what they're trying to achieve, how do we know if it's medium achieving it? If it's purely looking at it from a financial time and environmental sort of perspective, yeah, it might change some of the confident percentages."

Now that A2 captures project_goals (Explore MMC, Validate compliance, Compare cost, Brief client, Submission-ready, Educate), we can re-weight the AI's confidence and impact scoring against those goals.

Scope:
1. Extend src/lib/ai/prompts/optimisation-system.ts to receive project_goals as input context
2. The optimiser must explain its impact rating with reference to the user's stated goals (e.g. "high impact for cost-comparison goal because SIP swap saves 12% on materials"), not just an opaque "medium impact"
3. Update the response schema to require a goal_alignment field per suggestion: { goal: string, score: number, rationale: string }[]
4. Render goal_alignment on the suggestion card under the existing impact badge
5. Default behaviour for projects without goals (legacy projects pre-A2): fall back to today's weighting

Acceptance:
- A project with "Compare cost vs traditional" weighted higher returns suggestions ranked by cost savings
- A project with "Submission-ready evidence pack" prioritises compliance-friendly suggestions
- TC-BUILD-NNN test added verifying goal influence on ranking

Depends on: A2 (project goals captured)`,
  },
  {
    code: "N3",
    summary:
      "Build + Direct: surface featured supplier products (paid tier) in optimisation suggestions",
    type: "Story",
    priority: "Medium",
    labels: ["build", "direct", "supplier", "monetisation", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 30:00–40:00 mark: "if we have suppliers that have signed on as professional level suppliers, they're paying a lot more to get leads basically from this referral system. So maybe having a couple of different company sort of products against each of these areas that people can select."

Suggestions today are abstract ("prefabricated bathroom pod") with no link to specific supplier SKUs. To monetise the directory referral path, paid-tier suppliers should have their products surfaced inside Build suggestions where their MMC category matches.

Scope:
1. Schema: add suppliers.tier (free / pro / featured) and supplier_products table (id, supplier_id, mmc_category, sku, name, summary, price_estimate, lead_time_days)
2. Inngest run-design-optimisation: after the optimiser returns abstract suggestions, run a second pass that joins each suggestion's technology_category to up-to-3 featured-tier supplier_products matching that category
3. UI: under each suggestion (in suggestion-card.tsx), render a "Featured suppliers for this category" subsection with the matched products
4. Lead-tracking: when a user clicks through to a supplier, log a directory_referral row with project_id, suggestion_id, supplier_id

Acceptance:
- Featured-tier suppliers appear inline on Build suggestions for their categories
- Free-tier suppliers appear only via the Directory page
- Lead-tracking row written on click-through

Out of scope: pricing/payment for the featured tier (Billing module work).`,
  },
  {
    code: "N4",
    summary:
      "Quote: multi-supplier quote — pick up to 3 suppliers per component for parallel pricing",
    type: "Story",
    priority: "Medium",
    labels: ["quote", "supplier", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 30:00–40:00 mark: "they might want to sort of choose you know three different people who do precast concrete and give me a quote for each of those."

Quote today produces a single estimated cost per line item. Real builders will want quotes from 2–3 suppliers per component to compare.

Scope:
1. Quote run schema: allow N quote variants per suggestion, keyed by supplier_id
2. UI: on the quote page, show a per-component supplier picker (up to 3) sourced from supplier_products
3. The cost-estimate Inngest function fans out one quote-call per (component × supplier) combo
4. Quote PDF export: render parallel columns — Supplier A / Supplier B / Supplier C with delta vs lowest

Depends on:
- N3 (supplier_products table)

Acceptance:
- User can pick 3 precast-concrete suppliers; quote returns 3 parallel cost rows
- PDF export renders the 3-supplier comparison cleanly
- TC-QUOTE-NNN test added`,
  },
  {
    code: "N5",
    summary:
      "Build: export modified plan as DWG with proposed product changes applied (round→straight walls shown dotted)",
    type: "Story",
    priority: "Medium",
    labels: ["build", "plan-export", "dwg", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 40:00–44:00 mark: "if people want to be able to actually export what the plans modifications will be utilizing those products then they can export it as a DWG or whatever... if it shows on something that you know there's a round wall then we'll sort of maybe show the plans with the straight wall. With the round in a dot dot dot sort of thing so you can see that it's been changed. Because that'll affect all of the landscaping versus FSR sort of percentages."

Today Build exports the suggestion REPORT as PDF/Word. There's no path to export the modified PLAN as a DWG.

Scope:
1. Build on the existing DXF/DWG read pipeline (commits 898ace3, 00770a6) — same library can write DXF
2. Apply the user's pursuing decisions (A3) to the source plan geometry:
   - Wall geometry swaps (round→straight where required by the chosen MMC)
   - Wall thickness adjustments per MMC (SIPs ~150mm, CLT ~100mm, etc)
3. Render unchanged geometry as solid lines, modified geometry as dotted lines on a CHANGES layer
4. Surface as "Export modified plan (DWG)" button on the Build report page next to the existing PDF/Word export
5. Tier-gate: paid-only feature

Acceptance:
- Round wall in source PDF, after pursuing a "convert to SIP straight wall" suggestion, exports a DWG with the original on a SOURCE_OVERLAY layer (dotted) and the new straight wall on a CHANGES layer (solid)
- DWG opens cleanly in AutoCAD / BricsCAD / DraftSight without layer warnings

Depends on: DXF write capability in the existing library; geometry-mutation logic for each MMC type.`,
  },
  {
    code: "N6",
    summary:
      "Build: inline compliance check during optimisation (red-flag non-compliant selections in real time)",
    type: "Story",
    priority: "High",
    labels: ["build", "comply", "ai-report", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 10:00–20:00 mark: "I'm just wondering whether we can do that dynamically on the fly. You've got a design in, we're in build, you're making some selections, whatever, and if anything that you're not happy with, or that you're asking for is out of compliance, it'll sort of red flag it then and there, rather than have them go through a process and then go back and have to sort of re-jig it... taking any friction out of the process if we can along the way."

Today Build and Comply run as separate pipelines — a user can tick a SIP suggestion in Build that fails Comply, and won't find out until they run Comply separately.

Scope:
1. When a user marks a suggestion "pursuing" (A3), trigger an inline Comply mini-check against just that suggestion's product/method
2. Use the project's existing questionnaire data + the new project_goals (A2) to scope the check
3. Surface a red badge / inline warning on the suggestion card if the check fails ("⚠ Won't pass NCC J1.5 in BCA Climate Zone 5 — see Comply for details")
4. Link to the full Comply run for the deep dive
5. Cache check results so toggling pursuing→considering→pursuing doesn't re-run

Depends on:
- A3 (decisions) — done
- Some Comply pipeline refactor to expose a per-suggestion check endpoint

Acceptance:
- Marking a non-compliant suggestion as "pursuing" surfaces a warning within 2s
- Clicking the warning routes to the relevant Comply finding
- TC-BUILD-NNN test added`,
  },
  {
    code: "N7",
    summary:
      "Direct: supplier compliance-document upload portal",
    type: "Story",
    priority: "Medium",
    labels: ["direct", "supplier", "compliance", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 20:00–30:00 mark: "I'm hoping when I sort of bring on board all of my suppliers, that I actually can get their compliance documentation and upload that as well, so we can actually sort of have only the compliant products and not have to sort of worry too much about ones that aren't."

Suppliers in the Directory have basic profile data (ABN, contact, MMC experience) but no path to upload compliance docs (CodeMark certificates, NCC compliance reports, datasheet PDFs).

Scope:
1. Schema: supplier_compliance_documents (id, supplier_id, doc_type, file_url, expires_at, verified, verified_by, verified_at)
2. Supplier-portal route: /direct/portal/compliance-docs — supplier-tier auth required
3. Upload flow with file-type validation (PDF / DOCX), max-size cap, and category tagging
4. Admin verification UI in /settings/admin to mark uploaded docs as verified
5. Surface verified docs on the public directory listing AND on Build suggestions (N3 dependency)
6. Expiry tracking — supplier emailed 30 days before expires_at

Acceptance:
- Supplier with portal access can upload a CodeMark cert and tag it to a product
- Verified docs surface on the public profile + Build suggestions
- Expired docs are not shown to the public

Depends on: existing Direct module + supplier-tier role implementation.`,
  },
  {
    code: "N8",
    summary:
      'Questionnaire: rename Step "Energy / Glazing (J)" → "Energy / Insulation / Glazing" so the insulation fields are discoverable',
    type: "Bug",
    priority: "Low",
    labels: ["projects", "questionnaire", "ux", "karen-feedback", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

Karen at the 00:00–10:00 mark: "The installation stuff. That still isn't there." (transcription artefact for "the insulation stuff")

The insulation R-value fields (ceiling, wall, floor) ARE present on Step 6 of the questionnaire (questionnaire-form.tsx:690-712), but the step is labelled "Energy / Glazing (J)". Karen scrolled through the wizard and didn't see "insulation" in the step title, so concluded it was missing.

Fix:
- Rename STEPS[6] from "Energy / Glazing (J)" to "Energy / Insulation / Glazing (J)" in src/components/projects/questionnaire-form.tsx (note: now Step 7 after A2 added Step 0)
- Optionally split into "Insulation R-values" + "Glazing & Energy Pathway" sub-sections within the step for clarity

Acceptance:
- Step navigator shows "Insulation" in the visible step title
- Karen can complete the wizard and report that all expected questions are present
- TC-BUILD-001 retest passes`,
  },
  {
    code: "N9",
    summary:
      "Generate HeyGen explainer videos for each MMC module + wire URLs into ExplainerVideo component",
    type: "Story",
    priority: "Medium",
    labels: ["build", "comply", "quote", "direct", "train", "media", "heygen", "meeting-2026-05-01"],
    body: `${TRANSCRIPT_REF}

A1 shipped the ExplainerVideo component skeleton on Build/Comply/Quote landing pages, but the actual MP4s aren't generated yet — the "Watch the video" button has no source today.

Plan: re-use the proven HeyGen integration from LingoPureAI (one-shot generation, ~$1 per ~60s clip, played from a static MP4 on Vercel).

Scope:
1. Port the HeyGen client:
   - Copy LingoPureAI/src/lib/heygen/client.ts into src/lib/heygen/client.ts
   - Copy LingoPureAI/scripts/heygen-generate-intro.ts as the template
2. Pull HEYGEN_API_KEY from LingoPureAI .env.local into mmcbuild .env.local (and Vercel env)
3. Write per-module generator scripts:
   - scripts/heygen-generate-build-explainer.ts (~60s, "what MMC Build does for designers")
   - scripts/heygen-generate-comply-explainer.ts (~60s, "what MMC Comply does for compliance pathways")
   - scripts/heygen-generate-quote-explainer.ts (~60s, "what MMC Quote does for cost comparison")
   - scripts/heygen-generate-direct-explainer.ts (~60s, "MMC Direct supplier directory")
   - scripts/heygen-generate-train-explainer.ts (~60s, "MMC Train upskilling pathway")
4. Each script writes its output to public/videos/<module>-explainer.mp4 and is committed
5. Update src/components/shared/explainer-video.tsx to accept videoUrl prop, default to /videos/<module>-explainer.mp4
6. Voice/avatar consistent across modules (e.g. same Public Avatar + voice ID); script tone matches the ICP (architects/designers, not builders)

Cost: ~$5 one-off (5 modules × ~$1/clip). Re-runnable any time scripts change.

Acceptance:
- Click "Watch the video" on /build → MP4 plays
- Same on /comply, /quote, /direct, /train
- Page weight increase capped (videos lazy-loaded)
- Scripts re-runnable to refresh content

Depends on: A1 ExplainerVideo component (done).`,
  },
  {
    code: "N10",
    summary:
      "[Discussion] Clarify with Karen — per-persona journeys vs intake-driven UX",
    type: "Task",
    priority: "Medium",
    labels: ["discussion", "ux", "karen-feedback", "meeting-2026-05-01", "needs-decision"],
    body: `${TRANSCRIPT_REF}

Karen at the 20:00–30:00 mark walked through Figma profiles for Builder, Developer, Architect, Tradie, and Certifier — describing materially different journeys per role (e.g. tradies skip optimisation entirely and just want directory + compliance; certifiers only want the compliance side; developers rely on builder for compliance). The implication is per-persona UI tailoring at the module level.

This conflicts with a deliberate v0.4.x decision: the persona layer was REMOVED from the product. SCRUM-78 was rescoped from "5 beta users per persona" to flat 5–10 testers observed by behaviour. The internal note in memory:
   "Persona gating intentionally removed; beta reveals usage by behaviour, not role.
    Settings picker is stale."

Two ways to read Karen's request:
  Option A — She wants the persona layer back: full onboarding role select + role-specific module visibility + role-specific copy. Significant scope reversal.
  Option B — She wants intake-driven UX: same shared product, but the new project_goals + design_stage + an optional "your role" question (A2) drive copy and emphasis on each page. Aligns with existing direction; uses the questionnaire signals we just shipped.

Need from Karen on Monday's call (2026-05-04):
1. Confirm whether the Figma persona screens are best read as A or B
2. If A — what was the reasoning for re-introducing personas after we removed them (compliance? audit trail? sales conversation?)
3. If B — confirm the role question goes on the project intake (not onboarding), so users can take different roles on different projects

Do not implement either path until this is resolved.`,
  },
];

// ---------------------------------------------------------------------------
// Cross-link comments on existing tickets that overlap with what we shipped
// ---------------------------------------------------------------------------

const CROSS_LINK_COMMENTS = [
  {
    key: "SCRUM-132",
    body: `Cross-link from 2026-05-01 Build module review with Karen.

Several items related to TC-BUILD-001 retest landed in the working tree on 2026-05-02/03 (commits pending). New tickets cover them: see A1 (Build landing redesign with ExplainerVideo), A5 (Save and Activate flow + "Not activated" relabel), N9 (actual explainer video generation).

Once the working tree is committed and deployed to staging, this test should be ready to retest with the new flow. Karen — please re-run TC-BUILD-001 against the staging URL after the next deploy.`,
  },
  {
    key: "SCRUM-133",
    body: `Cross-link from 2026-05-01 Build module review with Karen.

Items affecting TC-BUILD-002 (material selection persists) landed in the working tree: A3 (interactive suggestion decisions persisted via setSuggestionDecision), A4 (decision summary replaces averaged stat cards). Plus two follow-on tickets that further the decision-driven flow: N1 (decisions filter the 3D viewer), N2 (decisions weighted by project goals from A2).

Once the working tree is committed and deployed, please re-run TC-BUILD-002 against the staging URL — the test wording probably needs updating to reflect that "material selection" is now done via decision toggles per suggestion, not the old SystemSelectionPanel set.`,
  },
  {
    key: "SCRUM-155",
    body: `Cross-link from 2026-05-01 Build module review with Karen.

A2 (just-shipped Step 0 on the project intake — design_stage, project_goals[], submission_timeline) covers part of the project-question-level pre-validation work this ticket is scoped against. The new fields are captured before any analysis runs and are shared across Build / Comply / Quote.

Recommended sequencing:
1. A2 already shipped → use those answers as the FIRST bucket of pre-validation signals
2. SCRUM-155 audit of recent fail-types (still pending) → identifies the SECOND bucket of questions to add
3. N2 (suggestion scoring weighted by project_goals) consumes A2's signals downstream

Don't duplicate the A2 questions when this ticket is implemented.`,
  },
];

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function createTicket(t) {
  const r = await api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: t.summary,
      description: adfDoc(t.body),
      issuetype: { name: t.type },
      labels: t.labels,
      priority: { name: t.priority },
    },
  });
  return r;
}

async function transitionToDone(key) {
  const trans = await api("GET", `/rest/api/3/issue/${key}/transitions`);
  if (trans.status >= 400) return { ok: false, reason: "fetch transitions failed" };
  const targets = trans.body.transitions || [];
  const chosen =
    targets.find((t) => /^done$/i.test(t.name)) ||
    targets.find((t) => t.to?.statusCategory?.key === "done") ||
    targets.find((t) => /close|resolve|complete/i.test(t.name));
  if (!chosen) return { ok: false, reason: "no Done transition" };
  const r = await api("POST", `/rest/api/3/issue/${key}/transitions`, {
    transition: { id: chosen.id },
  });
  if (r.status >= 400) return { ok: false, reason: `transition ${r.status}` };
  return { ok: true, name: chosen.name };
}

async function postComment(key, body) {
  return api("POST", `/rest/api/3/issue/${key}/comment`, { body: adfDoc(body) });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Host: ${HOST}`);
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log("");

  if (dryRun) {
    console.log(`Would create ${DONE_TICKETS.length} DONE tickets:`);
    for (const t of DONE_TICKETS) console.log(`  ${t.code} [${t.type}] ${t.priority} — ${t.summary}`);
    console.log(`\nWould create ${TODO_TICKETS.length} TODO tickets:`);
    for (const t of TODO_TICKETS) console.log(`  ${t.code} [${t.type}] ${t.priority} — ${t.summary}`);
    console.log(`\nWould comment on ${CROSS_LINK_COMMENTS.length} existing tickets:`);
    for (const c of CROSS_LINK_COMMENTS) console.log(`  ${c.key}`);
    return;
  }

  const created = [];

  console.log(`── Creating ${DONE_TICKETS.length} DONE tickets ──`);
  for (const t of DONE_TICKETS) {
    const r = await createTicket(t);
    if (!r.body?.key) {
      console.log(`✗ ${t.code} FAILED: ${JSON.stringify(r.body).slice(0, 250)}`);
      continue;
    }
    const completionComment = `Completed in working tree on 2026-05-02/03 ahead of Monday's review with Karen.

Implementation evidence is summarised in the ticket description. Code is uncommitted as of 2026-05-03 — Dennis to commit + push to staging branch before Monday's call.

Closing ticket immediately so Sprint 5 burndown reflects the work that has actually shipped to the working tree.`;
    await postComment(r.body.key, completionComment);
    const trans = await transitionToDone(r.body.key);
    const transTag = trans.ok ? `→ ${trans.name}` : `(transition skipped: ${trans.reason})`;
    console.log(`✓ ${t.code} ${r.body.key.padEnd(11)} [${t.type.padEnd(5)}] ${t.priority.padEnd(6)} ${transTag}  ${t.summary.slice(0, 50)}`);
    created.push({ code: t.code, key: r.body.key, status: "done" });
  }

  console.log(`\n── Creating ${TODO_TICKETS.length} TODO tickets ──`);
  for (const t of TODO_TICKETS) {
    const r = await createTicket(t);
    if (!r.body?.key) {
      console.log(`✗ ${t.code} FAILED: ${JSON.stringify(r.body).slice(0, 250)}`);
      continue;
    }
    console.log(`✓ ${t.code} ${r.body.key.padEnd(11)} [${t.type.padEnd(5)}] ${t.priority.padEnd(6)} ${t.summary.slice(0, 50)}`);
    created.push({ code: t.code, key: r.body.key, status: "todo" });
  }

  console.log(`\n── Cross-link comments on existing tickets ──`);
  for (const c of CROSS_LINK_COMMENTS) {
    const r = await postComment(c.key, c.body);
    if (r.status >= 400) {
      console.log(`✗ ${c.key} comment failed: ${r.status}`);
    } else {
      console.log(`✓ ${c.key} commented`);
    }
  }

  console.log(`\nSummary: ${created.length}/${DONE_TICKETS.length + TODO_TICKETS.length} tickets created.`);
  console.log("\nDONE:");
  for (const c of created.filter((x) => x.status === "done"))
    console.log(`  ${c.code} → ${c.key}`);
  console.log("\nTODO:");
  for (const c of created.filter((x) => x.status === "todo"))
    console.log(`  ${c.code} → ${c.key}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
