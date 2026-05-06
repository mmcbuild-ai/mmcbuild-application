#!/usr/bin/env node
/**
 * Create TC-BUILD-005 — verification test case for SCRUM-161
 * (3D viewer wall/room overlays populated by AI optimisation).
 *
 * Mirrors the format of the existing TC-BUILD-001..004 tickets (SCRUM-132..135)
 * so it slots into Karen's test-regime workflow without rework.
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

const description = `Verifies SCRUM-161 — 3D plan viewer renders colour-coded wall and room overlays after AI optimisation completes. Until SCRUM-161, suggestions had no spatial mapping so the 3D comparison showed two identical building models. This test confirms the new mapping is wired end-to-end through the AI prompt, the database, and the report page.

Preconditions:
- User logged in
- A project exists with a successfully processed plan (plans.status = "ready")
- The project's plan was uploaded AFTER 30 Apr 2026 (i.e. processed against the new optimisation prompt that includes spatial layout — pre-existing reports will not have overlays and that is expected)
- Build module is accessible

Steps:
1. Navigate to /build and select the project
2. On the project Build page, confirm at least one construction system is selected
3. Click "Run Design Optimisation"
4. Wait for the report to complete (status changes from queued/processing to completed)
5. On the report page, scroll past the text-based summary
6. Locate the collapsed card "Show 3D revolving view of your building with the recommended MMC mix"
7. Note the subtitle — it should read "N suggestion(s) mapped to walls" where N >= 1 (NOT "Drag to rotate · scroll to zoom · ...")
8. Click the card to expand
9. The 3D viewer renders. Use the View toggle to switch between Split, Original, Optimised
10. In Optimised view, verify that some walls or rooms are coloured per the legend below the viewer (teal, violet, amber, etc.)
11. Drag to rotate the building and verify overlays follow the geometry
12. Open browser developer console — verify no errors logged

Expected Result:
- The collapse card subtitle shows a non-zero "mapped to walls" count
- The Optimised 3D view shows at least one suggestion's walls or rooms highlighted in the colour shown in the legend
- Hovering over coloured walls does not produce errors
- The Split view shows the Original (no overlays) on the left and the Optimised (with overlays) on the right
- All MMC categories that produce overlays match their legend colour

Acceptance criteria for sign-off:
- At least 50% of suggestions in the report have non-empty affected_wall_ids OR affected_room_ids — verifiable by clicking each suggestion in the legend and seeing geometry highlighted
- Pre-existing reports (run before 30 Apr 2026) still load without errors but show the "Drag to rotate" subtitle and no overlays — this is the expected fallback for legacy data

Pass/Fail: (blank until executed)

Notes:
- If overlays are missing for a fresh report, check the design_suggestions table directly: SELECT id, technology_category, affected_wall_ids, affected_room_ids FROM design_suggestions WHERE check_id = 'X'. If columns are NULL, the AI didn't return them or returned IDs that didn't match the spatial layout (we filter invalid IDs at insert time). Capture the response in a comment for diagnosis.
- The 3D canvas is now click-gated (SCRUM-162) — this is the expected new UX. Do NOT raise as a bug.

Linked tickets:
- Implements: SCRUM-161
- Sister UX gate: SCRUM-162
- Mirrors: existing TC-BUILD-NNN format used in SCRUM-132..135`;

const main = async () => {
  const r = await api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: "[TC-BUILD-005] 3D viewer renders wall/room overlays from AI suggestions",
      description: adfDoc(description),
      issuetype: { name: "Story" },
      labels: ["test-regime", "build", "3d-viewer", "verifies-scrum-161"],
      priority: { name: "Medium" },
    },
  });
  if (r.body?.key) {
    console.log(`✓ Created ${r.body.key} — TC-BUILD-005`);
    console.log(`  https://${HOST}/browse/${r.body.key}`);
  } else {
    console.error("✗ Failed:", JSON.stringify(r.body).slice(0, 400));
  }
};
main().catch(e => { console.error(e); process.exit(1); });
