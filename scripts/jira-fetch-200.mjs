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

function api(path) {
  return new Promise((resolve) => {
    https.request({ hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } }, (res) => {
      let raw = ""; res.on("data", (c) => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    }).on("error", (e) => resolve({ error: e.message })).end();
  });
}

const issue = await api(`/rest/api/3/issue/SCRUM-200?fields=summary,description,priority,status,labels,assignee,reporter,comment`);
console.log(`SCRUM-200: ${issue.fields?.summary}`);
console.log(`Status: ${issue.fields?.status?.name}`);
console.log(`Priority: ${issue.fields?.priority?.name}`);
console.log(`Reporter: ${issue.fields?.reporter?.displayName} <${issue.fields?.reporter?.emailAddress}>`);
console.log(`Assignee: ${issue.fields?.assignee?.displayName || "(unassigned)"}`);
console.log(`Labels: ${(issue.fields?.labels || []).join(", ") || "(none)"}`);
console.log(`\n--- Description ---`);

function adfToText(node) {
  if (!node) return "";
  if (node.text) return node.text;
  if (Array.isArray(node.content)) return node.content.map(adfToText).join(node.type === "paragraph" ? "" : "\n");
  return "";
}
console.log(adfToText(issue.fields?.description) || "(empty)");

console.log(`\n--- Comments (${issue.fields?.comment?.total || 0}) ---`);
for (const c of issue.fields?.comment?.comments || []) {
  console.log(`[${c.author?.displayName} @ ${c.created?.slice(0, 16)}]`);
  console.log(adfToText(c.body));
  console.log();
}
