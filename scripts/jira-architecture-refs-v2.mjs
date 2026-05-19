#!/usr/bin/env node
/**
 * Deeper sweep for Karen/Karthik signal on environment/repo architecture.
 * Fixes from v1:
 *   - Correct JQL for reporter/assignee filter (uses accountId, not display name)
 *   - Paginates past 50 results via nextPageToken
 *   - Walks issue links from the known migration cluster (SCRUM-195, 196, 200-206)
 *   - Surfaces remote-link URLs (Confluence, Google Docs, etc.) found on those tickets
 *
 * Read-only.
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
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
      { hostname: HOST, path, method,
        headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) } },
      (res) => {
        let raw = ""; res.on("data", (c) => (raw += c));
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

function adfText(n) {
  if (!n) return "";
  if (typeof n === "string") return n;
  if (n.text) return n.text;
  if (n.type === "paragraph") return (n.content || []).map(adfText).join("") + "\n";
  if (n.type === "listItem") return "  • " + (n.content || []).map(adfText).join("");
  if (n.type === "heading") return "\n## " + (n.content || []).map(adfText).join("") + "\n";
  if (n.type === "inlineCard") return ` [LINK: ${n.attrs?.url}] `;
  return (n.content || []).map(adfText).join("");
}

const KEYWORDS = [
  "branch", "branches", "branching", "main branch", "release branch", "feature branch",
  "repo", "repository", "github", "fork", "clone",
  "environment", "staging", "uat", "sandbox", "preview",
  "vercel", "supabase", "base44", "ventraip", "VentraIP",
  "migration", "migrate", "deploy", "deployment", "CI", "pipeline",
  "DNS", "subdomain", "webhook", "MFA", "mfa",
  "infrastructure", "ownership", "secrets", "rotate", "rotation",
];

const PEOPLE = /karen|karthik/i;
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.map((k) => k.replace(/\s+/g, "\\s+")).join("|")})\\b`, "i");

async function searchAll(jql) {
  const results = [];
  let nextToken = undefined;
  for (let page = 0; page < 10; page++) {
    const r = await api("POST", `/rest/api/3/search/jql`, {
      jql,
      fields: ["summary", "status", "assignee", "reporter", "created", "updated", "issuetype", "issuelinks"],
      maxResults: 100,
      ...(nextToken ? { nextPageToken: nextToken } : {}),
    });
    if (r.status >= 400) {
      console.error(`  ! query failed (${r.status}): ${jql.slice(0, 100)}`);
      console.error(`    body: ${JSON.stringify(r.body).slice(0, 300)}`);
      break;
    }
    const issues = r.body?.issues || [];
    results.push(...issues);
    if (!r.body?.nextPageToken || issues.length === 0) break;
    nextToken = r.body.nextPageToken;
  }
  return results;
}

async function getComments(key) {
  const r = await api("GET", `/rest/api/3/issue/${key}/comment?orderBy=created&maxResults=100`);
  if (r.status >= 400) return [];
  return r.body?.comments || [];
}

async function getRemoteLinks(key) {
  const r = await api("GET", `/rest/api/3/issue/${key}/remotelink`);
  if (r.status >= 400) return [];
  return r.body || [];
}

async function getIssue(key) {
  const r = await api("GET", `/rest/api/3/issue/${key}?fields=summary,status,assignee,reporter,issuelinks,description`);
  if (r.status >= 400) return null;
  return r.body;
}

async function findUserAccountIds() {
  // Find Karen's and Karthik's accountIds so we can use a valid reporter/assignee query
  const r = await api("GET", `/rest/api/3/user/assignable/search?project=${PROJECT_KEY}&maxResults=50`);
  const users = r.body || [];
  const out = {};
  for (const u of users) {
    const name = (u.displayName || "").toLowerCase();
    if (name.includes("karen")) out.karen = { id: u.accountId, name: u.displayName };
    if (name.includes("karthik")) out.karthik = { id: u.accountId, name: u.displayName };
  }
  return out;
}

async function main() {
  console.log("=== Deeper sweep: Karen/Karthik architecture references ===\n");

  // 1. Get accountIds for valid reporter/assignee queries
  const users = await findUserAccountIds();
  console.log(`User IDs:`);
  for (const [k, v] of Object.entries(users)) console.log(`  ${k}: ${v.id}  (${v.name})`);

  // 2. Build JQL queries with valid syntax
  const textClause = KEYWORDS.map((k) => `text ~ "${k}"`).join(" OR ");
  const personIds = Object.values(users).map((u) => `"${u.id}"`).join(", ");

  const queries = [
    // a) Any ticket with architecture keyword (paginated)
    `project = ${PROJECT_KEY} AND (${textClause}) ORDER BY updated DESC`,
    // b) Any ticket reported by Karen or Karthik (we'll filter by keyword in code)
    personIds ? `project = ${PROJECT_KEY} AND reporter in (${personIds}) ORDER BY updated DESC` : null,
    // c) Any ticket assigned to Karen or Karthik
    personIds ? `project = ${PROJECT_KEY} AND assignee in (${personIds}) ORDER BY updated DESC` : null,
  ].filter(Boolean);

  const seen = new Map();
  for (const jql of queries) {
    const issues = await searchAll(jql);
    for (const i of issues) if (!seen.has(i.key)) seen.set(i.key, i);
    console.log(`  query "${jql.slice(0, 50)}…" → ${issues.length} issues`);
  }
  console.log(`\nTotal unique candidate tickets: ${seen.size}\n`);

  // 3. Walk the known migration cluster's issue links (parent/child/blocks/related)
  const KNOWN_CLUSTER = ["SCRUM-195", "SCRUM-196", "SCRUM-200", "SCRUM-201", "SCRUM-202",
    "SCRUM-203", "SCRUM-204", "SCRUM-205", "SCRUM-206", "SCRUM-42"];
  const linkedKeys = new Set();
  for (const k of KNOWN_CLUSTER) {
    const issue = await getIssue(k);
    if (!issue) continue;
    for (const link of issue.fields?.issuelinks || []) {
      const linked = link.outwardIssue?.key || link.inwardIssue?.key;
      if (linked) linkedKeys.add(linked);
    }
  }
  console.log(`Linked tickets via cluster: ${[...linkedKeys].join(", ") || "(none)"}\n`);
  for (const k of linkedKeys) {
    if (!seen.has(k)) {
      const issue = await getIssue(k);
      if (issue) seen.set(k, issue);
    }
  }

  // 4. Scan each candidate for Karen/Karthik signal
  const findings = [];
  let n = 0;
  for (const issue of seen.values()) {
    n++;
    process.stderr.write(`\r  scanning ${n}/${seen.size} ${issue.key}        `);

    const f = issue.fields;
    const reporter = f.reporter?.displayName || "";
    const assignee = f.assignee?.displayName || "";
    const summary = f.summary || "";
    const description = adfText(f.description || null);

    const isPersonReporter = PEOPLE.test(reporter);
    const isPersonAssignee = PEOPLE.test(assignee);
    const summaryHits = KEYWORD_RE.test(summary);
    const descHits = KEYWORD_RE.test(description);

    const comments = await getComments(issue.key);
    const personComments = comments.filter((c) => PEOPLE.test(c.author?.displayName || ""));
    const archComments = personComments
      .map((c) => ({ ...c, _text: adfText(c.body).trim() }))
      .filter((c) => KEYWORD_RE.test(c._text) || summaryHits || descHits);

    // Remote links (Confluence, Google Docs, etc.)
    const remoteLinks = (isPersonReporter || isPersonAssignee || summaryHits) ? await getRemoteLinks(issue.key) : [];

    if (archComments.length === 0 &&
        !((isPersonReporter || isPersonAssignee) && (summaryHits || descHits)) &&
        remoteLinks.length === 0) {
      continue;
    }

    findings.push({ issue, isPersonReporter, isPersonAssignee, summaryHits, descHits, archComments, remoteLinks });
  }
  process.stderr.write("\r" + " ".repeat(60) + "\r");

  console.log(`\nMatches: ${findings.length} ticket(s) with relevant signal\n`);
  console.log("=".repeat(80));

  // Sort: most recent first
  findings.sort((a, b) => (b.issue.fields.updated || "").localeCompare(a.issue.fields.updated || ""));

  for (const { issue, isPersonReporter, isPersonAssignee, summaryHits, descHits, archComments, remoteLinks } of findings) {
    const f = issue.fields;
    const tags = [];
    if (isPersonReporter) tags.push(`reporter=${f.reporter.displayName}`);
    if (isPersonAssignee) tags.push(`assignee=${f.assignee.displayName}`);
    if (summaryHits) tags.push("summary-keyword");
    if (descHits) tags.push("description-keyword");

    console.log(`\n${issue.key}  [${f.status?.name || "?"}]  ${f.issuetype?.name || ""}`);
    console.log(`  ${f.summary}`);
    console.log(`  ${tags.join("  |  ") || "(comment-only signal)"}`);
    console.log(`  updated: ${(f.updated || "").slice(0, 10)}`);

    for (const c of archComments) {
      const author = c.author?.displayName || "?";
      const when = c.created?.slice(0, 10);
      const text = c._text.slice(0, 700).replace(/\n+/g, "\n    ");
      console.log(`\n  ── [${when}] ${author}:`);
      console.log(`    ${text}${c._text.length > 700 ? "…" : ""}`);
    }

    if (remoteLinks.length) {
      console.log(`\n  ◆ Remote links (${remoteLinks.length}):`);
      for (const rl of remoteLinks) {
        console.log(`    • ${rl.object?.title || "?"}  →  ${rl.object?.url || "?"}`);
      }
    }
  }

  console.log(`\n${"=".repeat(80)}\nDone. ${findings.length} relevant ticket(s).\n`);

  // Save findings for reference
  writeFileSync(
    "scripts/.architecture-refs-findings.json",
    JSON.stringify(findings.map((f) => ({
      key: f.issue.key,
      summary: f.issue.fields.summary,
      status: f.issue.fields.status?.name,
      reporter: f.issue.fields.reporter?.displayName,
      assignee: f.issue.fields.assignee?.displayName,
      updated: f.issue.fields.updated,
      personComments: f.archComments.map((c) => ({ author: c.author?.displayName, when: c.created?.slice(0, 10), text: c._text })),
      remoteLinks: f.remoteLinks.map((rl) => ({ title: rl.object?.title, url: rl.object?.url })),
    })), null, 2),
  );
  console.log(`Findings saved to scripts/.architecture-refs-findings.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
