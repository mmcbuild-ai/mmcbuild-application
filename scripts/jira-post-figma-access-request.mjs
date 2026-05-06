#!/usr/bin/env node
/**
 * Post a Figma-access request comment on SCRUM-60 (Karen's In Progress
 * final colours/fonts ticket — most relevant and notifies her directly).
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

const comment = `Hi Karen — following Karthik's email of 15 Apr (target 25 Apr for Figma merge into MMC Build), I need access to your Figma files so I can pull the designs into the repo. You're currently holding further design iteration until the merge is complete, so this is the unblock.

What I need from you (three items):

1. The Figma file URL(s) for each of the following:
   — Your final colours, fonts and components spec (this ticket — SCRUM-60)
   — MMC Direct page design (SCRUM-75)
   — MMC Train page design (SCRUM-75)
   — Dashboard, Projects, and MMC Build page designs (Karthik's current test focus per his 15 Apr email)

The only Figma URL you've shared in Jira so far is the Figma Make sidebar file on SCRUM-75 (figma.com/make/.../Minimalist-sidebar-component). Is that where Direct and Train live too, or are they in separate files? If separate, please paste the URLs here.

2. Edit access (preferred) or Dev-Mode viewer access to each file. To do this:
   — Open the Figma file → click Share (top right)
   — Add dennis@corporateaisolutions.com
   — Set role to Editor (or at minimum "Can view" with Dev Mode enabled on the file)

This lets me inspect frames, copy exact colour/typography/spacing tokens, and pull component structure into Next.js + Tailwind without guessing.

If you have a Figma team rather than individual files, adding me to the team is even simpler — one invite covers every file.

3. No token needed from you. Once I have file access under my own account, I'll generate my own Figma Personal Access Token (under my own settings) to pull frames via the Figma API for automated sync. You just need to grant my email access to the files.

What happens after access lands:
I'll scope the Figma-to-code merge as a concrete story with timeline, align Dashboard + Projects + MMC Build first (Karthik's priority), then the remaining three modules. Target complete by 25 Apr.

If easier, happy to jump on a 10-minute call to walk through the files together. Otherwise a reply here with the URLs + the share invite is all I need.

Thanks — Dennis`;

console.log("Posting Figma access request on SCRUM-60...\n");
const ok = await postComment("SCRUM-60", comment);
if (ok) {
  console.log("\nDone. Karen will be notified via the ticket.");
  console.log("Also consider pinning this request on SCRUM-75 — let me know if you want a shorter cross-reference posted there.");
}
