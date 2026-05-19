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

const boards = await api(`/rest/agile/1.0/board?projectKeyOrId=SCRUM`);
const board = boards.values[0];
console.log(`Board: ${board.name} (id ${board.id})\n`);

for (const state of ["active", "future"]) {
  const sprints = await api(`/rest/agile/1.0/board/${board.id}/sprint?state=${state}`);
  console.log(`--- ${state.toUpperCase()} sprints ---`);
  for (const s of sprints.values || []) {
    console.log(`  [${s.id}] ${s.name}  (${s.startDate?.slice(0,10) || '?'} → ${s.endDate?.slice(0,10) || '?'})`);
  }
}

console.log(`\n--- Assignable users for SCRUM ---`);
const users = await api(`/rest/api/3/user/assignable/search?project=SCRUM&maxResults=50`);
for (const u of users || []) {
  console.log(`  ${u.accountId.padEnd(28)} ${(u.displayName || '').padEnd(25)} ${u.emailAddress || ''}`);
}

console.log(`\n--- Existing tickets touching base44 / migration / vercel ---`);
const jql = encodeURIComponent('project = SCRUM AND statusCategory != Done AND (text ~ "base44" OR text ~ "migration" OR text ~ "vercel" OR text ~ "supabase" OR text ~ "hubspot" OR text ~ "VentraIP" OR text ~ "logo")');
const search = await api(`/rest/api/3/search?jql=${jql}&fields=summary,status,assignee,issuetype&maxResults=50`);
for (const i of search.issues || []) {
  console.log(`  ${i.key.padEnd(11)} [${(i.fields.issuetype?.name || '?').padEnd(5)}] ${(i.fields.status?.name || '').padEnd(12)} ${(i.fields.assignee?.displayName || 'unassigned').padEnd(20)} ${i.fields.summary}`);
}
