#!/usr/bin/env node
/** Fetch the actual text of Karen's comments on a known list of SCRUM tickets. */
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

const KEYS = [
  "SCRUM-183", "SCRUM-178",
  "SCRUM-138", "SCRUM-137", "SCRUM-136", "SCRUM-135", "SCRUM-134", "SCRUM-133",
  "SCRUM-132", "SCRUM-131", "SCRUM-130", "SCRUM-129", "SCRUM-128", "SCRUM-127",
  "SCRUM-125", "SCRUM-124",
];

function get(path) {
  return new Promise((resolve) => {
    const req = https.request({ hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } }, (res) => {
      let raw = ""; res.on("data", (c) => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
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

for (const key of KEYS) {
  const r = await get(`/rest/api/3/issue/${key}?fields=summary,status,description,reporter,comment`);
  if (!r || r.errorMessages) { console.log(`${key}: ${r?.errorMessages?.[0] || "fetch failed"}`); continue; }
  const cmts = r.fields.comment?.comments || [];
  const karenCmts = cmts.filter(c => /karen/i.test(c.author?.displayName || ""));

  console.log(`\n══════════ ${key} [${r.fields.status.name}] ${r.fields.summary} ══════════`);
  if (key === "SCRUM-183") {
    // For SCRUM-183 print the description (Karen filed it)
    const desc = adfText(r.fields.description).trim();
    if (desc) console.log("DESCRIPTION:\n  " + desc.split("\n").join("\n  "));
  }
  if (!karenCmts.length) {
    console.log("(no Karen comments)");
    continue;
  }
  for (const c of karenCmts) {
    console.log(`@ ${c.created.slice(0, 16).replace("T", " ")} by ${c.author.displayName}`);
    const t = adfText(c.body).trim();
    console.log("  " + t.split("\n").join("\n  "));
  }
}
