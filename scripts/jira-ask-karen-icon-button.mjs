#!/usr/bin/env node
/**
 * One-shot: ask Karen for more details on the "icon blocking a button" issue
 * she mentioned on the call. Not enough info to repro — need page, screenshot,
 * and which icon/button.
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
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`
).toString("base64");

const KAREN_ACCOUNT_ID = "712020:394dbedd-1ff0-48c1-ab5d-4f6a49136935";

const SUMMARY = "Clarify: which page has an icon blocking a button?";

const DESCRIPTION = `Karen, you mentioned on the call that one of the pages has a button blocked by an icon — but we don't have enough detail to find and fix it.

A code search and a 30-day sweep of your Jira comments didn't surface anything matching "icon blocking button", and there are no floating chat/agent widgets in the dashboard that would universally overlap UI.

To fix it correctly (rather than guess and risk touching the wrong page), can you give us:

1. Which page were you on? (e.g. /comply, /build, /quote, /projects/[id], /settings, etc.)
2. What were you trying to click? (e.g. "Save", "Run Compliance Check", "Add Contributor")
3. What was blocking it? (an icon? a tooltip? a status badge? something fixed-position?)
4. A screenshot if possible — paste it as an attachment on this ticket

If it's easier, a screen recording or just "I was on the /quote results page and the export button was hidden behind the chart legend" is plenty.

Once we know the page + repro, the fix is usually a 5-minute layout adjustment.

Thanks.

— Dennis`;

function adfDoc(text) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed = null;
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = raw;
            }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ status: 0, body: "timeout" });
    });
    if (data) req.write(data);
    req.end();
  });
}

const tomorrow = new Date();
tomorrow.setUTCDate(tomorrow.getUTCDate() + 2); // ~Sydney tomorrow allowing for UTC offset
const dueDate = tomorrow.toISOString().split("T")[0];

const r = await api("POST", "/rest/api/3/issue", {
  fields: {
    project: { key: PROJECT_KEY },
    summary: SUMMARY,
    description: adfDoc(DESCRIPTION),
    issuetype: { name: "Task" },
    labels: ["from-karen-feedback", "ux", "needs-clarification", "v0.4.0"],
    priority: { name: "Medium" },
    assignee: { accountId: KAREN_ACCOUNT_ID },
    duedate: dueDate,
  },
});

if (r.body?.key) {
  console.log(`✓ Created ${r.body.key} (assigned to Karen, due ${dueDate})`);
  console.log(`https://${HOST}/browse/${r.body.key}`);
} else {
  console.error(`✗ Failed: ${JSON.stringify(r.body).slice(0, 500)}`);
  process.exit(1);
}
