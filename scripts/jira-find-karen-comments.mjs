#!/usr/bin/env node
/**
 * Find every Jira issue Karen has commented on, plus any "test" / "regime" tickets.
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

function adfText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.text) return node.text;
  if (Array.isArray(node.content)) return node.content.map(adfText).join("");
  if (node.type === "hardBreak") return "\n";
  if (node.type === "paragraph") return (node.content || []).map(adfText).join("") + "\n";
  if (node.type === "listItem") return "  • " + (node.content || []).map(adfText).join("");
  return (node.content || []).map(adfText).join("");
}

const main = async () => {
  // 1) Search all SCRUM issues with "test" in summary OR labels
  console.log("=== Issues mentioning 'test' or 'regime' (any status) ===\n");
  const jql = encodeURIComponent(`project = SCRUM AND (summary ~ "test" OR summary ~ "regime" OR labels in (test,test-regime,QA))`);
  const search = await api(`/rest/api/3/search/jql?jql=${jql}&fields=summary,status,assignee,comment&maxResults=100`);
  const issues = search?.issues || [];
  console.log(`Found ${issues.length} issues\n`);

  for (const i of issues) {
    const cmts = i.fields.comment?.comments || [];
    const karen = cmts.filter(c => /karen/i.test(c.author?.displayName || c.author?.emailAddress || ""));
    const total = cmts.length;
    const flag = karen.length ? `★ KAREN: ${karen.length}` : (total ? `${total} other` : "—");
    console.log(`  ${i.key.padEnd(12)} ${(i.fields.status?.name || "").padEnd(12)} ${(i.fields.assignee?.displayName || "—").padEnd(18)} [${flag.padEnd(15)}] ${i.fields.summary}`);
  }

  // 2) Now find ANY issue Karen has commented on (project-wide)
  console.log("\n\n=== Every SCRUM issue Karen has commented on ===\n");
  const jql2 = encodeURIComponent(`project = SCRUM AND comment ~ "*" ORDER BY updated DESC`);
  const all = await api(`/rest/api/3/search/jql?jql=${jql2}&fields=summary,status,comment&maxResults=200`);
  let karenCount = 0;
  for (const i of (all?.issues || [])) {
    const karen = (i.fields.comment?.comments || []).filter(c => /karen/i.test(c.author?.displayName || c.author?.emailAddress || ""));
    if (!karen.length) continue;
    karenCount++;
    console.log(`\n── ${i.key}  [${i.fields.status?.name}]  ${i.fields.summary}`);
    for (const c of karen) {
      const when = c.created?.slice(0, 16).replace("T", " ");
      console.log(`   @ ${when}`);
      const text = adfText(c.body).trim();
      console.log("   " + text.split("\n").join("\n   "));
    }
  }
  if (!karenCount) console.log("(none found in last 200 issues)");
};
main().catch(e => { console.error(e); process.exit(1); });
