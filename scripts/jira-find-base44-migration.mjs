#!/usr/bin/env node
/**
 * Find the SCRUM ticket where Dennis asked Karthik for the list of pages
 * to migrate from the base44 github repo. Show its current status, assignee,
 * and the most recent comment so we can decide whether to nudge.
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
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed = null;
          if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

function adfToText(adf) {
  if (!adf) return "";
  if (typeof adf === "string") return adf;
  if (Array.isArray(adf?.content)) {
    return adf.content.map(adfToText).join("\n");
  }
  if (adf?.text) return adf.text;
  if (adf?.content) return adfToText(adf.content);
  return "";
}

async function main() {
  // Atlassian deprecated GET /rest/api/3/search (410). Use POST /search/jql.
  const queries = [
    `project = ${PROJECT_KEY} AND text ~ "base44" ORDER BY created DESC`,
    `project = ${PROJECT_KEY} AND text ~ "migrate pages" ORDER BY created DESC`,
    `project = ${PROJECT_KEY} AND text ~ "list of pages" ORDER BY created DESC`,
    `project = ${PROJECT_KEY} AND text ~ "page migration" ORDER BY created DESC`,
    `project = ${PROJECT_KEY} AND text ~ "Karthik" AND text ~ "page" ORDER BY created DESC`,
  ];

  const seen = new Set();
  const hits = [];

  for (const jql of queries) {
    const r = await api("POST", `/rest/api/3/search/jql`, {
      jql,
      fields: ["summary", "status", "assignee", "reporter", "created", "updated"],
      maxResults: 10,
    });
    if (r.status >= 400) {
      console.log(`  ! query failed (${r.status}): ${jql.slice(0, 60)}...`);
      continue;
    }
    for (const issue of r.body?.issues || []) {
      if (seen.has(issue.key)) continue;
      seen.add(issue.key);
      hits.push({ jql, issue });
    }
  }

  if (hits.length === 0) {
    console.log("No matching SCRUM tickets found for base44 / page migration.");
    process.exit(0);
  }

  console.log(`Found ${hits.length} candidate ticket(s):\n${"=".repeat(70)}\n`);

  for (const { issue } of hits) {
    const f = issue.fields;
    console.log(`${issue.key}  [${f.status?.name}]  assignee: ${f.assignee?.displayName || "Unassigned"}`);
    console.log(`  Reporter: ${f.reporter?.displayName || "?"}`);
    console.log(`  Summary:  ${f.summary}`);
    console.log(`  Created:  ${f.created?.slice(0, 10)}    Updated: ${f.updated?.slice(0, 10)}`);

    // Pull recent comments
    const c = await api(
      "GET",
      `/rest/api/3/issue/${issue.key}/comment?orderBy=-created&maxResults=3`,
    );
    const comments = c.body?.comments || [];
    if (comments.length === 0) {
      console.log(`  Comments: (none)`);
    } else {
      console.log(`  Last ${comments.length} comment(s):`);
      for (const cm of comments) {
        const author = cm.author?.displayName || "?";
        const when = cm.created?.slice(0, 10);
        const text = adfToText(cm.body).trim().slice(0, 200).replace(/\s+/g, " ");
        console.log(`    [${when}] ${author}: ${text}${text.length >= 200 ? "..." : ""}`);
      }
    }
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
