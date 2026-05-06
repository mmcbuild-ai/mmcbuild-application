#!/usr/bin/env node
/**
 * List (1) remaining outstanding items in Sprint 4 (internal id 3 or whichever
 * is active/just-ended) and (2) backlog items in SCRUM project.
 * Produces a JSON file for the triage script to consume.
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      let v = rest.join("=").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[key.trim()] = v;
    }
  });
}
const HOST = process.env.JIRA_HOST;
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString("base64");

function api(method, path, body = null) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) return resolve({ error: res.statusCode, body: raw.slice(0, 300) });
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on("error", (e) => resolve({ error: "NETWORK", body: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

const search = async (jql) => {
  const r = await api("POST", "/rest/api/3/search/jql", {
    jql,
    fields: ["summary", "status", "issuetype", "assignee", "customfield_10020", "priority", "parent", "labels"],
    maxResults: 100,
  });
  return r?.issues || [];
};

const main = async () => {
  console.log(`\nTriage list — ${HOST}\n${"=".repeat(60)}\n`);

  // 1. Sprint 4 leftovers (not Done)
  const sprint4 = await search(`project = SCRUM AND sprint = "Sprint 4 - v0.4.0" AND statusCategory != Done`);
  console.log(`Sprint 4 leftovers (${sprint4.length}):\n`);
  const s4 = sprint4.map(i => ({
    key: i.key,
    status: i.fields.status.name,
    type: i.fields.issuetype.name,
    assignee: i.fields.assignee?.displayName || "—",
    priority: i.fields.priority?.name || "—",
    summary: i.fields.summary,
    labels: (i.fields.labels || []).join(","),
  }));
  console.table(s4.map(x => ({ ...x, summary: x.summary.slice(0, 55) })));

  // 2. Backlog — issues not in any sprint (future or active), not Done
  // customfield_10020 holds sprint array; empty or null means backlog
  const backlog = await search(`project = SCRUM AND sprint is EMPTY AND statusCategory != Done`);
  console.log(`\nBacklog items not in any sprint (${backlog.length}):\n`);
  const bk = backlog.map(i => ({
    key: i.key,
    status: i.fields.status.name,
    type: i.fields.issuetype.name,
    assignee: i.fields.assignee?.displayName || "—",
    priority: i.fields.priority?.name || "—",
    summary: i.fields.summary,
    labels: (i.fields.labels || []).join(","),
  }));
  console.table(bk.map(x => ({ ...x, summary: x.summary.slice(0, 55) })));

  writeFileSync(join(process.cwd(), "scripts", ".triage-state.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sprint4Leftovers: s4,
    backlog: bk,
  }, null, 2));
  console.log(`\n   ✓ Written scripts/.triage-state.json`);
};
main().catch(e => { console.error(e); process.exit(1); });
