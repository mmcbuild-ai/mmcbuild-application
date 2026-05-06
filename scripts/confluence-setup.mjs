#!/usr/bin/env node
/**
 * MMC Build — Confluence Space Setup
 *
 * Creates key pages under the existing "MMC Build" Confluence space:
 *   - Sprint Status (mirrors PROJECT_STATE.md)
 *   - Meeting Notes (parent page for per-meeting child pages)
 *   - UAT Test Results (Karen & Karthik log findings)
 *   - R&D Evidence Log (timestamped entries for AusIndustry)
 *   - Architecture Overview (tech stack and module summary)
 *
 * Usage:
 *   node scripts/confluence-setup.mjs
 *
 * Reads from .env.local:
 *   JIRA_HOST, JIRA_EMAIL, JIRA_TOKEN
 *
 * Same credentials work for both Jira and Confluence (same Atlassian site).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────
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
  console.log("  ✓ Loaded .env.local");
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;

if (!EMAIL || !TOKEN) {
  console.error("\n❌ Missing credentials in .env.local");
  if (!EMAIL) console.error("   Add: JIRA_EMAIL=dennis@corporateaisolutions.com");
  if (!TOKEN) console.error("   Add: JIRA_TOKEN=your_api_token");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const WIKI = `https://${HOST}/wiki/rest/api`;

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
    console.error(`  ✗ ${method} ${res.status}: ${text.slice(0, 300)}`);
    return null;
  }
  return text ? JSON.parse(text) : {};
}

// ── Find existing space ──────────────────────────────────────────────────
async function findSpace() {
  // Try common space keys
  for (const key of ["MB", "MMCBUILD", "MMC", "~karen.engel"]) {
    const space = await api(`${WIKI}/space/${key}`);
    if (space?.key) return space;
  }
  // Search all spaces
  const all = await api(`${WIKI}/space?limit=50`);
  if (all?.results) {
    const match = all.results.find(
      (s) =>
        s.name?.toLowerCase().includes("mmc") ||
        s.name?.toLowerCase().includes("build")
    );
    if (match) return match;
    // List them so user can identify
    console.log("\n  Available spaces:");
    for (const s of all.results) {
      console.log(`    ${s.key.padEnd(12)} ${s.name}`);
    }
  }
  return null;
}

// ── Create page ──────────────────────────────────────────────────────────
async function createPage(spaceKey, title, body, parentId = null) {
  // Check if page already exists
  const search = await api(
    `${WIKI}/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}&limit=1`
  );
  if (search?.results?.length > 0) {
    console.log(`  ↩ Already exists: ${search.results[0].id} — ${title}`);
    return search.results[0];
  }

  const payload = {
    type: "page",
    title,
    space: { key: spaceKey },
    body: {
      storage: {
        value: body,
        representation: "storage",
      },
    },
  };

  if (parentId) {
    payload.ancestors = [{ id: parentId }];
  }

  const result = await api(`${WIKI}/content`, "POST", payload);
  if (result?.id) {
    console.log(`  ✓ Created: ${result.id} — ${title}`);
  }
  return result;
}

// ── Page templates ───────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];

const PAGES = [
  {
    title: "Sprint Status",
    body: `
<h2>Current Sprint: v0.4.0 — Sprint 4</h2>
<p>Client feedback and iteration phase. Last updated: ${TODAY}</p>

<h3>Platform Status</h3>
<table>
  <tr><th>Module</th><th>Status</th><th>Notes</th></tr>
  <tr><td>MMC Comply</td><td>✅ Live</td><td>NCC compliance AI + RAG pipeline</td></tr>
  <tr><td>MMC Build</td><td>✅ Live</td><td>Design optimisation + 3D viewer + system selection</td></tr>
  <tr><td>MMC Quote</td><td>✅ Live</td><td>Agentic cost estimation + supplier knowledge base</td></tr>
  <tr><td>MMC Direct</td><td>✅ Live</td><td>Trade/consultant directory + self-registration</td></tr>
  <tr><td>MMC Train</td><td>✅ Live</td><td>Self-paced modules + progress tracking</td></tr>
  <tr><td>Billing</td><td>✅ Live</td><td>Stripe test mode — 60-day free trial</td></tr>
</table>

<h3>Blocking Items</h3>
<table>
  <tr><th>Item</th><th>Owner</th><th>Due</th><th>Status</th></tr>
  <tr><td>Figma design mockups (correct versions)</td><td>Karen</td><td>Overdue</td><td>❌ Not received</td></tr>
  <tr><td>AusIndustry R&amp;D Tax Incentive registration</td><td>Karen + accountant</td><td>30 Apr 2026</td><td>⚠️ In progress</td></tr>
  <tr><td>Sprint 4 QA sign-off</td><td>Karthik</td><td>TBC</td><td>⏳ Pending</td></tr>
</table>

<h3>Jira Board</h3>
<p><ac:structured-macro ac:name="jira" ac:schema-version="1">
  <ac:parameter ac:name="server">System JIRA</ac:parameter>
  <ac:parameter ac:name="jqlQuery">project = SCRUM AND sprint in openSprints() ORDER BY priority DESC</ac:parameter>
  <ac:parameter ac:name="maximumIssues">20</ac:parameter>
</ac:structured-macro></p>
`,
  },
  {
    title: "Meeting Notes",
    body: `
<h2>Meeting Notes</h2>
<p>Create a child page under this section for each meeting. Use the template below.</p>

<hr />
<h3>Template</h3>
<ac:structured-macro ac:name="code" ac:schema-version="1">
  <ac:plain-text-body><![CDATA[
Meeting: [Sprint Review / Standup / Ad-hoc]
Date: YYYY-MM-DD
Attendees: Dennis, Karen, Karthik

## Agenda
1. ...

## Discussion
- ...

## Action Items
| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | ...    | ...   | ... |

## Decisions
- ...
]]></ac:plain-text-body>
</ac:structured-macro>
`,
  },
  {
    title: "UAT Test Results",
    body: `
<h2>UAT Test Results</h2>
<p>Karen and Karthik: log your test findings here. One row per test. For bugs, also create a Jira ticket.</p>

<table>
  <tr>
    <th>Date</th>
    <th>Tester</th>
    <th>Module</th>
    <th>Test</th>
    <th>Result</th>
    <th>Notes / Jira Ticket</th>
  </tr>
  <tr>
    <td>${TODAY}</td>
    <td><em>Name</em></td>
    <td><em>e.g. MMC Comply</em></td>
    <td><em>e.g. Upload PDF and run compliance check</em></td>
    <td><em>Pass / Fail / Blocked</em></td>
    <td><em>Details or SCRUM-XX link</em></td>
  </tr>
</table>

<h3>Test Scenarios</h3>
<table>
  <tr><th>#</th><th>Module</th><th>Scenario</th><th>Expected Outcome</th></tr>
  <tr><td>1</td><td>MMC Build</td><td>Create project with NSW address and sample plans</td><td>Property intelligence loads, use-case assessment completes</td></tr>
  <tr><td>2</td><td>MMC Comply</td><td>Upload PDF, complete questionnaire, generate report</td><td>AI analysis with NCC citations, risk flags, PDF export</td></tr>
  <tr><td>3</td><td>MMC Quote</td><td>Run cost estimate on existing project</td><td>Cost breakdown with traditional vs MMC comparison</td></tr>
  <tr><td>4</td><td>MMC Direct</td><td>Browse directory, submit registration form</td><td>Listing appears in admin queue, confirmation email sent</td></tr>
  <tr><td>5</td><td>MMC Train</td><td>Open training module, complete a lesson</td><td>Progress tracked, completion recorded</td></tr>
  <tr><td>6</td><td>Billing</td><td>View subscription page, check trial status</td><td>60-day trial active, plan details visible</td></tr>
</table>
`,
  },
  {
    title: "R&D Evidence Log",
    body: `
<h2>R&amp;D Evidence Log — FY2025/26</h2>
<p><strong>Purpose:</strong> Timestamped evidence for AusIndustry R&amp;D Tax Incentive registration (Section 355-25 ITAA 1997).</p>
<p><strong>Deadline:</strong> Registration must be lodged by <strong>30 April 2026</strong>. Potential value: $13,681 tax offset.</p>
<p><strong>Entity:</strong> Global Buildtech Australia Pty Ltd (GBTA) — ABN to be confirmed.</p>

<hr />

<h3>R&amp;D Activities</h3>
<table>
  <tr><th>Date</th><th>Activity</th><th>Module</th><th>Evidence Type</th><th>Description</th></tr>
  <tr>
    <td>2026-03-01</td><td>Core R&amp;D</td><td>MMC Comply</td><td>Architecture</td>
    <td>RAG pipeline for NCC compliance — pgvector embeddings + Claude AI cross-validation against building code sections</td>
  </tr>
  <tr>
    <td>2026-03-15</td><td>Core R&amp;D</td><td>MMC Quote</td><td>Architecture</td>
    <td>Agentic cost estimation — multi-step AI pipeline comparing traditional vs MMC construction methods with supplier knowledge base</td>
  </tr>
  <tr>
    <td>2026-04-01</td><td>Core R&amp;D</td><td>MMC Build</td><td>Architecture</td>
    <td>Property intelligence system — Mapbox geocoding + zoning/climate/BAL analysis for automated site assessment</td>
  </tr>
  <tr>
    <td>2026-04-06</td><td>Supporting</td><td>Infrastructure</td><td>Commit log</td>
    <td>Material/system selection panel — JSONB state shared across all AI modules for personalised analysis</td>
  </tr>
</table>

<h3>How to add entries</h3>
<p>Add a row for each significant R&amp;D activity. Include:</p>
<ul>
  <li><strong>Date</strong> — when the work was done</li>
  <li><strong>Activity type</strong> — Core R&amp;D (novel/experimental) or Supporting (enabling)</li>
  <li><strong>Module</strong> — which platform module</li>
  <li><strong>Evidence type</strong> — Architecture, Commit log, Test result, Experiment, Literature review</li>
  <li><strong>Description</strong> — what was attempted, what hypothesis was tested, what was learned</li>
</ul>

<h3>Git Evidence</h3>
<p>Commit history is preserved in the private GitHub repository. Key branches and tags map to sprint milestones.</p>
`,
  },
  {
    title: "Architecture Overview",
    body: `
<h2>MMC Build — Architecture Overview</h2>
<p>AI-powered compliance and construction intelligence platform for Australian residential construction.</p>

<h3>Tech Stack</h3>
<table>
  <tr><th>Layer</th><th>Technology</th></tr>
  <tr><td>Frontend</td><td>Next.js 16 / TypeScript / Tailwind CSS / shadcn/ui</td></tr>
  <tr><td>Database</td><td>Supabase PostgreSQL + pgvector (Sydney region)</td></tr>
  <tr><td>Auth</td><td>Supabase Auth (magic link + password)</td></tr>
  <tr><td>Storage</td><td>Supabase Storage (Sydney region)</td></tr>
  <tr><td>Jobs</td><td>Inngest (async AI pipelines, cron)</td></tr>
  <tr><td>AI — Primary</td><td>Anthropic Claude (compliance, cost, design analysis)</td></tr>
  <tr><td>AI — Embeddings</td><td>OpenAI text-embedding-3-small</td></tr>
  <tr><td>Email</td><td>Resend (transactional)</td></tr>
  <tr><td>Payments</td><td>Stripe (test mode for MVP)</td></tr>
  <tr><td>Hosting</td><td>Vercel</td></tr>
</table>

<h3>Six Modules</h3>
<table>
  <tr><th>#</th><th>Module</th><th>Purpose</th><th>Status</th></tr>
  <tr><td>1</td><td>MMC Build</td><td>Design optimisation — property intelligence, use-case assessment, 3D viewer, system selection</td><td>✅ Live</td></tr>
  <tr><td>2</td><td>MMC Comply</td><td>NCC compliance checking — AI analysis with RAG against building code</td><td>✅ Live</td></tr>
  <tr><td>3</td><td>MMC Quote</td><td>Cost estimation — agentic pipeline, traditional vs MMC comparison</td><td>✅ Live</td></tr>
  <tr><td>4</td><td>MMC Direct</td><td>Trade/consultant directory — self-registration, admin approval, HubSpot sync</td><td>✅ Live</td></tr>
  <tr><td>5</td><td>MMC Train</td><td>Training modules — self-paced learning with progress tracking</td><td>✅ Live</td></tr>
  <tr><td>6</td><td>Billing</td><td>Stripe subscriptions — 60-day free trial, paywall enforcement</td><td>✅ Live</td></tr>
</table>

<h3>Data Flow</h3>
<p>User creates a project → selects construction systems in Build → systems flow to Comply (filters NCC clauses), Quote (pre-populates rates), Direct (filters trades), and Train (surfaces relevant courses). All AI calls route through a central model router. Reports are versioned immutably.</p>

<h3>Security</h3>
<ul>
  <li>Row Level Security (RLS) on every table — org-scoped via <code>get_user_org_id()</code></li>
  <li>All AI API keys server-side only</li>
  <li>Zod validation on all inputs</li>
  <li>Stripe billing enforced at both middleware (UX) and Server Action (correctness)</li>
</ul>
`,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n📄 MMC Build — Confluence Setup");
  console.log(`   ${HOST}\n`);

  // 1. Find the space
  console.log("1. Finding MMC Build space...");
  const space = await findSpace();
  if (!space) {
    console.error("\n❌ No MMC Build space found. Create one manually first:");
    console.error(`   https://${HOST}/wiki/spaces/create`);
    process.exit(1);
  }
  console.log(`   ✓ Found: ${space.key} — ${space.name}`);

  // 2. Find the homepage (parent for all new pages)
  console.log("\n2. Finding space homepage...");
  const homepage = await api(
    `${WIKI}/content?spaceKey=${space.key}&type=page&title=${encodeURIComponent(space.name + " Home")}&limit=1`
  );
  let parentId = homepage?.results?.[0]?.id || null;

  // If no "Home" page, try the space's root page
  if (!parentId) {
    const root = await api(`${WIKI}/content?spaceKey=${space.key}&type=page&limit=1`);
    parentId = root?.results?.[0]?.id || null;
  }

  if (parentId) {
    console.log(`   ✓ Parent page ID: ${parentId}`);
  } else {
    console.log("   ⚠️ No parent page found — pages will be created at space root");
  }

  // 3. Create pages
  console.log("\n3. Creating pages...");
  for (const page of PAGES) {
    await createPage(space.key, page.title, page.body, parentId);
  }

  // 4. Check users have access
  console.log("\n4. Checking user access...");
  const karenEmail = process.env.KAREN_EMAIL;
  const karthikEmail = process.env.KARTHIK_EMAIL;
  if (karenEmail || karthikEmail) {
    console.log("   Users with Jira access automatically have Confluence access");
    console.log("   on the same Atlassian site (same licence).");
    if (karenEmail) console.log(`   Karen: ${karenEmail}`);
    if (karthikEmail) console.log(`   Karthik: ${karthikEmail}`);
  } else {
    console.log("   Add KAREN_EMAIL and KARTHIK_EMAIL to .env.local to verify access");
  }

  // Done
  console.log("\n" + "═".repeat(56));
  console.log("  ✅ Confluence setup complete");
  console.log("═".repeat(56));
  console.log(`\n  Space: https://${HOST}/wiki/spaces/${space.key}/overview`);
  console.log(`  Pages created under: ${space.name}\n`);
  console.log("  Pages:");
  for (const page of PAGES) {
    console.log(`    - ${page.title}`);
  }
  console.log("\n  Next steps:");
  console.log("  1. Verify Karen and Karthik can access the space");
  console.log("  2. Link the Sprint Status page from Jira board settings");
  console.log("  3. Ask Karen to update R&D Evidence Log with AusIndustry status");
}

main().catch((e) => {
  console.error("❌ ", e.message);
  process.exit(1);
});
