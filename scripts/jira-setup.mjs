/**
 * MMC Build — Jira Scrum Setup
 *
 * Creates epics, stories, and configures Sprint 3 (v0.3.0) automatically.
 *
 * Usage:
 *   JIRA_EMAIL=mcmdennis@gmail.com \
 *   JIRA_API_KEY=your_token \
 *   node scripts/jira-setup.mjs
 *
 * Requires: JIRA_EMAIL, JIRA_API_KEY env vars
 */

const HOST = "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = "SCRUM"; // Will reference existing project
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_KEY;

if (!EMAIL || !TOKEN) {
  console.error("Set JIRA_EMAIL and JIRA_API_KEY env vars");
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const BASE = `https://${HOST}/rest/api/3`;
const AGILE = `https://${HOST}/rest/agile/1.0`;

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

// ─── Step 1: Get project info ───

console.log("1. Loading project...");
const project = await api(`${BASE}/project/${PROJECT_KEY}`);
if (!project) process.exit(1);
console.log(`   Project: ${project.name} (${project.key}), ID: ${project.id}`);

// Get my account ID
const myself = await api(`${BASE}/myself`);
const myAccountId = myself?.accountId;
console.log(`   User: ${myself?.displayName} (${myAccountId})`);

// ─── Step 2: Get issue types ───

const meta = await api(`${BASE}/issue/createmeta?projectKeys=${PROJECT_KEY}&expand=projects.issuetypes`);
const issueTypes = meta?.projects?.[0]?.issuetypes ?? [];
const epicType = issueTypes.find((t) => t.name === "Epic");
const storyType = issueTypes.find((t) => t.name === "Story");
const taskType = issueTypes.find((t) => t.name === "Task");

if (!epicType || !storyType) {
  // Fallback: try fetching issue types directly
  console.log("   Trying direct issue type fetch...");
  const types = await api(`${BASE}/issuetype/project?projectId=${project.id}`);
  const epicFallback = types?.find((t) => t.name === "Epic");
  const storyFallback = types?.find((t) => t.name === "Story");
  if (!epicFallback || !storyFallback) {
    console.error("Cannot find Epic/Story issue types");
    process.exit(1);
  }
  Object.assign(epicType ?? {}, epicFallback);
  Object.assign(storyType ?? {}, storyFallback);
}

console.log(`   Epic type: ${epicType?.id}, Story type: ${storyType?.id}`);

// ─── Step 3: Create Epics ───

const EPICS = [
  { name: "MMC Comply", desc: "NCC compliance checking — AI analysis, RAG, cross-validation" },
  { name: "MMC Build", desc: "Design optimisation — MMC opportunity analysis" },
  { name: "MMC Quote", desc: "Cost estimation — agentic cost breakdown with MMC comparison" },
  { name: "MMC Direct", desc: "Trade directory — registration, search, reviews, enquiries" },
  { name: "MMC Train", desc: "Training & certification — LMS, AI content generation" },
  { name: "Billing", desc: "Stripe subscriptions, paywall, usage metering" },
  { name: "Infrastructure", desc: "Auth, RLS, migrations, CI/CD, Vercel, Supabase" },
  { name: "Dashboard & UX", desc: "Dashboard, onboarding, shared UI components" },
];

const epicKeys = {};

console.log("\n2. Creating Epics...");
for (const epic of EPICS) {
  // Check if epic already exists
  const search = await api(
    `${BASE}/search/jql?jql=project=${PROJECT_KEY} AND issuetype=Epic AND summary~"${epic.name}"&maxResults=1`
  );
  if (search?.issues?.length > 0) {
    const existing = search.issues[0];
    epicKeys[epic.name] = existing.key;
    console.log(`   ✓ ${epic.name} already exists: ${existing.key}`);
    continue;
  }

  const created = await api(`${BASE}/issue`, "POST", {
    fields: {
      project: { key: PROJECT_KEY },
      issuetype: { id: epicType.id },
      summary: epic.name,
      description: {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: epic.desc }] }],
      },
    },
  });

  if (created?.key) {
    epicKeys[epic.name] = created.key;
    console.log(`   ✓ Created ${epic.name}: ${created.key}`);
  } else {
    console.log(`   ✗ Failed to create ${epic.name}`);
  }
}

// ─── Step 4: Get/Create Sprint 3 ───

console.log("\n3. Configuring Sprint...");

// Find the board
const boards = await api(`${AGILE}/board?projectKeyOrId=${PROJECT_KEY}`);
const board = boards?.values?.[0];
if (!board) {
  console.error("No Scrum board found");
  process.exit(1);
}
console.log(`   Board: ${board.name} (ID: ${board.id})`);

// Get sprints
const sprints = await api(`${AGILE}/board/${board.id}/sprint?state=active,future`);
let sprint = sprints?.values?.find((s) => s.name.includes("v0.3.0") || s.name.includes("Sprint 3"));

if (!sprint) {
  // Rename Sprint 0 if it exists, or create new
  const sprint0 = sprints?.values?.find((s) => s.name.includes("Sprint 0") || s.name.includes("Sprint 1"));
  if (sprint0) {
    await api(`${AGILE}/sprint/${sprint0.id}`, "PUT", {
      name: "Sprint 3 — v0.3.0",
      goal: "Material selection, report versioning, onboarding, directory registration, HubSpot sync",
    });
    sprint = { ...sprint0, name: "Sprint 3 — v0.3.0" };
    console.log(`   ✓ Renamed ${sprint0.name} → Sprint 3 — v0.3.0`);
  } else {
    // Create new sprint
    const created = await api(`${AGILE}/sprint`, "POST", {
      name: "Sprint 3 — v0.3.0",
      originBoardId: board.id,
      goal: "Material selection, report versioning, onboarding, directory registration, HubSpot sync",
    });
    sprint = created;
    console.log(`   ✓ Created Sprint 3 — v0.3.0 (ID: ${created?.id})`);
  }
} else {
  console.log(`   ✓ Sprint already exists: ${sprint.name} (ID: ${sprint.id})`);
}

// ─── Step 5: Create Stories ───

console.log("\n4. Creating Stories...");

const STORIES = [
  // ── Completed items (Sprint 1-2) ──
  { summary: "Property intelligence in project creation", epic: "MMC Build", status: "done", sprint: false },
  { summary: "Use-case assessment in project creation dialog", epic: "MMC Build", status: "done", sprint: false },
  { summary: "Create project dialog scrolling fix", epic: "Dashboard & UX", status: "done", sprint: false },
  { summary: "Address autocomplete overflow fix", epic: "Dashboard & UX", status: "done", sprint: false },
  { summary: "Replace confirm() with async AlertDialog (INP fix)", epic: "Dashboard & UX", status: "done", sprint: false },
  { summary: "Cost rate management — browse, edit, CSV upload", epic: "MMC Quote", status: "done", sprint: false },
  { summary: "Auth email redirect fix (NEXT_PUBLIC_APP_URL)", epic: "Infrastructure", status: "done", sprint: false },
  { summary: "Mapbox reverse geocode 422 fix", epic: "Infrastructure", status: "done", sprint: false },
  { summary: "Coordinate input support in address field", epic: "MMC Build", status: "done", sprint: false },
  { summary: "GitHub repo made private", epic: "Infrastructure", status: "done", sprint: false },
  { summary: "Karen and Karthik added as GitHub collaborators", epic: "Infrastructure", status: "done", sprint: false },
  { summary: "Admin/user view toggle on dashboard", epic: "Dashboard & UX", status: "done", sprint: false },

  // ── Sprint 3 items (v0.3.0) — COMPLETED ──
  { summary: "Material/System selection panel", epic: "MMC Build", status: "done", sprint: true,
    desc: "6-system toggle panel (SIPs, CLT, Steel Frame, Timber Frame, Volumetric Modular, Hybrid). JSONB column. Selected systems injected into Comply/Build/Quote AI prompts." },
  { summary: "Report versioning — immutable version history", epic: "Infrastructure", status: "done", sprint: true,
    desc: "report_versions table, version records on Inngest completion, versioned PDF filenames, ReportVersionList on all module pages." },
  { summary: "Dashboard onboarding flow", epic: "Dashboard & UX", status: "done", sprint: true,
    desc: "First-login banner with 5-step workflow, no-project gate modal, sequence numbers on module cards." },
  { summary: "Directory self-registration + admin approval", epic: "MMC Direct", status: "done", sprint: true,
    desc: "Public form at /directory/register, honeypot spam protection, Resend confirmation email, admin queue at /admin/directory." },
  { summary: "HubSpot sync for approved directory entries", epic: "MMC Direct", status: "done", sprint: true,
    desc: "Inngest function on directory/entry.approved. No-ops without HUBSPOT_API_KEY. Creates Company + Contact via HubSpot API v3." },

  // ── Blocked items ──
  { summary: "Implement correct Figma colours/fonts", epic: "Dashboard & UX", status: "blocked",
    desc: "Blocked on Karen — Figma prototype is structural reference ONLY. Await correct mockups." },
  { summary: "AusIndustry R&D registration FY2025/26", epic: "Infrastructure", status: "blocked",
    desc: "DEADLINE: 30 April 2026. Owner: Karen + accountant. Not a code task." },
];

for (const story of STORIES) {
  // Check if story already exists
  const escapedSummary = story.summary.replace(/"/g, '\\"');
  const search = await api(
    `${BASE}/search/jql?jql=project=${PROJECT_KEY} AND summary~"${escapedSummary}"&maxResults=1`
  );
  if (search?.issues?.length > 0) {
    console.log(`   ✓ Already exists: ${search.issues[0].key} — ${story.summary}`);
    continue;
  }

  const fields = {
    project: { key: PROJECT_KEY },
    issuetype: { id: storyType.id },
    summary: story.summary,
  };

  // Link to epic
  const epicKey = epicKeys[story.epic];
  if (epicKey) {
    fields.parent = { key: epicKey };
  }

  // Assign to me
  if (myAccountId) {
    fields.assignee = { accountId: myAccountId };
  }

  // Description
  if (story.desc) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: story.desc }] }],
    };
  }

  // Labels for status tracking
  if (story.status === "blocked") {
    fields.labels = ["blocked"];
  }

  const created = await api(`${BASE}/issue`, "POST", { fields });

  if (created?.key) {
    console.log(`   ✓ Created: ${created.key} — ${story.summary}`);

    // Move to sprint if applicable
    if (story.sprint && sprint?.id) {
      await api(`${AGILE}/sprint/${sprint.id}/issue`, "POST", {
        issues: [created.key],
      });
    }
  } else {
    console.log(`   ✗ Failed: ${story.summary}`);
  }
}

// ─── Done ───

console.log("\n✓ Jira setup complete!");
console.log(`  Board: https://${HOST}/jira/software/projects/${PROJECT_KEY}/boards/${board.id}`);
console.log(`  Backlog: https://${HOST}/jira/software/projects/${PROJECT_KEY}/boards/${board.id}/backlog`);
console.log("\nNext steps:");
console.log("  1. Invite Karen and Karthik via Project Settings → Access");
console.log("  2. Transition completed stories to Done status in the board");
console.log("  3. Consider renaming project key SCRUM → MMC in Project Settings → Details");
