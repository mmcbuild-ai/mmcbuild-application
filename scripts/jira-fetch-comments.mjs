#!/usr/bin/env node
/**
 * Fetch comments on a list of Jira issues. Usage: node jira-fetch-comments.mjs SCRUM-80 SCRUM-83 SCRUM-123 ...
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

// Recursively pull text out of Atlassian Document Format
function adfText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.text) return node.text;
  if (Array.isArray(node.content)) return node.content.map(adfText).join("");
  if (node.type === "hardBreak") return "\n";
  if (node.type === "paragraph") return (node.content || []).map(adfText).join("") + "\n";
  if (node.type === "bulletList" || node.type === "orderedList") return (node.content || []).map(adfText).join("\n");
  if (node.type === "listItem") return "  • " + (node.content || []).map(adfText).join("");
  return (node.content || []).map(adfText).join("");
}

const main = async () => {
  const keys = process.argv.slice(2);
  if (!keys.length) { console.error("usage: jira-fetch-comments.mjs SCRUM-80 SCRUM-83 ..."); process.exit(1); }

  for (const key of keys) {
    const issue = await api(`/rest/api/3/issue/${key}?fields=summary,status,assignee`);
    if (!issue || issue.error) { console.log(`\n${key}: error ${issue?.error}`); continue; }
    console.log(`\n${"═".repeat(78)}`);
    console.log(`${key}  [${issue.fields.status?.name}]  ${issue.fields.assignee?.displayName || "unassigned"}`);
    console.log(`${issue.fields.summary}`);
    console.log("═".repeat(78));

    const comments = await api(`/rest/api/3/issue/${key}/comment?orderBy=created`);
    if (!comments?.comments?.length) { console.log("(no comments)"); continue; }

    for (const c of comments.comments) {
      const author = c.author?.displayName || "unknown";
      const when = c.created?.slice(0, 16).replace("T", " ");
      console.log(`\n── ${author} @ ${when} ──`);
      const text = adfText(c.body).trim();
      console.log(text || "(empty)");
    }
  }
};
main().catch(e => { console.error(e); process.exit(1); });
