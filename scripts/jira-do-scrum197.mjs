#!/usr/bin/env node
/**
 * SCRUM-197: post scope-confirmation comment on SCRUM-42, then close SCRUM-197.
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
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: {
        Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
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

function adfDoc(text) {
  return {
    type: "doc", version: 1,
    content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

const SCOPE_COMMENT = `Karthik — confirming scope of this migration following our meeting on 2026-05-06.

Scope: full migration of the existing Base44-hosted marketing site (everything currently live on it) to Vercel + Supabase. No file-by-file selection — we lift the whole thing across, then strip and re-point any remaining Base44 references at the new Vercel build.

Approach (matches the architecture you laid out):
1. I spin up a fresh Vercel + Supabase clone under my personal account first (SCRUM-199) and migrate the Base44 site into it. That becomes the source-of-truth merge env (Base44 site + existing app code in one repo).
2. Once that's clean and working, you provision the new MMC Build Vercel + Supabase + GitHub repo (SCRUM-201) and we clone the source-of-truth across to those.
3. HubSpot integration will break on cutover and gets re-linked separately (SCRUM-203).
4. DNS cutover for app.mmcbuild.com.au is tracked under SCRUM-84; you'll handle Ventra IP.

Sprint allocation: prep work in Sprint 5 (this batch — SCRUM-195 through 200), the actual migration body in Sprint 6 (SCRUM-201 through 206), production cutover in Sprint 7 once your narrative (SCRUM-196) is broken into tickets (SCRUM-202).

Closing SCRUM-197 — this comment is the deliverable.`;

async function main() {
  console.log(`Posting scope confirmation on SCRUM-42...`);
  const c = await api("POST", `/rest/api/3/issue/SCRUM-42/comment`, { body: adfDoc(SCOPE_COMMENT) });
  if (c.status >= 200 && c.status < 300) console.log(`  ok comment posted (id ${c.body?.id})`);
  else { console.error(`  ERROR: ${JSON.stringify(c.body).slice(0, 400)}`); process.exit(1); }

  console.log(`\nFetching transitions for SCRUM-197...`);
  const tr = await api("GET", `/rest/api/3/issue/SCRUM-197/transitions`);
  const transitions = tr.body?.transitions || [];
  for (const t of transitions) console.log(`  [${t.id}] ${t.name} -> ${t.to?.name}`);

  const done = transitions.find((t) => /^done$/i.test(t.name) || /^done$/i.test(t.to?.name || ""));
  if (!done) {
    console.error(`No 'Done' transition found. SCRUM-197 left in current state.`);
    process.exit(1);
  }

  console.log(`\nTransitioning SCRUM-197 -> ${done.to?.name} (transition id ${done.id})...`);
  const tx = await api("POST", `/rest/api/3/issue/SCRUM-197/transitions`, { transition: { id: done.id } });
  if (tx.status >= 200 && tx.status < 300) console.log(`  ok SCRUM-197 closed`);
  else console.error(`  ERROR: ${JSON.stringify(tx.body).slice(0, 400)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
