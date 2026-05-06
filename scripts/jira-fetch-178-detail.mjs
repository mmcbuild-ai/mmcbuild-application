#!/usr/bin/env node
/** Fetch full SCRUM-178 description + all comments to compose an informed nudge. */
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

const get = (path) => new Promise((resolve) => {
  const req = https.request({ hostname: HOST, path, method: "GET",
    headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } }, (res) => {
    let raw = ""; res.on("data", c => raw += c);
    res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
  });
  req.on("error", () => resolve(null));
  req.end();
});

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

const r = await get(`/rest/api/3/issue/SCRUM-178?fields=summary,status,description,reporter,assignee,duedate,comment,labels,priority,updated`);
console.log(`SCRUM-178 [${r.fields.status.name}] ${r.fields.summary}\n`);
console.log(`reporter:  ${r.fields.reporter?.displayName}`);
console.log(`assignee:  ${r.fields.assignee?.displayName || "—"}`);
console.log(`priority:  ${r.fields.priority?.name}`);
console.log(`due date:  ${r.fields.duedate || "—"}`);
console.log(`labels:    ${(r.fields.labels || []).join(", ")}`);
console.log(`updated:   ${r.fields.updated}`);

console.log("\n── DESCRIPTION ──");
console.log(adfText(r.fields.description).trim());

console.log("\n── COMMENTS ──");
for (const c of (r.fields.comment?.comments || [])) {
  console.log(`\n@ ${c.created.slice(0, 16).replace("T", " ")} by ${c.author?.displayName}`);
  console.log("  " + adfText(c.body).trim().split("\n").join("\n  "));
}
