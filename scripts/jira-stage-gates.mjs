/**
 * MMC Build — Jira Stage Gate Acceptance Tickets
 *
 * Creates stage gate acceptance tickets on the SCRUM board
 * for Karen to formally approve each payment milestone.
 *
 * Usage:
 *   node scripts/jira-stage-gates.mjs
 *
 * Reads from .env.local:
 *   JIRA_HOST, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Load .env.local (won't overwrite existing env vars) ──────────────────
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    });
  console.log("  ✓ Loaded .env.local (fill-in only)");
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;

if (!EMAIL || !TOKEN) {
  console.error("\n❌ Missing Jira credentials in .env.local");
  if (!EMAIL) console.error("   Add: JIRA_EMAIL=dennis@corporateaisolutions.com");
  if (!TOKEN) console.error("   Add: JIRA_TOKEN=your_api_token");
  console.error("");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const BASE = `https://${HOST}/rest/api/3`;

async function api(url, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Basic ${AUTH}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    console.error(`${method} ${url} → ${res.status}: ${text}`);
    return null;
  }
  return text ? JSON.parse(text) : {};
}

// ── Debug: show what we're using ─────────────────────────────────────────
console.log(`  Host:    ${HOST}`);
console.log(`  Email:   ${EMAIL}`);
console.log(`  Project: ${PROJECT_KEY}`);
console.log(`  Token:   ${TOKEN?.slice(0, 6)}...${TOKEN?.slice(-4)}`);

// ── Get project + issue types ────────────────────────────────────────────
console.log("\n1. Loading project...");

// Try direct project lookup first, fall back to search
let project = await api(`${BASE}/project/${PROJECT_KEY}`);
if (!project) {
  console.log("   Direct lookup failed. Listing all accessible projects...");
  const allProjects = await api(`${BASE}/project`);
  if (allProjects?.length) {
    console.log("   Available projects:");
    for (const p of allProjects) {
      console.log(`     • ${p.key}: ${p.name} (id: ${p.id})`);
    }
    project = allProjects.find((p) => p.key === PROJECT_KEY);
    if (!project) {
      console.error(`\n❌ Project "${PROJECT_KEY}" not found among accessible projects.`);
      process.exit(1);
    }
  } else {
    console.error("\n❌ Cannot list projects. Check credentials.");
    process.exit(1);
  }
}
if (!project) process.exit(1);
console.log(`   Project: ${project.name} (${project.key})`);

const types = await api(`${BASE}/issuetype/project?projectId=${project.id}`);
const taskType = types?.find((t) => t.name === "Task") || types?.find((t) => t.name === "Story");
if (!taskType) {
  console.error("Cannot find Task or Story issue type");
  process.exit(1);
}
console.log(`   Issue type: ${taskType.name} (${taskType.id})`);

// ── Stage gate tickets ───────────────────────────────────────────────────
const stageGates = [
  {
    summary: "STAGE GATE: Deposit (20%) — Payment Overdue",
    description: `**Payment: Deposit (20%)**
**Amount:** $12,070 ex GST ($13,277 incl. GST)
**Trigger:** On acceptance of original quotation
**Status:** INVOICED — OVERDUE

This deposit was invoiced on acceptance of the original quotation (GBTA-MMC-2026-001, 24 Feb 2026).

**Action required:** Payment is overdue. Please arrange payment immediately.

Reference: GBTA-MMC-2026-001-A1, Section 5`,
    labels: ["stage-gate", "invoice", "overdue"],
    priority: "Highest",
  },
  {
    summary: "STAGE GATE: Accept Stages 0+1 — Foundation + Comply ($8,228)",
    description: `**Payment: Progress Payment 1 — Stages 0+1**
**Amount:** $7,480 ex GST ($8,228 incl. GST)
**Trigger:** Foundation + Compliance engine delivered and accepted

**Stages delivered:**
- Stage 0: Project Setup & Foundation (3 days) — COMPLETE
- Stage 1: MMC Comply — NCC Compliance Engine (20 days) — COMPLETE

**Deliverables include:** Supabase project, Vercel CI/CD, 29 DB migrations, Auth + RBAC, NCC knowledge base, enhanced RAG pipeline, agentic compliance analysis, multi-model cross-validation, feedback learning loop, compliance reports, remediation workflow.

**Action required:** Karen to confirm acceptance by commenting "Accepted" on this ticket.

Once accepted, GBTA will issue invoice for $8,228 incl. GST. Payable within 14 days.

Note: Deposit ($13,277) is credited against this payment per original quotation terms.

Reference: GBTA-MMC-2026-001-A1, Section 5`,
    labels: ["stage-gate", "invoice", "invoiceable"],
    priority: "High",
  },
  {
    summary: "STAGE GATE: Accept Stages 2+3 — Build + Quote ($23,375)",
    description: `**Payment: Progress Payment 2 — Stages 2+3**
**Amount:** $21,250 ex GST ($23,375 incl. GST)
**Trigger:** Design Optimisation + Cost Estimation delivered and accepted

**Stages delivered:**
- Stage 2: MMC Build — Design Optimisation (15 days) — COMPLETE
- Stage 3: MMC Quote — Cost Estimation (10 days) — COMPLETE

**Deliverables include:** MMC methods knowledge base, design analysis engine, 3D spatial extraction & viewer (stretch goal achieved), original vs optimised view, design report, supplier/cost rate knowledge base (70+ Australian rates), agentic cost estimation engine, holding cost calculator, interactive quote builder, quote export.

**Action required:** Karen to confirm acceptance by commenting "Accepted" on this ticket.

Once accepted, GBTA will issue invoice for $23,375 incl. GST. Payable within 14 days.

Reference: GBTA-MMC-2026-001-A1, Section 5`,
    labels: ["stage-gate", "invoice", "invoiceable"],
    priority: "High",
  },
  {
    summary: "STAGE GATE: Accept Stages 4+5 — Direct + Train ($9,350)",
    description: `**Payment: Progress Payment 3 — Stages 4+5**
**Amount:** $8,500 ex GST ($9,350 incl. GST)
**Trigger:** Trade Directory + Training delivered and accepted

**Stages delivered:**
- Stage 4: MMC Direct — Trade Directory (5 days) — COMPLETE
- Stage 5: MMC Train — Training Modules (5 days) — COMPLETE

**Deliverables include:** Directory with 18 trade types, ABN/licence verification, search & filtering, shortlist & lead management, professional registration, review system, course CMS, learner interface, progress tracking, PDF certificates, AI content generation.

**Action required:** Karen to confirm acceptance by commenting "Accepted" on this ticket.

Once accepted, GBTA will issue invoice for $9,350 incl. GST. Payable within 14 days.

Reference: GBTA-MMC-2026-001-A1, Section 5`,
    labels: ["stage-gate", "invoice", "invoiceable"],
    priority: "High",
  },
  {
    summary: "STAGE GATE: Stages 6+7 — Billing + Pilot + Handover ($12,155)",
    description: `**Payment: Final Payment — Stages 6+7**
**Amount:** $11,050 ex GST ($12,155 incl. GST)
**Trigger:** Billing live + Pilot complete + Handover accepted

**Stage 6: Billing, Observability & Launch (3 days) — IN PROGRESS**
- Stripe billing: Delivered
- Paywall enforcement: Delivered
- Usage metering: Delivered
- Observability: Pending
- Security review: Pending
- E2E testing: Partial
- Pilot launch package: Pending

**Stage 7: Pilot, Iteration & Handover (10 days) — NOT STARTED**
- Blocked on: 5-10 pilot firms to be confirmed by MMC Build

**Blockers:**
- Stripe price IDs need to be created in Stripe dashboard by MMC Build
- Stripe env vars need to be added to Vercel
- 5-10 pilot firms to be confirmed

**This invoice will be issued on completion of both stages.**

Reference: GBTA-MMC-2026-001-A1, Section 5`,
    labels: ["stage-gate", "invoice", "future"],
    priority: "Medium",
  },
];

// ── Create tickets ───────────────────────────────────────────────────────
console.log("\n2. Creating stage gate tickets...\n");

for (const gate of stageGates) {
  const body = {
    fields: {
      project: { key: PROJECT_KEY },
      summary: gate.summary,
      description: {
        type: "doc",
        version: 1,
        content: gate.description.split("\n").map((line) => ({
          type: "paragraph",
          content: line
            ? [{ type: "text", text: line }]
            : [{ type: "text", text: " " }],
        })),
      },
      issuetype: { id: taskType.id },
      labels: gate.labels,
    },
  };

  const result = await api(`${BASE}/issue`, "POST", body);
  if (result?.key) {
    console.log(`   ✓ ${result.key}: ${gate.summary}`);
  } else {
    console.log(`   ✗ Failed: ${gate.summary}`);
  }
}

console.log("\n✅ Stage gate tickets created.");
console.log("   Karen will receive Jira notifications for each ticket.");
console.log("   She can approve by commenting 'Accepted' on each one.\n");
