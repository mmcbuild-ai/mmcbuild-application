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

const comment = `Karen — cross-reference from SCRUM-60: I've posted a full Figma access request there (please reply on SCRUM-60 to keep the thread in one place).

Short version of what I need:

1. File URLs for MMC Direct and MMC Train page designs — the only link on this ticket so far is your Figma Make sidebar file from 13 Apr. Are Direct and Train nested in that same Make project, or are they separate files? If separate, please paste the URLs on SCRUM-60.

2. Share access to dennis@corporateaisolutions.com on each file (Figma → Share → add email → Editor or Dev-Mode viewer). If you have a Figma team, adding me to the team covers everything in one invite.

3. No token from you — once I have file access I'll generate my own Figma Personal Access Token to automate the sync.

Target: pull the designs into the repo before Karthik's 25 Apr deadline.

Only jump to a 10-minute call if the above isn't clear — should be quick if you can follow the three steps. Thanks — Dennis`;

console.log("Posting cross-reference on SCRUM-75...\n");
await postComment("SCRUM-75", comment);
