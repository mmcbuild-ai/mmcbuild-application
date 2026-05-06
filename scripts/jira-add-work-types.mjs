#!/usr/bin/env node
/**
 * SCRUM-117 — Add Bug, Task, Test as work types on the SCRUM project.
 * Steps:
 *   1. Check global issue types; reuse if present, create if missing.
 *   2. Find the issue type scheme bound to the SCRUM project.
 *   3. Add the three types to that scheme (so they appear on SCRUM).
 *
 * Requires "Administer Jira" global permission. Returns 403 otherwise.
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
        const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : null;
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, body: { error: "timeout" } }); });
    if (data) req.write(data);
    req.end();
  });
}

const TYPES_TO_ADD = [
  { name: "Bug", description: "A problem which impairs or prevents the functions of the product.", type: "standard" },
  { name: "Task", description: "A task that needs to be done.", type: "standard" },
  { name: "Test", description: "A test case to be executed or automated.", type: "standard" },
];

async function main() {
  console.log("Step 1 — list global issue types to find existing ones...");
  const globalTypes = await api("GET", "/rest/api/3/issuetype");
  if (globalTypes.status >= 400) {
    console.error(`  ✗ ${globalTypes.status}:`, globalTypes.body);
    process.exit(1);
  }
  const globalByName = new Map();
  for (const t of globalTypes.body) {
    globalByName.set(t.name.toLowerCase(), t);
  }
  console.log(`  Global types: ${globalTypes.body.length}`);

  const typeIds = [];
  for (const t of TYPES_TO_ADD) {
    const existing = globalByName.get(t.name.toLowerCase());
    if (existing) {
      console.log(`  ✓ ${t.name} already exists globally (id=${existing.id})`);
      typeIds.push({ name: t.name, id: existing.id });
      continue;
    }
    console.log(`  + Creating ${t.name}...`);
    const created = await api("POST", "/rest/api/3/issuetype", {
      name: t.name,
      description: t.description,
      type: t.type,
    });
    if (created.status >= 400) {
      console.error(`    ✗ ${created.status}:`, JSON.stringify(created.body).slice(0, 300));
      if (created.status === 403) {
        console.error("\n  ⚠️  403 Forbidden — your account lacks 'Administer Jira' global permission.");
        console.error("     Fall back to the UI steps I listed earlier.");
        process.exit(2);
      }
      continue;
    }
    console.log(`    ✓ created ${t.name} (id=${created.body.id})`);
    typeIds.push({ name: t.name, id: created.body.id });
  }

  if (typeIds.length === 0) {
    console.error("\n  No types to add. Aborting.");
    process.exit(1);
  }

  console.log("\nStep 2 — find the issue type scheme attached to SCRUM...");
  const schemesResp = await api("GET", `/rest/api/3/issuetypescheme/project?projectId=${await getProjectId()}`);
  if (schemesResp.status >= 400) {
    console.error(`  ✗ ${schemesResp.status}:`, schemesResp.body);
    process.exit(1);
  }
  const schemeEntry = schemesResp.body.values?.[0];
  if (!schemeEntry?.issueTypeScheme?.id) {
    console.error("  ✗ Could not locate scheme for SCRUM");
    process.exit(1);
  }
  const schemeId = schemeEntry.issueTypeScheme.id;
  console.log(`  Scheme: ${schemeEntry.issueTypeScheme.name} (id=${schemeId})`);

  console.log("\nStep 3 — add types to scheme...");
  const addResp = await api("PUT", `/rest/api/3/issuetypescheme/${schemeId}/issuetype`, {
    issueTypeIds: typeIds.map((t) => String(t.id)),
  });
  if (addResp.status >= 400) {
    console.error(`  ✗ ${addResp.status}:`, JSON.stringify(addResp.body).slice(0, 400));
    process.exit(1);
  }
  console.log(`  ✓ Added ${typeIds.length} types to scheme`);

  // Verify
  console.log("\nStep 4 — verify on SCRUM project...");
  const project = await api("GET", `/rest/api/3/project/${PROJECT_KEY}`);
  const names = (project.body?.issueTypes || []).map((t) => t.name);
  console.log(`  Work types now on ${PROJECT_KEY}:`);
  for (const n of names) console.log(`    • ${n}`);

  const ok = TYPES_TO_ADD.every((t) => names.includes(t.name));
  console.log(ok ? "\n  ✓ ALL DONE — Bug, Task, Test now available on SCRUM" : "\n  ⚠️  Some types not visible yet (may need a minute to propagate)");
}

async function getProjectId() {
  const p = await api("GET", `/rest/api/3/project/${PROJECT_KEY}`);
  return p.body?.id;
}

main().catch((e) => { console.error(e); process.exit(1); });
