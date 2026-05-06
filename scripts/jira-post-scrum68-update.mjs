#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim();
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function adfDoc(text) {
  const paragraphs = text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  }));
  return { type: "doc", version: 1, content: paragraphs };
}

function postComment(key, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ body: adfDoc(text) });
    const req = https.request({
      hostname: HOST,
      path: `/rest/api/3/issue/${key}/comment`,
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          console.error(`  ✗ ${key} — ${res.statusCode}: ${raw.slice(0, 200)}`);
          return resolve(false);
        }
        console.log(`  ✓ ${key} — comment posted`);
        resolve(true);
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${key} — ${e.message}`); resolve(false); });
    req.setTimeout(20000, () => { req.destroy(); console.error(`  ✗ ${key} — timeout`); resolve(false); });
    req.write(body);
    req.end();
  });
}

const comments = {
  "SCRUM-68": `Progress update (Dennis, 20 Apr 2026):

Content migration from Base44 website into MMC Build Next.js repo is DELIVERED (commit a8a683e). Approach as agreed with Karthik via email (10 Apr): rebuilt the marketing pages as Next.js App Router server components rather than merging the Vite SPA codebase.

New routes live under the (marketing) route group:
- /about — mission, values, leadership team (Karen, Michael, Karthik)
- /privacy — privacy policy
- /terms — terms of use
- /blog — article listing (4 posts; bodies still TBC)
- /case-studies — Morpeth Gardens Country Club + 44 Hugh Street Residence
- /contact — form wired to HubSpot portal 442558966 / form 9ef67321 (Karen's Azzure account preserved as Karthik requested)

Main landing nav + footer updated to link to the new pages.

Remaining before close:
1. Verify HubSpot form submissions land in Karen's Azzure portal on Vercel preview.
2. Port the 4 blog post bodies once Karen/Karthik confirm content.
3. Coordinate DNS cutover with Karthik (SCRUM-84) and cancel Base44 subscription ($40–50/month saving).
4. Deprecate the mmcbuild-ai/mmcbuild-webapp repo once cutover is confirmed.

Status suggestion: move to In Review once preview URL is verified against HubSpot.`,
  "SCRUM-73": `Status check (Dennis, 20 Apr 2026): NOT started.

No scripts/token-test-runner.ts exists. /test-results/ contains the Playwright test regime output only — no token-usage-*.json or pricing summary yet.

This remains outstanding for Sprint 4. Execution plan is captured in docs/sprint-v0.4.0-execution-brief.md Task 7 (create script, run 10 passes, produce cost projection at Trial 10/mo and Pro 50/mo tiers). Will action after SCRUM-68 verification and before next sprint review.`,
};

console.log(`Posting ${Object.keys(comments).length} comments to ${HOST}\n`);
let ok = 0;
for (const [key, text] of Object.entries(comments)) {
  if (await postComment(key, text)) ok++;
}
console.log(`\n${ok}/${Object.keys(comments).length} comments posted.`);
