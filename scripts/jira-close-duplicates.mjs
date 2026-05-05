#!/usr/bin/env node
/**
 * Close known-duplicate / superseded SCRUM tickets:
 *   - Add an "is duplicate of" issue link to the canonical ticket
 *   - Post an explanatory comment
 *   - Transition to Done
 *
 * Edit the PAIRS array below before running. Always run with --dry first.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...r] = line.split("=");
    if (k && r.length && !process.env[k.trim()])
      process.env[k.trim()] = r.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`
).toString("base64");

const APPLY = process.argv.includes("--apply");

// older = ticket to close. canonical = ticket to keep. note = explanation.
const PAIRS = [
  { older: "SCRUM-153", canonical: "SCRUM-186", note: "Both raised from Karen feedback on SCRUM-127 (DWG/SKT/RVT/Word upload formats). SCRUM-186 has the fuller description with ICP context — keeping that as canonical." },
  { older: "SCRUM-154", canonical: "SCRUM-187", note: "Both cover the empty-state guidance ask from Karen on SCRUM-127. SCRUM-187 is canonical." },
  { older: "SCRUM-155", canonical: "SCRUM-188", note: "Both cover Karen's project-question pre-validation request from SCRUM-127. SCRUM-188 is canonical." },
  { older: "SCRUM-158", canonical: "SCRUM-189", note: "Both cover the SIP wall data + unexpected fence line bug Karen reported on SCRUM-138. SCRUM-189 is canonical." },
  { older: "SCRUM-54",  canonical: "SCRUM-156", note: "Original umbrella ask for Word export across Comply and Quote. Superseded by SCRUM-156 (Comply Word export — Done) and SCRUM-157 (Quote Word export — Done). Closing as superseded." },
];

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request(
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
          if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) r.write(data);
    r.end();
  });
}

const adfDoc = (text) => ({
  type: "doc",
  version: 1,
  content: text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  })),
});

async function getDoneTransitionId(key) {
  const r = await req("GET", `/rest/api/3/issue/${key}/transitions`);
  const done = (r.body?.transitions || []).find(
    (t) => (t.to?.name || t.name).toLowerCase() === "done"
  );
  return done?.id;
}

async function main() {
  console.log(APPLY ? "Closing duplicates..." : "Dry run — pass --apply to execute.");
  console.log();

  for (const p of PAIRS) {
    console.log(`${p.older} → duplicate of ${p.canonical}`);
    console.log(`  ${p.note}`);

    if (!APPLY) continue;

    // 1. Link as duplicate
    const linkRes = await req("POST", "/rest/api/3/issueLink", {
      type: { name: "Duplicate" },
      inwardIssue: { key: p.canonical },
      outwardIssue: { key: p.older },
    });
    if (linkRes.status >= 400) {
      console.log(`  ✗ link failed (${linkRes.status}): ${JSON.stringify(linkRes.body).slice(0, 200)}`);
    } else {
      console.log(`  ✓ linked as duplicate of ${p.canonical}`);
    }

    // 2. Post comment
    const cmt = `Closing as duplicate of ${p.canonical}.\n\n${p.note}`;
    await req("POST", `/rest/api/3/issue/${p.older}/comment`, { body: adfDoc(cmt) });

    // 3. Transition to Done
    const tid = await getDoneTransitionId(p.older);
    if (!tid) {
      console.log(`  ✗ no Done transition available`);
      continue;
    }
    const tr = await req("POST", `/rest/api/3/issue/${p.older}/transitions`, { transition: { id: tid } });
    if (tr.status >= 400) {
      console.log(`  ✗ transition failed (${tr.status}): ${JSON.stringify(tr.body).slice(0, 200)}`);
    } else {
      console.log(`  ✓ transitioned to Done`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
