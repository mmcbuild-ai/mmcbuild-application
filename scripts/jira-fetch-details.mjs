#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      let v = rest.join("=").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[key.trim()] = v;
    }
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

const KEYS = process.argv.slice(2);
if (!KEYS.length) { console.error("usage: node scripts/jira-fetch-details.mjs SCRUM-115 SCRUM-117 ..."); process.exit(1); }

function api(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) { console.error(`  ✗ ${res.statusCode}: ${raw.slice(0, 200)}`); return resolve(null); }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${e.message}`); resolve(null); });
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) return node.content.map(adfToText).join(node.type === "paragraph" || node.type === "listItem" ? "\n" : "");
  return "";
}

for (const key of KEYS) {
  const issue = await api(`/rest/api/3/issue/${key}?fields=summary,status,reporter,assignee,created,updated,description,labels,priority`);
  if (!issue) continue;
  const f = issue.fields;
  console.log(`\n${"═".repeat(70)}`);
  console.log(`${key}: ${f.summary}`);
  console.log(`${"─".repeat(70)}`);
  console.log(`Status:   ${f.status?.name}`);
  console.log(`Reporter: ${f.reporter?.displayName || "?"} (${f.reporter?.emailAddress || "?"})`);
  console.log(`Assignee: ${f.assignee?.displayName || "unassigned"}`);
  console.log(`Priority: ${f.priority?.name || "—"}`);
  console.log(`Created:  ${f.created}`);
  console.log(`Updated:  ${f.updated}`);
  console.log(`Labels:   ${(f.labels || []).join(", ") || "—"}`);
  const desc = adfToText(f.description).trim();
  console.log(`\nDescription:\n${desc || "(empty)"}`);

  const comments = await api(`/rest/api/3/issue/${key}/comment`);
  if (comments?.comments?.length) {
    console.log(`\nComments (${comments.comments.length}):`);
    for (const c of comments.comments) {
      console.log(`  — ${c.author?.displayName} @ ${c.created}:`);
      console.log(`    ${adfToText(c.body).trim().replace(/\n/g, "\n    ")}`);
    }
  }
}
