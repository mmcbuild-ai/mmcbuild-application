#!/usr/bin/env node
/**
 * Nudge Karthik on SCRUM-42 — Dennis has asked twice (2026-04-27, 2026-04-30)
 * for the list of base44 files/pages to migrate. Today is 2026-05-06, no reply.
 * Sprint 5 ends 2026-05-07 — this is the last chance to close out the ticket.
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
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

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
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
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
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

const KEY = "SCRUM-42";

const NUDGE_PARAGRAPHS = [
  "Karthik — third ask, polite nudge.",
  "I asked for the list of files/pages to migrate from the base44 repo on 27 Apr and again on 30 Apr. No reply yet (today is 6 May), and Sprint 5 closes 7 May.",
  "What I need to close this out is one of the following:",
  "1. A short list of files or pages from the base44 repo that you want pulled into the MMC Build Next.js repo. Even a screenshot of the base44 file tree with circles around the targets is fine. OR",
  "2. \"Nothing more — the marketing pages already migrated under SCRUM-68 (commit a8a683e on 20 Apr) cover everything. Close SCRUM-42.\" — and I'll close this immediately.",
  "If I don't hear by end of Wednesday 7 May (Brisbane time) I'll close SCRUM-42 with a note that the migration scope ended at SCRUM-68's marketing-pages delivery, and any further base44 items will need a fresh ticket.",
  "No drama either way — just need a yes/no/list so this stops sitting in In Progress. Thanks.",
  "— Dennis",
];

function adfDoc(paragraphs) {
  return {
    type: "doc",
    version: 1,
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

async function main() {
  // Get Karthik's accountId so we can also add him as a watcher (in case
  // notifications were missed because he isn't on the watch list).
  let karthikId = null;
  if (process.env.KARTHIK_EMAIL) {
    const lookup = await api("GET", `/rest/api/3/user/search?query=${encodeURIComponent(process.env.KARTHIK_EMAIL)}`);
    if (Array.isArray(lookup.body) && lookup.body[0]?.accountId) {
      karthikId = lookup.body[0].accountId;
      console.log(`Karthik: ${lookup.body[0].displayName} (${karthikId})`);
    }
  }

  // Post the nudge comment.
  console.log(`\nPosting nudge on ${KEY}...`);
  const c = await api("POST", `/rest/api/3/issue/${KEY}/comment`, {
    body: adfDoc(NUDGE_PARAGRAPHS),
  });
  if (c.status >= 400) {
    console.error(`  ✗ comment FAIL ${c.status}: ${JSON.stringify(c.body).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`  ✓ comment posted`);

  // Make sure Karthik is on the watcher list so he gets the email.
  if (karthikId) {
    const w = await api("POST", `/rest/api/3/issue/${KEY}/watchers`, karthikId);
    if (w.status >= 400 && w.status !== 204) {
      console.warn(`  ! watcher add returned ${w.status} (often safe to ignore if already watching)`);
    } else {
      console.log(`  ✓ Karthik added/confirmed as watcher`);
    }
  } else {
    console.warn("  ! KARTHIK_EMAIL not in .env.local — couldn't ensure he's a watcher");
  }

  console.log(`\nDone. https://${HOST}/browse/${KEY}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
