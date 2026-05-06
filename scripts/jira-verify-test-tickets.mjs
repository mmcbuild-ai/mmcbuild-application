#!/usr/bin/env node
/**
 * Verify the 29 test regime tickets (SCRUM-124..152) — report:
 *   - issue type
 *   - status
 *   - current assignee
 *   - current sprint
 *   - watcher list
 * Plus show SCRUM-123 (parent) status.
 */
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

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function api(path) {
  return new Promise((resolve, reject) => {
    https.request({
      hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) return resolve({ error: res.statusCode, body: raw.slice(0, 200) });
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    }).on("error", reject).end();
  });
}

const state = JSON.parse(readFileSync(join(process.cwd(), "tests", ".jira-state.json"), "utf8"));
const keys = [state.parent, ...Object.values(state.testCases)];

const main = async () => {
  console.log(`Verifying ${keys.length} tickets (SCRUM-123 parent + 29 tests)\n`);
  const rows = [];
  for (const k of keys) {
    const r = await api(`/rest/api/3/issue/${k}?fields=summary,status,issuetype,assignee,customfield_10020,labels`);
    if (r.error) { rows.push({ key: k, error: r.error }); continue; }
    const f = r.fields;
    const sprints = f.customfield_10020 || [];
    const sprintName = sprints.length ? sprints.map(s => typeof s === "string" ? s : s.name).join(",") : "—";
    rows.push({
      key: k,
      type: f.issuetype?.name,
      status: f.status?.name,
      assignee: f.assignee?.displayName || "—",
      sprint: sprintName,
      summary: (f.summary || "").slice(0, 60),
    });
    await new Promise(r => setTimeout(r, 100));
  }
  console.table(rows);
  const byStatus = {};
  const byType = {};
  const byAssignee = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    byAssignee[r.assignee] = (byAssignee[r.assignee] || 0) + 1;
  }
  console.log("\nStatus:", byStatus);
  console.log("Type:", byType);
  console.log("Assignee:", byAssignee);
};
main().catch(e => { console.error(e); process.exit(1); });
