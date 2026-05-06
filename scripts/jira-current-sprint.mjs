#!/usr/bin/env node
/**
 * List all outstanding items in the active sprint.
 * Outstanding = status is not Done / Closed / Resolved.
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

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function api(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) { console.error(`  ✗ ${res.statusCode} @ ${path}: ${raw.slice(0, 300)}`); return resolve(null); }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${e.message}`); resolve(null); });
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function main() {
  console.log(`Host: ${HOST}`);
  console.log(`Auth: ${EMAIL} / token ${TOKEN ? "present" : "MISSING"}\n`);

  // 1. Find boards for project SCRUM
  const boards = await api(`/rest/agile/1.0/board?projectKeyOrId=SCRUM`);
  if (!boards?.values?.length) {
    console.error("No boards found for project SCRUM.");
    return;
  }
  console.log(`Boards found:`);
  for (const b of boards.values) console.log(`  [${b.id}] ${b.name} (${b.type})`);

  // 2. For each board, find active sprints
  for (const board of boards.values) {
    const sprints = await api(`/rest/agile/1.0/board/${board.id}/sprint?state=active`);
    if (!sprints?.values?.length) {
      console.log(`\nBoard ${board.name}: no active sprints`);
      continue;
    }
    for (const sprint of sprints.values) {
      console.log(`\n${"═".repeat(78)}`);
      console.log(`ACTIVE SPRINT: ${sprint.name}  (id ${sprint.id})`);
      console.log(`State: ${sprint.state}   Start: ${sprint.startDate}   End: ${sprint.endDate}`);
      console.log(`Goal: ${sprint.goal || "(none)"}`);
      console.log(`${"═".repeat(78)}`);

      // 3. Fetch all issues in the sprint (paginated)
      let startAt = 0;
      const all = [];
      while (true) {
        const page = await api(`/rest/agile/1.0/sprint/${sprint.id}/issue?fields=summary,status,assignee,priority,issuetype,updated&maxResults=100&startAt=${startAt}`);
        if (!page?.issues?.length) break;
        all.push(...page.issues);
        if (page.issues.length < 100) break;
        startAt += 100;
      }

      const outstanding = all.filter((i) => {
        const name = (i.fields.status?.name || "").toLowerCase();
        const cat = (i.fields.status?.statusCategory?.key || "").toLowerCase();
        return cat !== "done" && !["done", "closed", "resolved", "cancelled", "canceled"].includes(name);
      });
      const done = all.length - outstanding.length;

      console.log(`\nTotal issues: ${all.length}   Outstanding: ${outstanding.length}   Done: ${done}\n`);

      // Group outstanding by status
      const byStatus = {};
      for (const i of outstanding) {
        const s = i.fields.status?.name || "Unknown";
        (byStatus[s] ||= []).push(i);
      }

      for (const [status, list] of Object.entries(byStatus)) {
        console.log(`\n── ${status} (${list.length}) ──`);
        for (const i of list) {
          const a = i.fields.assignee?.displayName || "unassigned";
          const t = i.fields.issuetype?.name || "?";
          const p = i.fields.priority?.name || "";
          console.log(`  ${i.key.padEnd(12)} [${t.padEnd(7)}] ${p.padEnd(8)} ${a.padEnd(22)} ${i.fields.summary}`);
        }
      }
    }
  }
}

main();
