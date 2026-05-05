#!/usr/bin/env node
/**
 * Final cleanup pass — adds courtesy comments and files one new bug
 * surfaced during the sweep:
 *
 *   1. SCRUM-164 (Done) — note the video-collapse refinement (commit 8a8c546)
 *   2. SCRUM-176 (To Do) — rename ticket is stale; step has been renamed
 *      independently. Comment + leave open for Dennis to confirm closure.
 *   3. NEW BUG — Build module renders "Export Word" but API returns PDF
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

async function main() {
  // 1. SCRUM-164 follow-up
  await req("POST", "/rest/api/3/issue/SCRUM-164/comment", {
    body: adfDoc(
      `Follow-up refinement shipped in commit 8a8c546 ("refactor(ui): collapse explainer videos to click-to-expand teaser").\n\nKaren raised that the always-visible video frames still felt too in-your-face. The shared ExplainerVideo component now renders a small "Click here to watch the [Module] video" pill by default; clicking expands to the same aspect-video player. No new dependency, type-checks clean.\n\nApplies to: Projects, Comply, Build, Quote, Direct, Train, Billing landing pages.`
    ),
  });
  console.log("✓ SCRUM-164 comment posted");

  // 2. SCRUM-176 staleness
  await req("POST", "/rest/api/3/issue/SCRUM-176/comment", {
    body: adfDoc(
      `Sweep notes: this rename ticket may be stale. The current step in src/components/projects/questionnaire-form.tsx:109 is labelled "Energy Efficiency (H6)" — neither the original "Energy / Glazing (J)" nor the requested "Energy / Insulation / Glazing (J)" is in the code. The questionnaire was overhauled in commit 1dcb731 ("feat(projects): questionnaire UX overhaul").\n\nDennis to confirm — close as obsolete, or apply a different rename now?`
    ),
  });
  console.log("✓ SCRUM-176 comment posted");

  // 3. New bug — Build "Export Word" button returns PDF
  const newBug = await req("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT },
      summary: 'Build module: "Export Word" button returns a PDF (API ignores ?format=docx)',
      description: adfDoc(
        `Discovered during the cross-module ticket sweep on 2026-05-05.\n\nThe Build report page (/build/[projectId]/report/[checkId]) renders the shared ReportExportButton component (src/components/build/design-report.tsx:39), which exposes both "Export PDF" and "Export Word" buttons. The Word button issues GET /api/build/report/[checkId]?format=docx.\n\nThe API route at src/app/api/build/report/[checkId]/route.ts does NOT inspect the format query parameter — it always calls generateBuildPdf() and returns Content-Type application/pdf with a .pdf filename. There is no src/lib/build/report-docx.ts.\n\nResult: clicking "Export Word" on the Build report downloads a PDF. User-visible bug — Karen will hit this.\n\nFix: mirror the pattern from src/app/api/quote/report/[estimateId]/route.ts:\n  - Read format param at the top of the handler\n  - If docx, call a new generateBuildDocx() (to be written) and return application/vnd.openxmlformats-officedocument.wordprocessingml.document with a .docx filename\n  - Increment the build-report version constant in src/lib/report-versions.ts\n\nRelated: SCRUM-53 (umbrella for Build export formats — Word/DWG/SKP/RVT) is the parent. Once this bug is fixed, SCRUM-53 can drop "WORD" from its scope and become a smaller "DWG/SKP/RVT" follow-up.`
      ),
      issuetype: { name: "Bug" },
      labels: ["from-sweep", "build", "exports", "v0.4.x-hotfix-candidate"],
      priority: { name: "High" },
    },
  });
  if (newBug.body?.key) {
    console.log(`✓ Filed ${newBug.body.key} — Build Export Word bug`);
  } else {
    console.log("✗ Failed to file new bug:", JSON.stringify(newBug.body).slice(0, 300));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
