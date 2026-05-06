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
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const KEY = "SCRUM-117";

function adfDoc(text) {
  const paragraphs = text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  }));
  return { type: "doc", version: 1, content: paragraphs };
}

function api(method, path, body) {
  return new Promise((resolve) => {
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
        let parsed = null;
        if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Post completion comment
  const commentText = `Closed by Dennis, 20 Apr 2026.

Bug, Task and Test work types are now live on the SCRUM project. Added via the team-managed project's Issue types settings (API route blocked — Jira doesn't allow API-associated types on team-managed projects, so UI was required).

Verified via scripts/jira-list-work-types.mjs — all three present alongside Epic, Subtask, Story, and Feature.

Karthik — you can now raise Bugs, Tasks and Tests directly on SCRUM.`;

  const commentResp = await api("POST", `/rest/api/3/issue/${KEY}/comment`, { body: adfDoc(commentText) });
  if (commentResp.status >= 400) {
    console.error("✗ Comment failed:", commentResp.status, commentResp.body);
  } else {
    console.log("✓ Comment posted");
  }

  // 2. Fetch available transitions
  const trans = await api("GET", `/rest/api/3/issue/${KEY}/transitions`);
  if (trans.status >= 400) {
    console.error("✗ Could not fetch transitions");
    return;
  }
  const targets = trans.body.transitions || [];
  console.log("Available transitions:");
  for (const t of targets) console.log(`  ${t.id} → ${t.name} (${t.to?.name})`);

  // Prefer Done; fall back to anything that lands in Done status category
  let chosen = targets.find((t) => /^done$/i.test(t.name))
            || targets.find((t) => t.to?.statusCategory?.key === "done")
            || targets.find((t) => /close|resolve|complete/i.test(t.name));

  if (!chosen) {
    console.error("✗ No Done-equivalent transition available");
    return;
  }
  console.log(`\nTransitioning via: ${chosen.name} (${chosen.id}) → ${chosen.to?.name}`);

  const transResp = await api("POST", `/rest/api/3/issue/${KEY}/transitions`, {
    transition: { id: chosen.id },
  });
  if (transResp.status >= 400) {
    console.error("✗ Transition failed:", transResp.status, transResp.body);
    return;
  }
  console.log(`✓ ${KEY} transitioned to ${chosen.to?.name}`);
}

main();
