#!/usr/bin/env node
/**
 * Scan all SCRUM tickets and their comments for Figma references —
 * URLs, file names, attachment hints, or design-tool keywords.
 *
 * Output: a report of where Figma has been mentioned, and whether any
 * concrete file URL has been shared.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function api(method, path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: HOST, path, method,
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) { console.error(`  ✗ ${method} ${path}: ${res.statusCode}`); return resolve(null); }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${e.message}`); resolve(null); });
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) return node.content.map(adfToText).join(" ");
  return "";
}

const FIGMA_URL_RE = /figma\.com\/(?:file|design|proto|community)\/[A-Za-z0-9_-]+/gi;
const FIGMA_KEYWORDS = /\b(figma|figma\.make|figjam|design\s*file|prototype|mockup|wireframe)\b/gi;
const ATTACHMENT_RE = /\.(?:fig|pdf|png|jpg|jpeg|sketch|xd)\b/gi;

async function fetchAll() {
  const boards = await api("GET", `/rest/agile/1.0/board?projectKeyOrId=${PROJECT_KEY}`);
  const boardId = boards?.values?.[0]?.id;
  if (!boardId) { console.error("No board"); return []; }

  const issues = [];
  let startAt = 0;
  const maxResults = 50;
  while (true) {
    const data = await api("GET",
      `/rest/agile/1.0/board/${boardId}/issue?startAt=${startAt}&maxResults=${maxResults}` +
      `&fields=summary,status,assignee,reporter,description,attachment`);
    if (!data?.issues?.length) break;
    issues.push(...data.issues);
    if (issues.length >= data.total) break;
    startAt += maxResults;
  }
  return issues;
}

function scanText(text) {
  const urls = [...(text.matchAll(FIGMA_URL_RE) || [])].map((m) => m[0]);
  const keywords = [...(text.matchAll(FIGMA_KEYWORDS) || [])].map((m) => m[0]);
  const attachments = [...(text.matchAll(ATTACHMENT_RE) || [])].map((m) => m[0]);
  return { urls, keywords, attachments };
}

async function main() {
  console.log("Fetching all SCRUM issues...");
  const issues = await fetchAll();
  console.log(`Got ${issues.length} issues. Scanning for Figma references...\n`);

  const hits = [];

  for (const issue of issues) {
    const key = issue.key;
    const summary = issue.fields.summary || "";
    const description = adfToText(issue.fields.description) || "";
    const reporter = issue.fields.reporter?.displayName || "?";
    const assignee = issue.fields.assignee?.displayName || "unassigned";

    // Check description + attachments
    const descScan = scanText(summary + "\n" + description);
    const attachments = issue.fields.attachment || [];

    // Fetch comments for this issue
    const commentResp = await api("GET", `/rest/api/3/issue/${key}/comment`);
    const comments = commentResp?.comments || [];
    let commentHits = [];
    for (const c of comments) {
      const commentText = adfToText(c.body);
      const scan = scanText(commentText);
      if (scan.urls.length || scan.keywords.length) {
        commentHits.push({
          author: c.author?.displayName || "?",
          created: c.created,
          text: commentText.slice(0, 300),
          urls: scan.urls,
          keywords: scan.keywords,
        });
      }
    }

    const hasFigmaContent =
      descScan.urls.length > 0 ||
      descScan.keywords.length > 0 ||
      attachments.length > 0 ||
      commentHits.length > 0;

    if (hasFigmaContent) {
      hits.push({
        key, summary, reporter, assignee,
        descUrls: descScan.urls,
        descKeywords: descScan.keywords,
        attachments: attachments.map((a) => ({ filename: a.filename, author: a.author?.displayName, created: a.created })),
        commentHits,
      });
    }
  }

  // Report
  console.log("═".repeat(70));
  console.log(`  FIGMA REFERENCE SCAN — ${hits.length} tickets mention Figma/design files`);
  console.log("═".repeat(70));

  let totalFigmaUrls = 0;
  let totalAttachments = 0;

  for (const h of hits) {
    console.log(`\n${h.key} — ${h.summary}`);
    console.log(`  Reporter: ${h.reporter} | Assignee: ${h.assignee}`);

    if (h.descUrls.length > 0) {
      console.log(`  ★ FIGMA URL IN DESCRIPTION:`);
      for (const u of h.descUrls) {
        console.log(`    → https://${u.startsWith("figma.com") ? u : "www." + u}`);
        totalFigmaUrls++;
      }
    }

    if (h.descKeywords.length > 0 && h.descUrls.length === 0) {
      console.log(`  keywords (desc): ${[...new Set(h.descKeywords.map(k => k.toLowerCase()))].join(", ")}`);
    }

    if (h.attachments.length > 0) {
      console.log(`  📎 Attachments:`);
      for (const a of h.attachments) {
        console.log(`    • ${a.filename} (${a.author}, ${a.created})`);
        totalAttachments++;
      }
    }

    if (h.commentHits.length > 0) {
      console.log(`  💬 Comments mentioning Figma:`);
      for (const c of h.commentHits) {
        console.log(`    ${c.author} @ ${c.created}:`);
        if (c.urls.length > 0) {
          for (const u of c.urls) {
            console.log(`      ★ URL: https://${u.startsWith("figma.com") ? u : "www." + u}`);
            totalFigmaUrls++;
          }
        }
        console.log(`      "${c.text.replace(/\s+/g, " ").slice(0, 200)}..."`);
      }
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log(`  SUMMARY`);
  console.log("═".repeat(70));
  console.log(`  Tickets with any Figma/design reference: ${hits.length}`);
  console.log(`  Concrete Figma URLs found: ${totalFigmaUrls}`);
  console.log(`  Attachments (any file type): ${totalAttachments}`);
  if (totalFigmaUrls === 0 && totalAttachments === 0) {
    console.log(`\n  ⚠️  No Figma URLs or attachments shared via Jira.`);
    console.log(`     Karen/Karthik likely shared via email, Slack, or direct Figma invite.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
