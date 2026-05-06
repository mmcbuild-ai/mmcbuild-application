#!/usr/bin/env node
/**
 * Quick test — which Jira search endpoint works?
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

function tryEndpoint(label, path) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    console.log(`\n  Testing: ${label}`);
    console.log(`  Path: ${path.substring(0, 120)}`);

    const req = https.request({
      hostname: HOST,
      path,
      method: "GET",
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        console.log(`  Status: ${res.statusCode}`);
        if (res.statusCode < 400) {
          try {
            const j = JSON.parse(raw);
            console.log(`  ✓ Got ${j.issues?.length ?? "?"} issues, total: ${j.total ?? "?"}`);
          } catch {
            console.log(`  Response: ${raw.substring(0, 200)}`);
          }
        } else {
          console.log(`  ✗ ${raw.substring(0, 200)}`);
        }
        done(res.statusCode);
      });
    });
    req.on("error", (e) => { console.log(`  ✗ Error: ${e.message}`); done(null); });
    req.setTimeout(20000, () => { req.destroy(); console.log("  ✗ TIMEOUT (20s)"); done(null); });
    req.end();
  });
}

async function main() {
  console.log(`Host: ${HOST}`);
  console.log(`Auth: ${EMAIL} / token ${TOKEN ? "present" : "MISSING"}`);

  // Test 1: Simple project fetch (should work — v4 script uses this)
  await tryEndpoint("GET /project/SCRUM", "/rest/api/3/project/SCRUM");

  // Test 2: search/jql with encodeURIComponent
  const jql1 = encodeURIComponent("project = SCRUM ORDER BY key ASC");
  await tryEndpoint("GET /search/jql (encoded)", `/rest/api/3/search/jql?jql=${jql1}&maxResults=5`);

  // Test 3: search/jql with raw spaces replaced by +
  await tryEndpoint("GET /search/jql (plus)", `/rest/api/3/search/jql?jql=project+%3D+SCRUM+ORDER+BY+key+ASC&maxResults=5`);

  // Test 4: search/jql minimal
  await tryEndpoint("GET /search/jql (minimal)", `/rest/api/3/search/jql?jql=project%3DSCRUM&maxResults=5`);

  // Test 5: old search endpoint GET
  await tryEndpoint("GET /search (old)", `/rest/api/3/search?jql=project%3DSCRUM&maxResults=5`);

  // Test 6: agile board issues
  await tryEndpoint("GET /agile board issues", `/rest/agile/1.0/board/1/issue?maxResults=5`);

  console.log("\n  Done.");
}

main();
