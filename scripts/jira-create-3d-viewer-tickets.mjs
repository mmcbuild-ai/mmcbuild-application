#!/usr/bin/env node
/**
 * Create the two 3D-viewer follow-up tickets:
 *  - Build: AI extractor populates affected_wall_ids on suggestions
 *  - Build: explicit "Show 3D revolving view" gate on the report page
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
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function adfDoc(text) {
  return { type: "doc", version: 1, content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
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
      res.on("end", () => { let parsed = null; if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } } resolve({ status: res.statusCode, body: parsed }); });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

const TICKETS = [
  {
    summary: "Build: AI optimisation must populate affected_wall_ids / affected_room_ids on suggestions for 3D overlay rendering",
    type: "Story", priority: "Medium",
    labels: ["build", "3d-viewer", "ai-prompt", "v0.5.0-candidate"],
    body: `Context: The 3D plan viewer (PlanComparison3D + PlanViewer3D, react-three-fiber) is already wired into the Build report page. Today the comparison view renders the building geometry but the suggestion overlays never light up — the report page passes affected_wall_ids: [] (line 75 of src/app/(dashboard)/build/[projectId]/report/[reportId]/page.tsx) with the comment "Wall/room mapping will be populated by the AI extractor as the spatial extraction prompt improves."

Problem: Suggestions are generated from plan TEXT content (retrievePlanChunks) by the optimisation prompt. The spatial layout is extracted in a parallel step but never rejoined to the suggestions, so the AI never has a chance to label which walls a suggestion affects.

Fix (additive, low-risk):
1. DB: add nullable columns affected_wall_ids TEXT[] and affected_room_ids TEXT[] to design_suggestions
2. Inngest run-design-optimisation: pass the extracted spatial_layout into the optimisation prompt AFTER the spatial extraction step completes
3. Optimisation prompt: extend the response schema to require affected_wall_ids and affected_room_ids per suggestion, populated by referencing the wall ids from the supplied spatial layout
4. Storage: persist the new fields when inserting design_suggestions rows
5. Report page: stop hard-coding affected_wall_ids: [] and pass the persisted fields through to PlanComparison3D

Acceptance criteria:
- For a project with a plan that successfully spatial-extracts (confidence > 0.5), at least 50% of suggestions return non-empty affected_wall_ids
- The 3D comparison view shows colour-coded wall overlays per the legend already in plan-comparison-3d.tsx
- Existing suggestions (pre-migration) continue to render without errors (graceful empty-array fallback)
- TC-BUILD-NNN test added to verify overlays render

Out of scope for this ticket:
- Changing the visual style of overlays (already designed)
- Click-to-reveal gating (separate ticket)`,
  },
  {
    summary: "Build: explicit \"Show 3D revolving view\" button on the design report page",
    type: "Story", priority: "Low",
    labels: ["build", "3d-viewer", "ux", "v0.5.0-candidate"],
    body: `Context: The 3D plan viewer auto-renders on the Build report page when spatial_layout is available. This means the WebGL canvas (react-three-fiber) initialises immediately on page load, even for users who don't want to interact with the 3D view.

Why a click gate matters:
- Performance: WebGL canvas init adds ~150-300ms to first paint on lower-end devices; not all users care about the 3D view
- UX: makes the moment of revelation deliberate — "after the AI assesses the optimum MMC component makeup, click to see your building rendered with those changes"
- Mobile: the 3D canvas is heavier on mobile devices; default-collapsed avoids the cost for users who won't pinch-zoom a 3D model on a phone anyway

Fix:
1. Wrap PlanComparison3D in a collapsible card on the report page
2. Default collapsed
3. Card header shows "Show 3D revolving view of your building with the recommended MMC mix" with a ChevronDown icon
4. Click expands the card and lazy-mounts PlanComparison3D (use dynamic import or conditional render — only mount when expanded)
5. Subsequent clicks collapse and unmount (or keep mounted but hidden — see acceptance criteria)

Acceptance criteria:
- /build/{projectId}/report/{reportId} loads with the 3D viewer collapsed by default
- Click "Show 3D revolving view" expands the card and renders the canvas
- Lighthouse performance score on the report page improves vs current behaviour (measure before/after on a representative report)
- Existing keyboard accessibility preserved (ChevronDown reflects state, button is focusable, aria-expanded set correctly)

Out of scope:
- Changing the 3D viewer itself (already built)
- Adding wall_id overlays (separate ticket — see paired Story)`,
  },
];

const main = async () => {
  console.log(`Creating ${TICKETS.length} 3D-viewer follow-up tickets in ${PROJECT_KEY}...\n`);
  const created = [];
  for (const t of TICKETS) {
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
    if (r.body?.key) {
      console.log(`✓ ${r.body.key.padEnd(12)} [${t.type.padEnd(5)}] ${t.priority.padEnd(6)} ${t.summary.slice(0, 60)}`);
      created.push({ key: r.body.key, summary: t.summary });
    } else {
      console.log(`✗ FAILED   ${t.summary.slice(0, 60)}`);
      console.log(`  ${JSON.stringify(r.body).slice(0, 300)}`);
    }
  }
  console.log(`\n${created.length}/${TICKETS.length} created.`);
  for (const c of created) console.log(`  - ${c.key} — ${c.summary}`);
};
main().catch(e => { console.error(e); process.exit(1); });
