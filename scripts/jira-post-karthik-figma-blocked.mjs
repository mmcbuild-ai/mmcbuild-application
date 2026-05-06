#!/usr/bin/env node
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
          console.error(`  ✗ ${key} — ${res.statusCode}: ${raw.slice(0, 300)}`);
          return resolve(false);
        }
        console.log(`  ✓ ${key} — comment posted`);
        resolve(true);
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${key} — ${e.message}`); resolve(false); });
    req.setTimeout(20000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

const comments = {
  "SCRUM-116": `Status (Dennis, 20 Apr): this ticket is currently blocked on Figma file access.

I've posted a consolidated access request on SCRUM-60 asking Karen for (a) file URLs, (b) share access to dennis@corporateaisolutions.com, (c) no token needed from her. Target unblock: as soon as Karen replies.

Once access lands, I'll scope this "Figma integration" ticket as the concrete Figma-to-code merge task — Dashboard, Projects, and MMC Build first per your 15 Apr email, then the remaining modules. Target complete by your 25 Apr date.

No action needed from you on this ticket for now unless the scope I've described doesn't match what you had in mind — in which case please add detail here.`,
  "SCRUM-118": `Status (Dennis, 20 Apr): blocked on Figma file access — see SCRUM-60 for the consolidated request to Karen.

Will action the header removal / Figma alignment across the six modules + dashboard once I can inspect the Figma frames directly. Target complete by 25 Apr.

If you have a specific Figma frame URL showing the target subheader pattern, please paste it here — that would let me start on this ticket ahead of getting full file access.`,
  "SCRUM-119": `Status (Dennis, 20 Apr): blocked on Figma file access — see SCRUM-60 for the consolidated request to Karen.

This is paired with SCRUM-118 (header removal) — once I have Figma access I'll likely ship both in a single PR unless you want them tracked separately. Flag here if separate is preferred.

A Figma frame URL showing the expected subheader pattern would let me start sooner — otherwise waiting on the SCRUM-60 access resolution.`,
};

console.log(`Posting blocked notes on ${Object.keys(comments).length} tickets...\n`);
let ok = 0;
for (const [key, text] of Object.entries(comments)) {
  if (await postComment(key, text)) ok++;
}
console.log(`\n${ok}/${Object.keys(comments).length} comments posted.`);
