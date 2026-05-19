#!/usr/bin/env node
/**
 * Attach the new branch+environment architecture doc to SCRUM-195 (both .md and .docx)
 * and post a comment summarising it for Karthik (with @mentions for Karthik + Karen).
 *
 * SCRUM-195 is the parent — Karthik's "POC - MVP Technical Migration" design doc.
 * The new doc is the operational companion; this comment makes that relationship explicit
 * and surfaces the 6 decisions in §10 that need Karthik's call before Sprint 7 ticket-break.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";
import { randomBytes } from "crypto";

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
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

const TICKET = "SCRUM-195";
const MD_PATH = "C:\\Users\\denni\\PycharmProjects\\MMCBuild\\docs\\branch-and-environment-architecture-v1.0.md";
const DOCX_PATH = "C:\\Users\\denni\\PycharmProjects\\MMCBuild\\docs\\MMC_Build_Branch_and_Environment_Architecture_v1.0.docx";

// AccountIds discovered via the v2 sweep (jira-architecture-refs-v2.mjs)
const KARTHIK_ID = "607e5479074a0b006a5b2873";
const KAREN_ID = "712020:394dbedd-1ff0-48c1-ab5d-4f6a49136935";

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      { hostname: HOST, path, method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        } },
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
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

function uploadAttachment(filePath, filename, contentType) {
  return new Promise((resolve) => {
    if (!existsSync(filePath)) {
      console.error(`  ✗ file not found: ${filePath}`);
      return resolve(false);
    }
    const fileBuf = readFileSync(filePath);
    const boundary = "----" + randomBytes(16).toString("hex");
    const header = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
      "utf8",
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([header, fileBuf, footer]);

    const req = https.request(
      { hostname: HOST, path: `/rest/api/3/issue/${TICKET}/attachments`, method: "POST",
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          "X-Atlassian-Token": "no-check",
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            console.error(`  ✗ ${filename}: ${res.statusCode} ${raw.slice(0, 200)}`);
            return resolve(false);
          }
          console.log(`  ✓ attached ${filename} (${(fileBuf.length / 1024).toFixed(1)} KB)`);
          resolve(true);
        });
      },
    );
    req.on("error", (e) => { console.error(`  ✗ ${filename}: ${e.message}`); resolve(false); });
    req.setTimeout(90000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ADF helpers ----------------------------------------------------------------

const t = (text) => ({ type: "text", text });
const mention = (accountId, displayText) => ({
  type: "mention", attrs: { id: accountId, text: displayText },
});
const para = (...content) => ({ type: "paragraph", content });
const heading = (level, text) => ({
  type: "heading", attrs: { level }, content: [t(text)],
});
const bullet = (...items) => ({
  type: "bulletList",
  content: items.map((c) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: Array.isArray(c) ? c : [t(c)] }],
  })),
});
const numlist = (...items) => ({
  type: "orderedList",
  content: items.map((c) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: Array.isArray(c) ? c : [t(c)] }],
  })),
});
const rule = () => ({ type: "rule" });

// Comment body ---------------------------------------------------------------

const commentBody = {
  type: "doc",
  version: 1,
  content: [
    para(
      mention(KARTHIK_ID, "@Karthik Rao"),
      t(" — companion operational doc to your design (this ticket). Two attachments here: a Markdown version (lives in the repo at "),
      t("docs/branch-and-environment-architecture-v1.0.md"),
      t(") and a Word version of the same content for easy review."),
    ),

    heading(3, "What it does and doesn't do"),
    para(
      t("This doc sits BELOW your SCRUM-195 design in source-of-truth order. Anywhere it could disagree, your design wins. Specifically:"),
    ),
    bullet(
      "Respects the §7 boundary — no DEV/STAGING/PROD split, no Terraform, no microservices.",
      "Uses the two-environment model (CAI = DEV/TEST, MMC Build = PRODUCTION) verbatim from §3.",
      "Uses the service-based subdomains (www / app / api) verbatim from §5.",
      "Adds operational detail BENEATH that boundary: how Dennis pushes day-to-day, the cross-repo mirror sync mechanic, hotfix flow, Jira lifecycle states.",
    ),

    heading(3, "Why a companion doc at all"),
    para(
      t("Your design answers \"what does the end-state look like?\". The Sprint 7 ticket-break (SCRUM-196) needs the operational layer too — which repo Dennis commits to during cutover, when the mirror sync runs, what state the Jira ticket sits in mid-flight. Without that, ticket-break ends up guessing. This doc is meant to be the one Dennis works against day-to-day; SCRUM-195 is the one we point investors and Karen at."),
    ),

    heading(3, "Six decisions needed from you (§10)"),
    para(
      t("These unblock SCRUM-196 ticket-break. Suggested place to capture answers is in comments on the existing migration cluster tickets, not new tickets:"),
    ),
    numlist(
      "Repo name in MMC Build org (informs api./app. domain split) → SCRUM-201",
      "Mirror sync cadence between CAI repo and MMC Build repo (proposed: weekly, on push to main) → SCRUM-201",
      "Whether api.mmcbuild.com.au is a separate Vercel project or shares with app. (depends on whether backend code is in same repo) → SCRUM-201",
      "Jira state name: rename 'In UAT' → 'In Test' to match the two-env model, or keep continuity? → SCRUM-206",
      "Jira automation: extend existing scripts/jira-*.mjs webhook handlers, or migrate to Atlassian's native GitHub integration? → SCRUM-206",
      "Trigger condition for §11 Phase Next (CAI repo archive, full DEV/STAGING/PROD split). Proposed: 30 consecutive days mmcbuild.com.au stable + first 5 paying customers onboarded. → SCRUM-196",
    ),

    heading(3, "What it asks of Karen"),
    para(
      mention(KAREN_ID, "@karen.engel"),
      t(" — §9 is for you, fully self-contained. Short version: account-access invitations from Karthik (Vercel/Supabase/GitHub admin), a cost brief (SCRUM-200), and a short DNS cutover window (SCRUM-84). Three URLs do "),
      { type: "text", text: "not", marks: [{ type: "strong" }] },
      t(" become three URLs in this phase — that's deliberately deferred per Karthik's §7."),
    ),

    rule(),

    para(
      t("No edits required from anyone yet — flagging for review. Will hold off on Sprint 7 ticket-break (SCRUM-196) until decisions 1–6 land."),
    ),
  ],
};

// Main -----------------------------------------------------------------------

console.log(`Posting architecture companion doc to ${TICKET}…\n`);

const a1 = await uploadAttachment(
  MD_PATH,
  "branch-and-environment-architecture-v1.0.md",
  "text/markdown",
);
const a2 = await uploadAttachment(
  DOCX_PATH,
  "MMC_Build_Branch_and_Environment_Architecture_v1.0.docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
);

if (!a1 || !a2) {
  console.error("\n✗ One or more attachments failed — NOT posting comment.");
  process.exit(1);
}

console.log("\nPosting comment with @mentions for Karthik and Karen…");
const c = await api("POST", `/rest/api/3/issue/${TICKET}/comment`, { body: commentBody });
if (c.status < 400) {
  console.log(`  ✓ comment posted (id ${c.body?.id})`);
  console.log(`\nView: https://${HOST}/browse/${TICKET}`);
} else {
  console.error(`  ✗ comment failed (${c.status}): ${JSON.stringify(c.body).slice(0, 400)}`);
  process.exit(1);
}
