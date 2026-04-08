/**
 * MMC Build — Jira Cleanup
 * Deletes duplicates, re-parents stories, transitions completed items to Done.
 */

const HOST = "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const BASE = `https://${HOST}/rest/api/3`;
const AGILE = `https://${HOST}/rest/agile/1.0`;

async function api(url, method = "GET", body = null) {
  const opts = {
    method,
    headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (method === "DELETE" && res.status === 204) return { ok: true };
  const text = await res.text();
  if (!res.ok) { console.error(`  ✗ ${method} ${res.status}: ${text.slice(0, 200)}`); return null; }
  return text ? JSON.parse(text) : {};
}

// ─── 1. Delete duplicate epics + stale task ───

const TO_DELETE = [
  "SCRUM-3",   // stale test task
  "SCRUM-13",  // duplicate Dashboard & UX
  "SCRUM-33",  // duplicate MMC Build Module
  "SCRUM-34",  // duplicate MMC Comply Module
  "SCRUM-35",  // duplicate MMC Quote Module
  "SCRUM-36",  // duplicate MMC Direct Module
  "SCRUM-37",  // duplicate MMC Train Module
  "SCRUM-38",  // duplicate Billing & Stripe
  "SCRUM-39",  // duplicate Infrastructure & DevOps
  "SCRUM-40",  // duplicate Dashboard & UX
];

console.log("1. Deleting duplicate/stale issues...");
for (const key of TO_DELETE) {
  const result = await api(`${BASE}/issue/${key}?deleteSubtasks=true`, "DELETE");
  console.log(`   ${result ? "✓" : "✗"} ${key}`);
}

// ─── 2. Re-parent stories to correct epics ───

// Correct epic mapping: epic name → epic key
const EPIC_MAP = {
  "MMC Comply": "SCRUM-5",
  "MMC Build": "SCRUM-6",
  "MMC Quote": "SCRUM-7",
  "MMC Direct": "SCRUM-8",
  "MMC Train": "SCRUM-9",
  "Billing": "SCRUM-10",
  "Infrastructure": "SCRUM-11",
  "Dashboard & UX": "SCRUM-12",
};

// Story → correct epic
const STORY_PARENTS = {
  "SCRUM-14": "MMC Build",      // Property intelligence in project creation
  "SCRUM-15": "MMC Build",      // Use-case assessment
  "SCRUM-16": "Dashboard & UX", // Create project dialog scrolling fix
  "SCRUM-17": "Dashboard & UX", // Address autocomplete overflow
  "SCRUM-18": "Dashboard & UX", // Replace confirm() with AlertDialog
  "SCRUM-19": "MMC Quote",      // Cost rate management
  "SCRUM-20": "Infrastructure", // Auth email redirect fix
  "SCRUM-21": "Infrastructure", // Mapbox reverse geocode fix
  "SCRUM-22": "MMC Build",      // Coordinate input support
  "SCRUM-23": "Infrastructure", // GitHub repo made private
  "SCRUM-24": "Infrastructure", // Karen/Karthik GitHub collaborators
  "SCRUM-25": "Dashboard & UX", // Admin/user view toggle
  "SCRUM-26": "MMC Build",      // Material/System selection panel
  "SCRUM-27": "Infrastructure", // Report versioning
  "SCRUM-28": "Dashboard & UX", // Dashboard onboarding flow
  "SCRUM-29": "MMC Direct",     // Directory self-registration
  "SCRUM-30": "MMC Direct",     // HubSpot sync
  "SCRUM-31": "Dashboard & UX", // Figma colours/fonts (blocked)
  "SCRUM-32": "Infrastructure", // AusIndustry R&D (blocked)
};

console.log("\n2. Re-parenting stories to correct epics...");
for (const [storyKey, epicName] of Object.entries(STORY_PARENTS)) {
  const epicKey = EPIC_MAP[epicName];
  const result = await api(`${BASE}/issue/${storyKey}`, "PUT", {
    fields: { parent: { key: epicKey } },
  });
  console.log(`   ${result !== null ? "✓" : "✗"} ${storyKey} → ${epicName} (${epicKey})`);
}

// ─── 3. Transition completed stories to Done (ID: 41) ───

const COMPLETED = [
  "SCRUM-14", // Property intelligence
  "SCRUM-15", // Use-case assessment
  "SCRUM-16", // Dialog scrolling fix
  "SCRUM-17", // Address autocomplete overflow
  "SCRUM-18", // AlertDialog INP fix
  "SCRUM-19", // Cost rate management
  "SCRUM-20", // Auth email redirect
  "SCRUM-21", // Mapbox geocode fix
  "SCRUM-22", // Coordinate input
  "SCRUM-23", // GitHub private
  "SCRUM-24", // GitHub collaborators
  "SCRUM-25", // Admin/user toggle
  "SCRUM-26", // Material/System selection
  "SCRUM-27", // Report versioning
  "SCRUM-28", // Dashboard onboarding
  "SCRUM-29", // Directory registration
  "SCRUM-30", // HubSpot sync
];

console.log("\n3. Transitioning completed stories to Done...");
for (const key of COMPLETED) {
  const result = await api(`${BASE}/issue/${key}/transitions`, "POST", {
    transition: { id: "41" },
  });
  console.log(`   ${result !== null ? "✓" : "✗"} ${key} → Done`);
}

// ─── 4. Delete empty Sprint 1 ───

console.log("\n4. Deleting empty Sprint 1...");
const result = await api(`${AGILE}/sprint/1`, "DELETE");
console.log(`   ${result ? "✓" : "✗"} Sprint 1 deleted`);

console.log("\n✓ Cleanup complete!");
console.log("  Board: https://corporateaisolutions-team.atlassian.net/jira/software/projects/SCRUM/boards/1");
