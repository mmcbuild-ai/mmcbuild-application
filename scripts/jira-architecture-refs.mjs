#!/usr/bin/env node
/**
 * Sweep SCRUM for any Karen/Karthik signal on the 3-layer environment architecture
 * (dev sandbox / UAT / production), branch model, Vercel/Supabase setup, base44 migration,
 * repo ownership, branch protection, CI gating, etc.
 *
 * Output: one block per ticket that has either (a) a Karen/Karthik comment matching
 * architecture keywords, or (b) Karen/Karthik as reporter/assignee on a matching ticket.
 *
 * Read-only. Safe to re-run.
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
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
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

const KEYWORD_GROUPS = [
  // Branch and repo model
  ["branch", "branches", "branching"],
  ["repo", "repository", "github repo"],
  ["fork", "clone"],
  ["main branch", "release branch", "feature branch"],
  ["branch protection", "merge", "PR"],
  // Environment topology
  ["environment", "environments", "env"],
  ["staging"],
  ["UAT", "uat"],
  ["dev environment", "sandbox"],
  ["preview"],
  // Platforms
  ["vercel"],
  ["supabase"],
  ["base44"],
  // Process and ops
  ["migration", "migrate"],
  ["deploy", "deployment"],
  ["CI", "pipeline"],
  ["DNS", "subdomain"],
  ["webhook"],
];

const PEOPLE = /karen|karthik/i;

async function search(jql) {
  const r = await api("POST", `/rest/api/3/search/jql`, {
    jql,
    fields: ["summary", "status", "assignee", "reporter", "created", "updated", "issuetype"],
    maxResults: 50,
  });
  if (r.status >= 400) {
    console.error(`  ! query failed (${r.status}): ${jql.slice(0, 80)}`);
    return [];
  }
  return r.body?.issues || [];
}

async function getComments(key) {
  const r = await api("GET", `/rest/api/3/issue/${key}/comment?orderBy=-created&maxResults=50`);
  if (r.status >= 400) return [];
  return r.body?.comments || [];
}

async function main() {
  console.log("Sweeping SCRUM for Karen/Karthik signal on environment/repo architecture…\n");

  // Build a single OR'd JQL across all keyword groups, plus tickets where Karen or Karthik
  // are reporter or assignee.
  const textClauses = KEYWORD_GROUPS
    .flat()
    .map((k) => `text ~ "${k}"`)
    .join(" OR ");

  const queries = [
    // Tickets whose body or comments mention any architecture keyword
    `project = ${PROJECT_KEY} AND (${textClauses}) ORDER BY updated DESC`,
    // Tickets reported by Karen/Karthik (any topic — we'll filter by keyword later)
    `project = ${PROJECT_KEY} AND reporter in (currentUser()) IS EMPTY OR reporter = "Karen" OR reporter = "Karthik" ORDER BY updated DESC`,
  ];

  const seen = new Map(); // key → issue
  for (const jql of queries) {
    const issues = await search(jql);
    for (const i of issues) if (!seen.has(i.key)) seen.set(i.key, i);
  }

  console.log(`Candidate tickets (architecture keyword OR Karen/Karthik authored): ${seen.size}\n`);

  // For each candidate, fetch comments and find Karen/Karthik signal
  const findings = [];

  let n = 0;
  for (const issue of seen.values()) {
    n++;
    process.stderr.write(`\r  scanning ${n}/${seen.size} ${issue.key}        `);

    const f = issue.fields;
    const reporter = f.reporter?.displayName || "";
    const assignee = f.assignee?.displayName || "";
    const summary = f.summary || "";

    const isPersonReporter = PEOPLE.test(reporter);
    const isPersonAssignee = PEOPLE.test(assignee);

    const comments = await getComments(issue.key);
    const personComments = comments.filter((c) => PEOPLE.test(c.author?.displayName || ""));

    const matchesKeyword = (text) =>
      KEYWORD_GROUPS.some((group) =>
        group.some((kw) => new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)),
      );

    const summaryHits = matchesKeyword(summary);

    const archComments = personComments
      .map((c) => ({ ...c, _text: adfText(c.body).trim() }))
      .filter((c) => matchesKeyword(c._text) || summaryHits);

    if (archComments.length === 0 && !((isPersonReporter || isPersonAssignee) && summaryHits)) {
      continue;
    }

    findings.push({
      issue,
      isPersonReporter,
      isPersonAssignee,
      summaryHits,
      archComments,
    });
  }

  process.stderr.write("\r" + " ".repeat(60) + "\r");

  console.log(`\nMatches: ${findings.length} ticket(s) with Karen/Karthik signal on architecture topics\n`);
  console.log("=".repeat(80));

  for (const { issue, isPersonReporter, isPersonAssignee, summaryHits, archComments } of findings) {
    const f = issue.fields;
    const tags = [];
    if (isPersonReporter) tags.push(`reporter=${f.reporter.displayName}`);
    if (isPersonAssignee) tags.push(`assignee=${f.assignee.displayName}`);
    if (summaryHits) tags.push("summary-keyword");

    console.log(`\n${issue.key}  [${f.status?.name}]  ${f.issuetype?.name || ""}`);
    console.log(`  ${f.summary}`);
    console.log(`  ${tags.join("  |  ") || "(comment-only signal)"}`);
    console.log(`  updated: ${f.updated?.slice(0, 10)}`);

    for (const c of archComments) {
      const author = c.author?.displayName || "?";
      const when = c.created?.slice(0, 10);
      const text = c._text.slice(0, 600).replace(/\n+/g, "\n    ");
      console.log(`\n  ── [${when}] ${author}:`);
      console.log(`    ${text}${c._text.length > 600 ? "…" : ""}`);
    }
  }

  console.log(`\n${"=".repeat(80)}\nDone. ${findings.length} relevant ticket(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
