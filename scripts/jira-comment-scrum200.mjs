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

const lines = [
  "Access swap progress (rao.kar@gmail.com -> karthik.rao@mmcbuild.com.au):",
  "",
  "Done:",
  "- R&D Tax Eligibility Work Recording: auth.users email updated; pre-confirmed; user history preserved.",
  "- Vercel: new 'MMC Build' team created on Dennis's account; mmcbuild project transferred from 'Corporate AI Solutions' team to 'MMC Build' team; Karen and Karthik invited to the new team. R&D tracker stays in CAS (separation of concerns).",
  "- Local dev repo re-linked to new team via 'vercel link'.",
  "",
  "Pending Karthik (self-service):",
  "- Atlassian login email: add karthik.rao@mmcbuild.com.au, make primary, remove rao.kar@gmail.com (id.atlassian.com).",
  "- GitHub: choose between (a) renaming primary email on existing karthik281 account, or (b) creating a new GitHub account and sharing the new username for invite.",
  "",
  "Out of scope here: Inngest/Anthropic/OpenAI/Stripe/Resend/Supabase migration to billing@ and tech@ aliases (separate workstream Karthik is driving).",
];

const adfBody = {
  type: "doc",
  version: 1,
  content: lines.map(text => text === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text }] }),
};

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = ""; res.on("data", (c) => raw += c);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const r = await api("POST", "/rest/api/3/issue/SCRUM-200/comment", { body: adfBody });
console.log(`Comment posted. id=${r.id} created=${r.created}`);
