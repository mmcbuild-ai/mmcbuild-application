#!/usr/bin/env node
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
  return { type: "doc", version: 1, content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
}

const COMMENT = `Fixed.

Root cause: the test was wrong on two counts (the TODO in-file was misleading on both):
1. The mock chain was not thenable — the subscriptions query ends with .order() (not .single()), but the mock's .order() returned 'this' rather than a Promise, so 'await admin.from(...).order(...)' never resolved correctly.
2. The mock data passed a single sub object where the code expects an array — getSubscriptionStatus iterates with 'for (const sub of subs)' after checking 'subs.length > 0'.

Fix:
- Replaced mockQuery with mockChain that's properly thenable (mirrors how Supabase's PostgrestQueryBuilder behaves) — both 'await chain.order(...)' and 'await chain.single()' now resolve to { data, error }.
- Updated all subscriptions-table mocks to pass arrays.
- Removed the .skip from both describe blocks.
- Removed the stale TODO (it claimed the module had been refactored to use createAdminClient directly; it still uses @/lib/supabase/db, which itself wraps createAdminClient).

Result: 8/8 tests pass. Type check clean for the changed file (only unrelated pre-existing error in tests/e2e/comply.spec.ts re Playwright Locator.isAttached).`;

const c = await api("POST", `/rest/api/3/issue/SCRUM-122/comment`, { body: adfDoc(COMMENT) });
console.log(`Comment: status ${c.status} ${c.status >= 200 && c.status < 300 ? 'ok' : JSON.stringify(c.body).slice(0,300)}`);

const tr = await api("GET", `/rest/api/3/issue/SCRUM-122/transitions`);
const done = (tr.body?.transitions || []).find((t) => /^done$/i.test(t.name));
if (done) {
  const tx = await api("POST", `/rest/api/3/issue/SCRUM-122/transitions`, { transition: { id: done.id } });
  console.log(`Transition -> Done: status ${tx.status} ${tx.status >= 200 && tx.status < 300 ? 'ok' : JSON.stringify(tx.body).slice(0,300)}`);
} else {
  console.error("No 'Done' transition found.");
}
