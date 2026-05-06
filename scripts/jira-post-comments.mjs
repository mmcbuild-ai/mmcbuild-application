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
  "SCRUM-115": `Hi Karthik — can you add detail here? Is this a process change (apply TDD to all future sprints) or scoped to a specific module? What's the acceptance criterion for closing this ticket?`,
  "SCRUM-116": `Hi Karthik — can you clarify what "Figma integration" means here? Options: (a) live design-token sync, (b) component library import, (c) manual alignment to Karen's Figma. Also — is this blocked on SCRUM-60 (Karen's final colours/fonts)?`,
  "SCRUM-117": `Hi Karthik — is this a Jira admin config change (I can action in ~5 min), or do you want a specific workflow/screen scheme with it? If just the work types, confirm and I'll add them.`,
  "SCRUM-118": `Hi Karthik — thanks, description is helpful. Can you confirm scope: does this apply to all six modules (Comply/Build/Quote/Direct/Train/Billing) and the dashboard, or only specific pages? A link to the Figma frame showing the expected subheader pattern would unblock this.`,
  "SCRUM-119": `Hi Karthik — can you add detail on what subheader changes are needed? This looks paired with SCRUM-118 — should we merge them or keep separate? Figma reference link would help.`,
  "SCRUM-120": `Hi Karthik — need more detail to action: which page/route, which icon is missing, and what the expected icon is (screenshot or Figma ref). Also — is this blocking a test case in the regime?`,
};

console.log(`Posting ${Object.keys(comments).length} comments to ${HOST}\n`);
let ok = 0;
for (const [key, text] of Object.entries(comments)) {
  if (await postComment(key, text)) ok++;
}
console.log(`\n${ok}/${Object.keys(comments).length} comments posted.`);
