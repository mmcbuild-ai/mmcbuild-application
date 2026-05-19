#!/usr/bin/env node
/**
 * Fetch full detail on SCRUM-195 — Karthik's pre-existing migration design doc.
 * Need description, attachments (download links), and ALL comments.
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
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

function api(method, path) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: HOST, path, method,
        headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } },
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
    req.end();
  });
}

function adfText(node, depth = 0) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.text) return node.text;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "paragraph") return (node.content || []).map((n) => adfText(n, depth)).join("") + "\n";
  if (node.type === "heading") {
    const level = node.attrs?.level || 1;
    return "\n" + "#".repeat(level) + " " + (node.content || []).map((n) => adfText(n, depth)).join("") + "\n";
  }
  if (node.type === "listItem") return "  ".repeat(depth) + "• " + (node.content || []).map((n) => adfText(n, depth + 1)).join("");
  if (node.type === "bulletList" || node.type === "orderedList")
    return (node.content || []).map((n) => adfText(n, depth + 1)).join("\n");
  if (node.type === "codeBlock") return "\n```\n" + (node.content || []).map(adfText).join("") + "\n```\n";
  if (node.type === "rule") return "\n---\n";
  if (node.type === "table") return "\n[TABLE — see Jira UI for layout]\n" + (node.content || []).map(adfText).join("\n") + "\n";
  if (node.type === "tableRow") return "| " + (node.content || []).map(adfText).join(" | ") + " |";
  if (node.type === "tableCell" || node.type === "tableHeader") return (node.content || []).map(adfText).join(" ").trim();
  if (node.type === "mediaGroup" || node.type === "media") return `[ATTACHMENT: ${node.attrs?.id || "?"}]`;
  if (node.type === "inlineCard") return `[LINK: ${node.attrs?.url || "?"}]`;
  return (node.content || []).map((n) => adfText(n, depth)).join("");
}

async function main() {
  const r = await api("GET", `/rest/api/3/issue/SCRUM-195?fields=*all`);
  if (r.status >= 400) {
    console.error("Failed:", r.status, r.body);
    process.exit(1);
  }
  const f = r.body.fields;

  console.log(`SCRUM-195  [${f.status?.name}]  ${f.issuetype?.name}`);
  console.log(`Summary:  ${f.summary}`);
  console.log(`Reporter: ${f.reporter?.displayName}`);
  console.log(`Assignee: ${f.assignee?.displayName || "Unassigned"}`);
  console.log(`Created:  ${f.created?.slice(0, 10)}    Updated: ${f.updated?.slice(0, 10)}`);
  console.log(`Sprint:   ${(f.customfield_10020 || []).map((s) => s.name).join(", ") || "(none)"}`);
  console.log(`\n${"=".repeat(80)}\nDESCRIPTION:\n${"=".repeat(80)}\n`);
  console.log(adfText(f.description) || "(no description)");

  console.log(`\n${"=".repeat(80)}\nATTACHMENTS:\n${"=".repeat(80)}\n`);
  const atts = f.attachment || [];
  if (!atts.length) console.log("(none)");
  for (const a of atts) {
    console.log(`  • ${a.filename}  (${a.mimeType}, ${a.size} bytes)`);
    console.log(`    Author: ${a.author?.displayName}    Created: ${a.created?.slice(0, 19)}`);
    console.log(`    Download: https://${HOST}${(new URL(a.content)).pathname}`);
    console.log(`    Self: ${a.self}`);
  }

  // Comments
  const c = await api("GET", `/rest/api/3/issue/SCRUM-195/comment?orderBy=created&maxResults=100`);
  const comments = c.body?.comments || [];
  console.log(`\n${"=".repeat(80)}\nCOMMENTS (${comments.length}):\n${"=".repeat(80)}\n`);
  for (const cm of comments) {
    console.log(`── [${cm.created?.slice(0, 16).replace("T", " ")}] ${cm.author?.displayName}`);
    console.log("    " + adfText(cm.body).trim().split("\n").join("\n    "));
    console.log();
  }

  // Save raw JSON for reference
  writeFileSync("scripts/.scrum-195-raw.json", JSON.stringify(r.body, null, 2));
  console.log(`Raw JSON saved to scripts/.scrum-195-raw.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
