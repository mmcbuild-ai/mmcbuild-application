#!/usr/bin/env node
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
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function adfDoc(text) {
  return { type: "doc", version: 1, content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
}

function postComment(key, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ body: adfDoc(text) });
    const req = https.request({
      hostname: HOST, path: `/rest/api/3/issue/${key}/comment`, method: "POST",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) { console.error(`X ${key} ${res.statusCode}: ${raw.slice(0, 300)}`); return resolve(false); }
        console.log(`OK ${key} - comment posted`); resolve(true);
      });
    });
    req.on("error", (e) => { console.error(`X ${key} ${e.message}`); resolve(false); });
    req.setTimeout(20000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

const COMMENT = `Karthik - logo is now live across the app. Shipped in commit a8c4631 on main, deployed via Vercel.

Placed in 6 locations:
- Dashboard sidebar (top-left, replaces the placeholder "M")
- Marketing site navbar (top-left of homepage)
- Marketing site footer
- Login card
- Signup card
- Forgot-password card
- Public remediation portal header

Used the official mmcbuildlogo.png asset committed to /public. Sized appropriately per context (32-64px) and uses Next.js Image for optimisation. Please verify on the live site and close if it looks correct, or flag any pages I missed.`;

const main = async () => {
  console.log(`Posting comment to SCRUM-120 on ${HOST}\n`);
  const ok = await postComment("SCRUM-120", COMMENT);
  if (!ok) process.exit(1);
};
main().catch((e) => { console.error(e); process.exit(1); });
