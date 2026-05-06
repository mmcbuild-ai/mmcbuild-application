#!/usr/bin/env node
/**
 * Pull Karen's most recent comments across the SCRUM project.
 * One-off review tool — prints each comment in full so we can decide what needs action.
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

function get(path) {
  return new Promise((resolve) => {
    const req = https.request({ hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } }, (res) => {
      let raw = ""; res.on("data", (c) => raw += c);
      res.on("end", () => {
        if (res.statusCode >= 400) return resolve({ error: res.statusCode, body: raw.slice(0, 300) });
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", (e) => resolve({ error: e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function adfText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.text) return node.text;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "paragraph") return (node.content || []).map(adfText).join("") + "\n";
  if (node.type === "listItem") return "  • " + (node.content || []).map(adfText).join("");
  if (node.type === "bulletList" || node.type === "orderedList")
    return (node.content || []).map(adfText).join("\n");
  return (node.content || []).map(adfText).join("");
}

async function main() {
  // Strategy: paginate through all SCRUM issues sorted by updated DESC,
  // pull comments, surface ones authored by Karen in the last ~30 days.
  const SINCE = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const items = [];
  let startAt = 0;
  const PAGE = 100;
  const MAX_PAGES = 5; // 500 issues max

  for (let p = 0; p < MAX_PAGES; p++) {
    const jql = encodeURIComponent(`project = SCRUM ORDER BY updated DESC`);
    const url = `/rest/api/3/search/jql?jql=${jql}&fields=summary,status,comment,updated&maxResults=${PAGE}&nextPageToken=${startAt}`;
    const res = await get(url);
    const issues = res?.issues || [];
    if (!issues.length) break;

    for (const i of issues) {
      const cmts = i.fields.comment?.comments || [];
      for (const c of cmts) {
        const author = c.author?.displayName || c.author?.emailAddress || "";
        if (!/karen/i.test(author)) continue;
        const created = new Date(c.created).getTime();
        if (created < SINCE) continue;
        items.push({
          key: i.key,
          summary: i.fields.summary,
          status: i.fields.status?.name,
          created: c.created,
          author,
          text: adfText(c.body).trim(),
        });
      }
    }

    if (res?.nextPageToken) startAt = res.nextPageToken;
    else if (issues.length < PAGE) break;
    else startAt += PAGE;
  }

  items.sort((a, b) => b.created.localeCompare(a.created));

  console.log(`Karen comments in last 30 days: ${items.length}\n`);
  for (const it of items) {
    const when = it.created.slice(0, 16).replace("T", " ");
    console.log(`── ${it.key}  [${it.status}]  ${when}`);
    console.log(`   ${it.summary}`);
    console.log("   " + it.text.split("\n").join("\n   "));
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
