#!/usr/bin/env node
/**
 * Diagnose: list all sprints on board 1, and check what's actually in Sprint 5.
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
const HOST = process.env.JIRA_HOST;
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString("base64");
const api = (m, p, b = null) => new Promise((res) => {
  const d = b ? JSON.stringify(b) : null;
  const req = https.request({ hostname: HOST, path: p, method: m, headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", ...(d ? { "Content-Length": Buffer.byteLength(d) } : {}) } }, (r) => {
    let raw = "";
    r.on("data", (c) => (raw += c));
    r.on("end", () => { if (r.statusCode >= 400) return res({ error: r.statusCode, body: raw.slice(0, 300) }); try { res(raw ? JSON.parse(raw) : {}); } catch { res(raw); } });
  });
  req.on("error", (e) => res({ error: e.message }));
  if (d) req.write(d);
  req.end();
});

const main = async () => {
  console.log("\n=== All sprints on board 1 ===\n");
  const sprints = await api("GET", "/rest/agile/1.0/board/1/sprint");
  for (const s of sprints.values || []) {
    console.log(`  id=${s.id} state=${s.state.padEnd(6)} name="${s.name}"`);
  }

  // Find our Sprint 5
  const sprint5 = sprints.values?.find(s => s.name.startsWith("Sprint 5"));
  if (sprint5) {
    console.log(`\n=== Issues in ${sprint5.name} (id=${sprint5.id}) ===\n`);
    const issues = await api("GET", `/rest/agile/1.0/sprint/${sprint5.id}/issue?fields=summary,status,assignee&maxResults=100`);
    for (const i of issues.issues || []) {
      console.log(`  ${i.key.padEnd(12)} ${i.fields.status.name.padEnd(12)} ${(i.fields.assignee?.displayName || "—").padEnd(15)} ${i.fields.summary.slice(0, 55)}`);
    }
    console.log(`  Total: ${issues.issues?.length || 0}`);
  }

  // Find the active Sprint 4
  const sprint4 = sprints.values?.find(s => s.state === "active");
  if (sprint4) {
    console.log(`\n=== Active sprint: ${sprint4.name} (id=${sprint4.id}) ===\n`);
    const issues = await api("GET", `/rest/agile/1.0/sprint/${sprint4.id}/issue?fields=summary,status,assignee,issuetype&maxResults=100`);
    const outstanding = (issues.issues || []).filter(i => !["Done", "Closed", "Resolved"].includes(i.fields.status.name));
    for (const i of outstanding) {
      console.log(`  ${i.key.padEnd(12)} ${i.fields.status.name.padEnd(12)} ${i.fields.issuetype.name.padEnd(8)} ${(i.fields.assignee?.displayName || "—").padEnd(15)} ${i.fields.summary.slice(0, 55)}`);
    }
    console.log(`  Outstanding: ${outstanding.length} / ${issues.issues?.length || 0}`);
  }
};
main().catch(e => { console.error(e); process.exit(1); });
