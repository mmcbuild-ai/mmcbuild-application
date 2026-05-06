#!/usr/bin/env node
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

function api(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) { console.error(`  ✗ ${res.statusCode}: ${raw.slice(0,200)}`); return resolve(null); }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

const project = await api(`/rest/api/3/project/${PROJECT_KEY}`);
console.log(`\nIssue types (work types) on project ${PROJECT_KEY}:`);
if (project?.issueTypes) {
  for (const t of project.issueTypes) {
    console.log(`  • ${t.name}${t.subtask ? " (subtask)" : ""}${t.description ? " — " + t.description : ""}`);
  }
} else {
  console.log("  (none returned)");
}

console.log(`\nChecking for Bug / Task / Test presence:`);
const names = (project?.issueTypes || []).map((t) => t.name.toLowerCase());
for (const needed of ["Bug", "Task", "Test"]) {
  const found = names.includes(needed.toLowerCase());
  console.log(`  ${found ? "✓" : "✗"} ${needed}${found ? " — present" : " — NOT PRESENT"}`);
}
