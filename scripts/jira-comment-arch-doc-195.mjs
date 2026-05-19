#!/usr/bin/env node
/**
 * Post the reframed comment to SCRUM-195. Both attachments are already on the ticket
 * (10046 .md, 10047 .docx) — this just posts the comment.
 *
 * Framing per Dennis: "this is how I plan to implement YOUR (Karthik's) directions —
 * want you to check and confirm before we do the work".
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
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

const TICKET = "SCRUM-195";
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

// ADF helpers
const t = (text) => ({ type: "text", text });
const bold = (text) => ({ type: "text", text, marks: [{ type: "strong" }] });
const code = (text) => ({ type: "text", text, marks: [{ type: "code" }] });
const mention = (id, displayText) => ({ type: "mention", attrs: { id, text: displayText } });
const para = (...content) => ({ type: "paragraph", content });
const heading = (level, text) => ({ type: "heading", attrs: { level }, content: [t(text)] });
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

const commentBody = {
  type: "doc",
  version: 1,
  content: [
    para(
      mention(KARTHIK_ID, "@Karthik Rao"),
      t(" — this is how I'm planning to "),
      bold("implement your SCRUM-195 directions"),
      t(". Want you to check and confirm before we start the work, since I don't want to commit ticket-break time on Sprint 7 against assumptions you haven't validated."),
    ),
    para(
      t("Two attachments on this ticket: the same content in Markdown ("),
      code("branch-and-environment-architecture-v1.0.md"),
      t(", lives in the repo) and Word formats. Read whichever is easier."),
    ),

    heading(3, "What I'm following from your design (no changes from §3, §5, §7)"),
    bullet(
      "Two environments only — Corporate AI = DEV/TEST, MMC Build = PRODUCTION. No DEV/STAGING/PROD split.",
      "Service-based subdomains: www.mmcbuild.com.au (marketing), app.mmcbuild.com.au (frontend), api.mmcbuild.com.au (backend).",
      "Stack unchanged: Vercel, Supabase Sydney, Node.js/Express, GitHub.",
      "Phased migration runs in your §6 order — no resequencing.",
      "Your §7 \"What We Are Not Doing Yet\" boundary held — I've parked the 3-env split as Phase Next (post-MVP), not built it.",
    ),

    heading(3, "What I've added underneath your design (operational, not strategic)"),
    para(
      t("Things you didn't explicitly cover that I had to make a call on. Each is a candidate for you to override:"),
    ),
    bullet(
      [bold("Cross-repo coordination during MVP cutover."), t(" Both repos (CAI upstream + MMC Build) keep "), code("feature → release → main"), t(" branching. Dennis pushes only to CAI repo until cutover stability proven; MMC Build repo stays in lockstep via "), code("git push --mirror"), t(" on a weekly cadence. Hotfix is the only sanctioned direct-to-MMC-Build path, logged in Jira each use.")],
      [bold("Jira lifecycle states."), t(" Proposed renaming \"In UAT\" → \"In Test\" so the state name reflects your two-env reality. Five states: To Do → In Progress → In Review → In Test → Done.")],
      [bold("Phase Next trigger condition."), t(" Proposed: 30 consecutive days of mmcbuild.com.au stability AND first 5 paying customers onboarded. After that, CAI repo archives and we revisit your §11 list (CI/CD, observability, eventually proper DEV/STAGING/PROD).")],
    ),

    heading(3, "Six things I need you to confirm before Sprint 7 ticket-break (SCRUM-196)"),
    para(
      t("These are blockers for me. Suggest you reply on the relevant migration-cluster ticket so the answer lives next to the work it gates:"),
    ),
    numlist(
      [t("Repo name in MMC Build org (informs api./app. domain split) → "), bold("SCRUM-201")],
      [t("Mirror sync cadence between CAI repo and MMC Build repo (proposed: weekly on push to main) → "), bold("SCRUM-201")],
      [t("Whether api.mmcbuild.com.au is a separate Vercel project or shares with app. (depends on whether backend code is in the same repo) → "), bold("SCRUM-201")],
      [t("Jira state rename \"In UAT\" → \"In Test\", or keep continuity? → "), bold("SCRUM-206")],
      [t("Jira automation: extend existing scripts/jira-*.mjs webhook handlers, or migrate to Atlassian's native GitHub integration? → "), bold("SCRUM-206")],
      [t("Phase Next trigger condition (30 days stable + 5 paying customers, or different bar)? → "), bold("SCRUM-196")],
    ),

    heading(3, "What this means for Karen"),
    para(
      mention(KAREN_ID, "@karen.engel"),
      t(" — §9 of the doc is for you, fully self-contained. Short version: account-access invitations from Karthik (Vercel, Supabase, GitHub admin), a one-pager on recurring costs (SCRUM-200), and a 2-3 hour DNS cutover window when "),
      code("mmcbuild.com.au"),
      t(" flips from Base44 to Vercel (SCRUM-84). No change to your daily workflow during the migration. The three-environments idea is "),
      bold("not"),
      t(" being introduced in this phase — that's a deliberate choice per Karthik's §7."),
    ),

    rule(),

    para(
      bold("Holding off on Sprint 7 ticket-break until I hear back."),
      t(" If decisions 1–6 land in the next few days I can break SCRUM-196 into Sprint 7 tickets immediately. If anything in my implementation approach is wrong, easier to fix at this stage than mid-sprint."),
    ),
  ],
};

console.log(`Posting reframed comment to ${TICKET}…`);
const c = await api("POST", `/rest/api/3/issue/${TICKET}/comment`, { body: commentBody });
if (c.status < 400) {
  console.log(`  ✓ comment posted (id ${c.body?.id})`);
  console.log(`  View: https://${HOST}/browse/${TICKET}#focusedCommentId=${c.body?.id}`);
} else {
  console.error(`  ✗ comment failed (${c.status}): ${JSON.stringify(c.body).slice(0, 500)}`);
  process.exit(1);
}
