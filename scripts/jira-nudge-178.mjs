#!/usr/bin/env node
/**
 * Nudge Karen on SCRUM-178 (persona model decision, due today 2026-05-04).
 * Dennis posted the original ask on Sunday 2026-05-03; this is Monday's
 * polite chase before the call.
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

function postComment(key, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ body: adfDoc(text) });
    const req = https.request({
      hostname: HOST,
      path: `/rest/api/3/issue/${key}/comment`,
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on("error", (e) => resolve({ status: 0, body: e.message }));
    req.write(body);
    req.end();
  });
}

const NUDGE = `Hi Karen — quick nudge before today's call.

This needs an A / B / C call from you so I can move on the dependent work today. Recap of the choice:

  A) Reintroduce the full persona layer (onboarding role picker, role-gated modules)
  B) Project-level roles — role is a property of each project, not the user (recommended)
  C) Status quo + role-flavoured copy only — your Figma journey maps inform marketing/onboarding, not product structure

What's blocked until this lands:
  • The uncommitted persona-default removal in src/app/(auth)/actions.ts
  • All role-aware copy work
  • Spec'ing the implementation tickets for the journey-row divergence (Jason → Directory vs Michael → DA Approved) you designed

If you can drop "A", "B", or "C" in the comments here — even one letter is enough — I can run with it. Happy to hash out the detail on the call, but I'd like to start the spec while we're talking rather than wait until after.

If your read is "I want to discuss before committing", say that and I'll hold all dependent work until after the call without any further nudge.`;

const r = await postComment("SCRUM-178", NUDGE);
if (r.status >= 400) {
  console.log(`✗ FAIL ${r.status}: ${r.body.slice(0, 300)}`);
  process.exit(1);
}
console.log("✓ SCRUM-178 — nudge posted");
