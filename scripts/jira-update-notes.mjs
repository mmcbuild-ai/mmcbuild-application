#!/usr/bin/env node
/**
 * Quick Jira comment updates for SCRUM-68 and SCRUM-74
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim();
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function api(method, path, body = null) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) { console.error(`  ✗ ${res.statusCode}: ${raw.slice(0, 200)}`); return done(null); }
        try { done(raw ? JSON.parse(raw) : {}); } catch { done(null); }
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${e.message}`); done(null); });
    req.setTimeout(30000, () => { req.destroy(); done(null); });
    if (data) req.write(data);
    req.end();
  });
}

async function addComment(issueKey, text) {
  return api("POST", `/rest/api/3/issue/${issueKey}/comment`, {
    body: {
      type: "doc", version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  });
}

async function main() {
  console.log("\n📝 Adding review notes...\n");

  // SCRUM-68
  console.log("  SCRUM-68 — GitHub repo consolidation");
  const r1 = await addComment("SCRUM-68",
    "2026-04-10 — Dennis: Need to review whether consolidation is both possible and beneficial, or whether it risks damaging both repos. Keeping in backlog until assessed."
  );
  console.log(`  ${r1 ? "✓ Comment added" : "✗ Failed"}`);

  // Also add a label to flag it for review
  await api("PUT", "/rest/api/3/issue/SCRUM-68", {
    fields: { labels: ["needs-review"] },
  });
  console.log("  ✓ Added 'needs-review' label");

  console.log("\n  Done.\n");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
