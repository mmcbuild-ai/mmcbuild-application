#!/usr/bin/env node
/**
 * Find every SCRUM issue Karen has commented on — using accountId, not text search.
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

const main = async () => {
  // Find Karen's accountId
  const users = await api(`/rest/api/3/user/search?query=karen`);
  console.log("Users matching 'karen':");
  for (const u of users || []) {
    console.log(`  ${u.accountId}  ${u.displayName}  <${u.emailAddress || "—"}>`);
  }
  if (!users?.length) return;
  const karen = users[0];
  console.log(`\nUsing accountId ${karen.accountId} for ${karen.displayName}\n`);

  // Find issues where Karen has authored a comment, project-wide
  const jql = encodeURIComponent(`project = SCRUM AND issueFunction in commented("by ${karen.accountId}")`);
  let r = await api(`/rest/api/3/search/jql?jql=${jql}&fields=summary,status&maxResults=200`);
  if (!r || r.error) {
    // Fallback: brute-force scan all SCRUM issues for Karen comments
    console.log("issueFunction not available — scanning all SCRUM issues for Karen comments...\n");
    const all = await api(`/rest/api/3/search/jql?jql=${encodeURIComponent("project = SCRUM ORDER BY key DESC")}&fields=summary,status,comment&maxResults=200`);
    let count = 0;
    for (const i of (all?.issues || [])) {
      const cmts = (i.fields.comment?.comments || []).filter(c => c.author?.accountId === karen.accountId);
      if (cmts.length) {
        count++;
        console.log(`  ${i.key.padEnd(12)} [${i.fields.status?.name?.padEnd(12)}] ${cmts.length} comment(s) — ${i.fields.summary}`);
      }
    }
    console.log(`\nTotal: ${count} SCRUM issues with Karen comments.`);
  } else {
    for (const i of (r.issues || [])) {
      console.log(`  ${i.key.padEnd(12)} [${i.fields.status?.name?.padEnd(12)}] ${i.fields.summary}`);
    }
  }
};
main().catch(e => { console.error(e); process.exit(1); });
