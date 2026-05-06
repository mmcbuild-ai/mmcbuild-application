#!/usr/bin/env node
/**
 * Find Sprint 4 items NOT carried over to Sprint 5.
 * Show full Sprint 5 breakdown by assignee.
 */
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

const api = (p) => new Promise((res) => {
  const req = https.request({ hostname: HOST, path: p, method: "GET", headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } }, (r) => {
    let raw = ""; r.on("data", (c) => raw += c);
    r.on("end", () => { if (r.statusCode >= 400) return res({ error: r.statusCode, body: raw.slice(0, 300) }); try { res(JSON.parse(raw)); } catch { res(null); } });
  });
  req.on("error", (e) => res({ error: e.message }));
  req.setTimeout(20000, () => { req.destroy(); res(null); });
  req.end();
});

const fetchAll = async (sprintId) => {
  let all = [], startAt = 0;
  while (true) {
    const page = await api(`/rest/agile/1.0/sprint/${sprintId}/issue?fields=summary,status,assignee,issuetype,priority,labels&maxResults=100&startAt=${startAt}`);
    if (!page?.issues?.length) break;
    all.push(...page.issues);
    if (page.issues.length < 100) break;
    startAt += 100;
  }
  return all;
};

const main = async () => {
  const SPRINT4 = 3, SPRINT5 = 4;
  const [s4, s5] = await Promise.all([fetchAll(SPRINT4), fetchAll(SPRINT5)]);
  const s5Keys = new Set(s5.map(i => i.key));

  console.log(`\nSprint 4 total: ${s4.length}   Sprint 5 total: ${s5.length}\n`);

  // ── Sprint 4 leftovers (not in Sprint 5) ──
  const leftovers = s4.filter(i => !s5Keys.has(i.key));
  const leftoversByStatus = { Done: [], Outstanding: [] };
  for (const i of leftovers) {
    const cat = (i.fields.status?.statusCategory?.key || "").toLowerCase();
    const name = (i.fields.status?.name || "").toLowerCase();
    if (cat === "done" || ["done", "closed", "resolved"].includes(name)) leftoversByStatus.Done.push(i);
    else leftoversByStatus.Outstanding.push(i);
  }

  console.log(`═══ SPRINT 4 LEFTOVERS (in Sprint 4, NOT in Sprint 5) ═══`);
  console.log(`   Done in S4: ${leftoversByStatus.Done.length}   Outstanding (dropped): ${leftoversByStatus.Outstanding.length}\n`);

  if (leftoversByStatus.Outstanding.length) {
    console.log(`── DROPPED / NOT TRANSFERRED (still open at Sprint 4 close) ──`);
    for (const i of leftoversByStatus.Outstanding) {
      const a = i.fields.assignee?.displayName || "unassigned";
      const s = i.fields.status?.name || "?";
      console.log(`  ${i.key.padEnd(12)} ${s.padEnd(14)} ${a.padEnd(20)} ${i.fields.summary}`);
    }
  }

  if (leftoversByStatus.Done.length) {
    console.log(`\n── COMPLETED IN SPRINT 4 (for context) ──`);
    for (const i of leftoversByStatus.Done) {
      const a = i.fields.assignee?.displayName || "unassigned";
      console.log(`  ${i.key.padEnd(12)} ${(i.fields.status?.name || "").padEnd(10)} ${a.padEnd(20)} ${i.fields.summary}`);
    }
  }

  // ── Sprint 5 by assignee ──
  console.log(`\n\n═══ SPRINT 5 — by assignee ═══\n`);
  const byAssignee = {};
  for (const i of s5) {
    const a = i.fields.assignee?.displayName || "UNASSIGNED";
    (byAssignee[a] ||= []).push(i);
  }
  const order = Object.keys(byAssignee).sort();
  for (const a of order) {
    console.log(`── ${a} (${byAssignee[a].length}) ──`);
    for (const i of byAssignee[a]) {
      const s = i.fields.status?.name || "?";
      const t = i.fields.issuetype?.name || "?";
      const p = i.fields.priority?.name || "";
      console.log(`  ${i.key.padEnd(12)} ${s.padEnd(14)} [${t.padEnd(6)}] ${p.padEnd(7)} ${i.fields.summary}`);
    }
    console.log();
  }
};

main().catch(e => { console.error(e); process.exit(1); });
