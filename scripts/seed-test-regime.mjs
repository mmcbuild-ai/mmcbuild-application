#!/usr/bin/env node
/**
 * Seed test data to unblock the Test Regime v1.0 partial tests.
 * Idempotent — safe to re-run.
 *
 * Creates:
 *   1. Org "MMC QA Organisation" with trial dates set
 *   2. Org "MMC QA Trial Limit" with trial_usage_count=10 (triggers Bill-002 upgrade prompt)
 *   3. Five persona test users (builder, consultant, admin, trade + trial-limit builder)
 *   4. Three published professionals in separate orgs (for Direct-001/002/003)
 *   5. One published course with 3 lessons + quiz (for Train-001/002/003)
 *   6. One pre-seeded org rate override (for Quote-004 reference)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "QaTest!2026";

async function upsertOrg(name, opts = {}) {
  const { data: existing } = await sb.from("organisations").select("id, trial_usage_count").eq("name", name).maybeSingle();
  if (existing) {
    const { error } = await sb.from("organisations").update(opts).eq("id", existing.id);
    if (error) throw new Error(`update org ${name}: ${error.message}`);
    console.log(`  ↩ org "${name}" reused (id=${existing.id})`);
    return existing.id;
  }
  const { data, error } = await sb.from("organisations").insert({ name, ...opts }).select("id").single();
  if (error) throw new Error(`create org ${name}: ${error.message}`);
  console.log(`  ✓ org "${name}" created (id=${data.id})`);
  return data.id;
}

async function upsertUser(email, { fullName, orgId, role, persona }) {
  const { data: existingUsers } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = existingUsers?.users?.find(u => u.email === email);

  let userId;
  if (existingUser) {
    userId = existingUser.id;
    console.log(`  ↩ user "${email}" reused (id=${userId})`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, org_name: "MMC QA Organisation" },
    });
    if (error) throw new Error(`create user ${email}: ${error.message}`);
    userId = data.user.id;
    console.log(`  ✓ user "${email}" created (id=${userId})`);
  }

  // Upsert profile
  const { data: profile } = await sb.from("profiles").select("id, persona").eq("user_id", userId).maybeSingle();
  if (profile) {
    if (profile.persona !== persona || profile.role !== role) {
      await sb.from("profiles").update({ persona, role, org_id: orgId, full_name: fullName }).eq("id", profile.id);
      console.log(`     profile updated → persona=${persona} role=${role}`);
    }
    return { userId, profileId: profile.id };
  }
  const { data: created, error } = await sb.from("profiles").insert({
    user_id: userId, org_id: orgId, role, full_name: fullName, email, persona,
  }).select("id").single();
  if (error) throw new Error(`create profile ${email}: ${error.message}`);
  console.log(`     profile created → persona=${persona} role=${role}`);
  return { userId, profileId: created.id };
}

async function upsertProfessional(orgName, { companyName, tradeType, regions, insuranceVerified, status, description, headline, specialisations }) {
  const orgId = await upsertOrg(orgName, {});

  const { data: existing } = await sb.from("professionals").select("id").eq("org_id", orgId).maybeSingle();
  let professionalId;
  if (existing) {
    await sb.from("professionals").update({
      company_name: companyName, trade_type: tradeType, regions,
      insurance_verified: insuranceVerified, status, description, headline,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    }).eq("id", existing.id);
    professionalId = existing.id;
    console.log(`  ↩ professional "${companyName}" reused (id=${professionalId})`);
  } else {
    const { data, error } = await sb.from("professionals").insert({
      org_id: orgId, company_name: companyName, trade_type: tradeType,
      regions, insurance_verified: insuranceVerified, status,
      description, headline,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    }).select("id").single();
    if (error) throw new Error(`create professional ${companyName}: ${error.message}`);
    professionalId = data.id;
    console.log(`  ✓ professional "${companyName}" created (id=${professionalId})`);
  }

  // Specialisations
  for (const label of specialisations) {
    const { data: existingSpec } = await sb.from("professional_specialisations")
      .select("id").eq("professional_id", professionalId).eq("label", label).maybeSingle();
    if (!existingSpec) {
      await sb.from("professional_specialisations").insert({ professional_id: professionalId, label });
    }
  }
  return professionalId;
}

async function upsertCourse({ title, slug, description, category, difficulty, lessons, createdByProfileId, createdByOrgId }) {
  const { data: existing } = await sb.from("courses").select("id").eq("slug", slug).maybeSingle();
  let courseId;
  if (existing) {
    await sb.from("courses").update({
      title, description, category, difficulty, status: "published",
      estimated_duration_minutes: lessons.reduce((s, l) => s + (l.minutes ?? 5), 0),
      lesson_count: lessons.length,
    }).eq("id", existing.id);
    courseId = existing.id;
    console.log(`  ↩ course "${title}" reused (id=${courseId})`);
  } else {
    const { data, error } = await sb.from("courses").insert({
      title, slug, description, category, difficulty, status: "published",
      estimated_duration_minutes: lessons.reduce((s, l) => s + (l.minutes ?? 5), 0),
      lesson_count: lessons.length,
      created_by_profile_id: createdByProfileId,
      created_by_org_id: createdByOrgId,
    }).select("id").single();
    if (error) throw new Error(`create course ${title}: ${error.message}`);
    courseId = data.id;
    console.log(`  ✓ course "${title}" created (id=${courseId})`);
  }

  // Lessons — wipe + reinsert for determinism
  await sb.from("lessons").delete().eq("course_id", courseId);
  for (let i = 0; i < lessons.length; i++) {
    const L = lessons[i];
    await sb.from("lessons").insert({
      course_id: courseId, title: L.title, content: L.content,
      sort_order: i, quiz_questions: L.quiz ?? [],
      estimated_reading_minutes: L.minutes ?? 5,
    });
  }
  console.log(`     ${lessons.length} lessons seeded`);
  return courseId;
}

async function upsertRateOverride(orgId, createdBy, { category, element, state }) {
  const { data: existing } = await sb.from("org_rate_overrides")
    .select("id").eq("org_id", orgId).eq("category", category)
    .eq("element", element).eq("state", state).maybeSingle();
  if (existing) {
    console.log(`  ↩ rate override "${element}" reused`);
    return existing.id;
  }
  const { data, error } = await sb.from("org_rate_overrides").insert({
    org_id: orgId, created_by: createdBy,
    category, element, state,
    unit: "m²", base_rate: 999.99, year: 2026,
    notes: "Seeded for TC-QUOTE-004 reference — Karen should create her own during the test.",
    source_label: "QA Seed Override",
  }).select("id").single();
  if (error) throw new Error(`create rate override: ${error.message}`);
  console.log(`  ✓ rate override "${element}" created (id=${data.id})`);
  return data.id;
}

async function main() {
  console.log(`\nSeeding Test Regime data → ${SUPABASE_URL}\n${"=".repeat(60)}\n`);

  // ─── Orgs ────────────────────────────────────────────────────
  console.log("1. Organisations");
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();

  const qaOrgId = await upsertOrg("MMC QA Organisation", {
    trial_started_at: tenDaysAgo,
    trial_ends_at: thirtyDaysFromNow,
    trial_usage_count: 0,
  });
  const qaLimitOrgId = await upsertOrg("MMC QA Trial Limit", {
    trial_started_at: tenDaysAgo,
    trial_ends_at: thirtyDaysFromNow,
    trial_usage_count: 10,
  });

  // ─── Users ───────────────────────────────────────────────────
  console.log("\n2. Persona test users (password for all: " + PASSWORD + ")");
  const builderUser = await upsertUser("qa.builder@mmcbuild-test.com", {
    fullName: "QA Builder", orgId: qaOrgId, role: "owner", persona: "builder",
  });
  await upsertUser("qa.consultant@mmcbuild-test.com", {
    fullName: "QA Consultant", orgId: qaOrgId, role: "admin", persona: "consultant",
  });
  await upsertUser("qa.admin@mmcbuild-test.com", {
    fullName: "QA Admin", orgId: qaOrgId, role: "admin", persona: "admin",
  });
  await upsertUser("qa.trade@mmcbuild-test.com", {
    fullName: "QA Trade", orgId: qaOrgId, role: "admin", persona: "trade",
  });
  await upsertUser("qa.limit@mmcbuild-test.com", {
    fullName: "QA Trial Limit", orgId: qaLimitOrgId, role: "owner", persona: "builder",
  });

  // ─── Professionals ───────────────────────────────────────────
  console.log("\n3. Published professionals (Directory module)");
  await upsertProfessional("MMC Build Prefab Co.", {
    companyName: "MMC Build Prefab Co.",
    tradeType: "modular_manufacturer",
    regions: ["NSW", "VIC"],
    insuranceVerified: true,
    status: "approved",
    headline: "Leading modular home builder for NSW and VIC",
    description: "Specialists in modular residential construction using CLT and steel frame systems. Over 12 years serving builders across the east coast.",
    specialisations: ["Modular CLT", "Steel Frame", "Passive House Design"],
  });
  await upsertProfessional("ABC Prefab Solutions", {
    companyName: "ABC Prefab Solutions",
    tradeType: "prefab_supplier",
    regions: ["QLD"],
    insuranceVerified: false,
    status: "approved",
    headline: "Brisbane-based prefab specialists",
    description: "Supplying prefabricated wall and roof panels to QLD builders. Volumetric and panelised systems.",
    specialisations: ["Panelised Construction", "Volumetric Modules"],
  });
  await upsertProfessional("Steel Fabricators Pty", {
    companyName: "Steel Fabricators Pty",
    tradeType: "steel_fabricator",
    regions: ["NSW"],
    insuranceVerified: true,
    status: "pending",
    headline: "Structural steel fabrication — Sydney",
    description: "Custom structural steel frames for mid-rise residential and commercial.",
    specialisations: ["Hot-rolled Steel", "Cold-formed Framing"],
  });

  // ─── Course + lessons ────────────────────────────────────────
  console.log("\n4. Published course (Train module)");
  await upsertCourse({
    title: "MMC Fundamentals",
    slug: "mmc-fundamentals",
    description: "Introduction to Modern Methods of Construction for Australian residential builders. Covers CLT, modular, panelised, and hybrid systems, plus when each is appropriate.",
    category: "fundamentals",
    difficulty: "beginner",
    createdByProfileId: builderUser.profileId,
    createdByOrgId: qaOrgId,
    lessons: [
      {
        title: "What is MMC?",
        content: "Modern Methods of Construction encompass a range of off-site and hybrid building techniques that shift work from the site to a factory, improving speed, quality, and predictability.\n\nIn this lesson you'll learn the main categories of MMC and how they differ from traditional stick-build construction.",
        minutes: 5,
        quiz: [],
      },
      {
        title: "Categories of MMC systems",
        content: "MMC systems are typically grouped into seven categories:\n- Category 1: Pre-manufactured 3D primary structural systems (volumetric modules)\n- Category 2: Pre-manufactured 2D primary structural systems (panelised walls/roofs)\n- Category 3: Pre-manufactured components (beams, trusses, cassettes)\n- Category 4: Pre-manufactured non-structural assemblies\n- Category 5: Site-based process innovation\n- Category 6: Traditional site work with productivity enhancements\n- Category 7: Onsite installation of prefabricated services\n\nThis lesson explains each with Australian examples.",
        minutes: 10,
        quiz: [],
      },
      {
        title: "Choosing the right MMC system — quiz",
        content: "This final lesson quizzes you on when to apply each MMC category. Pass the quiz (80% or higher) to receive your MMC Fundamentals certificate.",
        minutes: 10,
        quiz: [
          {
            id: "q1",
            question: "Which MMC category describes volumetric modules built off-site and craned into place?",
            options: ["Category 1", "Category 2", "Category 3", "Category 5"],
            correct_index: 0,
          },
          {
            id: "q2",
            question: "Panelised wall and roof systems fall into which MMC category?",
            options: ["Category 1", "Category 2", "Category 4", "Category 6"],
            correct_index: 1,
          },
          {
            id: "q3",
            question: "True or false: MMC always reduces total project cost compared to traditional build.",
            options: ["True", "False"],
            correct_index: 1,
          },
        ],
      },
    ],
  });

  // ─── Rate override ───────────────────────────────────────────
  console.log("\n5. Cost rate override (Quote module reference)");
  await upsertRateOverride(qaOrgId, builderUser.profileId, {
    category: "framing",
    element: "QA SEED — timber wall frame reference",
    state: "NSW",
  });

  console.log(`\n${"=".repeat(60)}\n  ✅ Seed complete\n`);
  console.log(`  Test credentials (password: ${PASSWORD}):`);
  console.log(`    - qa.builder@mmcbuild-test.com     (Builder persona, owner)`);
  console.log(`    - qa.consultant@mmcbuild-test.com  (Consultant persona)`);
  console.log(`    - qa.admin@mmcbuild-test.com       (Admin persona — all modules)`);
  console.log(`    - qa.trade@mmcbuild-test.com       (Trade persona — Coming Soon state)`);
  console.log(`    - qa.limit@mmcbuild-test.com       (Builder, trial at 10/10 runs — Bill-002 test)\n`);
}
main().catch(e => { console.error("✗ " + e.message); process.exit(1); });
