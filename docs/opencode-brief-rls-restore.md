# OpenCode Brief — Restore RLS Policies Lost in Supabase Migration (mmcbuild-prod)

**Severity:** production beta blocker + tenant-isolation risk.
**Repo:** `mmcbuild-ai/mmcbuild-application` · PR only, no merge (Dennis is the gate).
**Target DB:** `mmcbuild-prod` (`lztzyfeivpsbqbsfzctw`).

---

## STATUS (updated — read first)

**DONE (applied directly to prod):**
- ✅ All 12 storage buckets now have strict org-scoped RLS policies (4 each = 48 total), cloned from the verified `plan-uploads` pattern (`get_user_org_id()` + `profiles.user_id`/role gate). `plan-uploads` fixed first; the other 11 applied via `storage-policies-remaining-11-buckets.sql`.
- ✅ Plan upload + processing verified working end to end (storage RLS, Inngest keys, AI key all fixed).

**OUTSTANDING (this brief's remaining scope):**
1. **Zero-org uploader bug (app code)** — see TASK D. Confirmed on test-3d harness AND engineering-certs uploader: they write under the all-zeros org, so they still fail the new org-scoped policies. Storage policy is correct; the app sends the wrong path.
2. **5 RLS-locked tables still policy-less** — `marketplace_estimate_tokens`, `trust_audit_log`, `trust_metering_events`, `trust_permission_policies`, `trust_rate_limits`. NOT yet done (deliberately — these encode a permissions/metering model that must be recovered from `00046`/`00047`, not guessed). See TASK A/B/C, now scoped to these tables only.
3. **directory/training read scope** — applied as strict org-scoped (fail-closed). Cross-org/public read for directory listings + shared training content to be loosened later as a deliberate decision.
4. **Migration ledger** — still absent. See TASK E.

---

## Confirmed root cause (do not re-litigate — this is established)

The Supabase migration into `mmcbuild-prod` moved **tables and data but not all RLS policies**, and the project has **no migration ledger** (`supabase_migrations.schema_migrations` does not exist — the DB was populated outside the CLI migration flow).

Confirmed state on prod:
- `storage.objects`: RLS **on**, **zero** policies → all 12 buckets silently deny uploads.
- `public` tables with RLS on + zero policies: `marketplace_estimate_tokens`, `trust_audit_log`, `trust_metering_events`, `trust_permission_policies`, `trust_rate_limits` (from migrations 00046, 00047).
- Core tables (`plans`, `projects`, etc.) **kept** their policies — verified working, using `get_user_org_id()` + `profiles.user_id = auth.uid()`.
- `get_user_org_id()` is correct: `SELECT org_id FROM profiles WHERE user_id = auth.uid() LIMIT 1` (STABLE SECURITY DEFINER).

The 12 storage buckets: `reports, rd-evidence, supplier-data, training-content, site-data, kb-uploads, remediation-uploads, engineering-certs, directory-uploads, training-certs, test-screenshots, plan-uploads`.

## Hard guardrails

- **Never disable RLS** to "fix" a denial. That breaks tenant isolation on a live multi-tenant beta. Restore policies only.
- **Do not invent policies from a generic template.** Each bucket/table has its own intended access model. Recover the real DDL from the repo migrations; only then reconcile.
- Apply against prod as **one reviewed script**; Dennis reviews before it runs.
- Project is in **quota grace until 27 Jun** — keep changes surgical.

---

## TASK A — Recover the 5 tables' policy DDL from the repo (storage buckets are DONE)

Storage buckets are already policied — do NOT re-do them. This task is now scoped to the 5 RLS-locked tables only.

1. Read `00046_marketplace_estimates.sql` for the policies on `marketplace_estimate_tokens`.
2. Read `00047_platform_trust_self_contained.sql` for the policies on `trust_audit_log`, `trust_metering_events`, `trust_permission_policies`, `trust_rate_limits`.
3. These are NOT plain org-scoped user data — they're a permissions/metering/rate-limit engine. Capture the intended access model exactly as the migrations define it (some may be service-role-only, some org-scoped, some read-only to clients). Do NOT clone the storage bucket pattern onto them blindly.

## TASK B — Reconcile against the live schema

- Confirm any policy keys on `profiles.user_id = auth.uid()` (NOT `profiles.id`) and uses `get_user_org_id()` where org-scoping applies.
- For trust tables: if a table is only ever written by server/service-role code, the correct policy may be "no client access" (RLS on, policies only for service role) rather than an org policy. Verify intent from `00047` before writing anything.

## TASK C — Apply the 5-table policies + verify

1. Output one idempotent script (DROP POLICY IF EXISTS + CREATE) for the 5 tables only.
2. After apply, verify NO public table remains RLS-on-with-no-policy:
   ```sql
   select c.relname, count(p.policyname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
   where n.nspname='public' and c.relkind='relation'
   group by 1 having c.relrowsecurity and count(p.policyname)=0;
   ```
   Expect zero rows.
3. Storage verify (should already pass): `select count(*) from pg_policies where schemaname='storage' and tablename='objects';` → expect 48.

## TASK D — Fix uploaders that write under the all-zeros org (NOT just the harness)

Multiple uploaders build storage paths under the all-zeros seed org (`00000000-0000-0000-0000-000000000000`) instead of the signed-in user's real org. Confirmed on at least two surfaces:
- the **test-3d harness** (`/build/test-3d`), and
- the **Engineering Certifications** uploader on the project page (observed POST to `engineering-certs/00000000-0000-.../<project_id>/...` → 400 RLS reject, while the user's real org is `71d9fefc-...`).

These fail org-scoped RLS by design, and applying the bucket policy will NOT fix them — the path's first folder must equal the user's real org. Fix the **client/server upload code** to derive the org from the authenticated session (the same source `get_user_org_id()` uses) for every uploader. Grep for the zero UUID and for hardcoded/defaulted org ids across all upload paths (plans, certs, kb, reports, etc.). Do NOT add a zero-org exception to any bucket policy.

## TASK E — Baseline the migration ledger

The project has no `supabase_migrations.schema_migrations`. Establish migration tracking (baseline/repair) so future migrations apply through the CLI and silent policy gaps stop recurring. Document how prod should receive migrations going forward (it currently does not go through `db push`).

## Also check (quick, non-blocking)

- Duplicate profiles: `select user_id, count(*) from profiles group by 1 having count(*)>1;` — `get_user_org_id()`'s `LIMIT 1` picks arbitrarily if any user has two profile rows. The migration left duplicate orgs ("MMC"/"MMC Build"); check for duplicate profiles too.

## Report back

Per bucket/table: policy recovered (from which migration) · applied (Y/N) · verified. One PR; no merge.
