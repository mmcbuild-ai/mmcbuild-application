#!/usr/bin/env node
/**
 * Read-only: inspect a design_checks row to see why the 3D viewer didn't render.
 *
 * Usage:
 *   node scripts/diag-design-check.mjs <reportId>
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const reportId = process.argv[2];
if (!reportId) {
  console.error("Usage: node scripts/diag-design-check.mjs <reportId>");
  process.exit(1);
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

const rows = await sb(
  `design_checks?id=eq.${reportId}&select=id,project_id,plan_id,org_id,status,summary,completed_at,created_at,spatial_layout`
);
if (!rows.length) {
  console.error("No design_checks row found for", reportId);
  process.exit(1);
}
const r = rows[0];
const layoutKb = r.spatial_layout
  ? Math.round(JSON.stringify(r.spatial_layout).length / 1024)
  : null;
const summarised = {
  id: r.id,
  project_id: r.project_id,
  plan_id: r.plan_id,
  status: r.status,
  created_at: r.created_at,
  completed_at: r.completed_at,
  spatial_layout_present: r.spatial_layout != null,
  spatial_layout_kb: layoutKb,
  summary_excerpt: (r.summary ?? "").slice(0, 200),
};
console.log("design_checks row:");
console.log(JSON.stringify(summarised, null, 2));

if (r.plan_id) {
  const plans = await sb(
    `plans?id=eq.${r.plan_id}&select=id,file_path,file_name,status,page_count,created_at`
  );
  console.log("\nplans row:");
  console.log(JSON.stringify(plans[0] ?? null, null, 2));
}

if (r.spatial_layout) {
  const sl = r.spatial_layout;
  console.log("\nspatial_layout summary:");
  console.log(
    JSON.stringify(
      {
        rooms: sl.rooms?.length ?? 0,
        walls: sl.walls?.length ?? 0,
        openings: sl.openings?.length ?? 0,
        storeys: sl.storeys,
        confidence: sl.confidence,
        bounds: sl.bounds,
      },
      null,
      2
    )
  );
}
