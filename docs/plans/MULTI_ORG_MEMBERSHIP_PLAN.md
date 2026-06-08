# Multi-Org Membership — Execution Plan

> **Status:** DESIGN (plan-eng-review, 2026-06-08). Not yet implemented.
> **Risk tier:** REGULATED. Live prod DB = `lztzyfeivpsbqbsfzctw`.
> **Goal:** one person can belong to MULTIPLE organisations with a DIFFERENT
> role/seat per org (e.g. owner of org A, beta tester of org B, user of org C).

## 1. Decisions locked (plan-eng-review)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| **D1** | Where the ACTIVE org lives (what `get_user_org_id()` reads) | **`user_active_org` table** | Instant org switch, no token-refresh races; `get_user_org_id()` stays a table lookup so the 135 existing policy refs need no change. |
| **D2** | How the 135 `profile.org_id` + 50 `profile.role` app reads behave | **Mirror on `profiles`** | `organisation_members` is source of truth; `profiles.org_id`/`role` become a synced mirror of the ACTIVE membership, so ~185 reads across 46 files don't change. Single writer + guard trigger prevents drift. |

## 2. Why this is a strangler-fig change, not a rewrite

The single-org model funnels through ONE function:

```
get_user_org_id()  =  SELECT org_id FROM profiles WHERE user_id = auth.uid()
        │
        ├── 135 RLS references  "org_id = get_user_org_id()"   ← UNCHANGED (now means "active org")
        └── ~18 role checks      "profiles ... role IN (owner,admin)"  ← REPOINT to organisation_members
```

Redefine that one function to return the **active** org and 135/161 policy refs
keep working. Only the ~18 role-gated write checks (7 migration files) move to
the membership table. App code reading `profile.org_id`/`role` is untouched
because those columns become the active-membership mirror (D2).

## 3. Target schema

```
auth.users (Supabase)
   │ 1:1
profiles                         ── person identity row
   ├── user_id  (FK auth.users)
   ├── org_id   ──► MIRROR of active membership's org   (kept synced, not source of truth)
   └── role     ──► MIRROR of active membership's role  (kept synced)
                                   ▲
                                   │ written ONLY by switch_active_org() (txn) + guard trigger
organisation_members  ── SOURCE OF TRUTH (NEW)
   ├── id
   ├── user_id   (FK auth.users)
   ├── org_id    (FK organisations)
   ├── role      (owner|admin|member|beta|external|viewer)
   ├── seat_type (internal|external|viewer|beta)
   ├── created_at / invited_by
   └── UNIQUE (user_id, org_id)          ── one membership row per (person, org)

user_active_org   ── which org is "current" (NEW)
   ├── user_id  (PK, FK auth.users)
   └── org_id   (FK organisations + must be a row in organisation_members)
```

Indexes: `organisation_members (user_id)`, `(org_id)`, unique `(user_id, org_id)`;
`user_active_org (user_id)` PK. RLS on both new tables (a user sees only their
own membership rows / active-org row; service role manages writes via actions).

## 4. RLS strategy

1. **Redefine `get_user_org_id()`** (SECURITY DEFINER, STABLE) to:
   ```sql
   SELECT org_id FROM user_active_org WHERE user_id = auth.uid() LIMIT 1
   ```
   Fallback: if no active-org row, return the user's first membership (or NULL).
   → 135 policy refs now scope to the active org automatically.

2. **Add `is_org_member(target_org uuid)` + `has_org_role(target_org uuid, roles text[])`**
   SECURITY DEFINER helpers reading `organisation_members`.

3. **Role-gated checks (~18, 7 files) need NO rewrite** (confirmed 2026-06-08).
   Because `profiles` is a single row that MIRRORS the active membership (D2) and
   every check is org-scoped, the inline
   `EXISTS (SELECT 1 FROM profiles WHERE user_id=auth.uid() AND org_id=<row org> AND role IN (...))`
   already evaluates against the user's ACTIVE org+role, and row visibility is
   pinned to the active org by `get_user_org_id()`. So they stay correct as-is
   (a user acts only in their active org — the intended "switch to act" UX).
   Repointing to `has_org_role()` is optional cleanup, not required — the helper
   ships in 00057 for any future policy that genuinely needs a cross-org role
   check. This is a direct payoff of the D2 active-mirror decision.

4. RLS stays ENABLED on every table throughout. No policy is dropped without a
   replacement in the same migration.

## 5. Migration sequence (expand → backfill → contract; idempotent, live-safe)

```
Phase 1  EXPAND (additive, zero behaviour change)
  00055  create organisation_members + user_active_org (+ RLS, indexes)
  00056  backfill: INSERT one membership per existing profile (role, seat from profiles);
         INSERT user_active_org = each user's current profiles.org_id
         (idempotent: ON CONFLICT DO NOTHING)
  00057  helpers: is_org_member(), has_org_role(); guard trigger keeping
         profiles.org_id/role in sync with user_active_org + membership

Phase 2  FLIP (switch the read source)
  00058  baseline seat_type 'beta' (repo<->live parity; no-op on live)
  00059  redefine get_user_org_id() to read user_active_org (COALESCE fallback
         to profiles) + profiles-mirror sync trigger
  (00060 role-check repoint => NOT REQUIRED, see note below; optional cleanup)

Phase 3  CONTRACT (later, optional)
  profiles.org_id/role stay as the active mirror (D2) — NOT dropped.
  (No contract step needed; the mirror is intentional.)
```

**Ledger-drift baselining (Phase 2, confirmed against live 2026-06-08).** The LIVE
`seat_type` enum is `{internal, external, viewer, beta}` and `user_role` is
`{owner, admin, project_manager, architect, builder, trade, viewer, beta}`, but the
repo migrations never recorded `ALTER TYPE seat_type ADD VALUE 'beta'` (manual,
unbaselined ledger). Phase 1 is unaffected (it backfills from profiles' own typed
columns), but Phase 2 must add a baselining migration:
`ALTER TYPE seat_type ADD VALUE IF NOT EXISTS 'beta';` so a from-repo rebuild
matches live (organisation_members.seat_type must accept `beta` for beta-tester
memberships).

Every migration: idempotent (`IF NOT EXISTS`, `ON CONFLICT`, `CREATE OR REPLACE`),
applied per the repo's CLI flow against `lztzyfeivpsbqbsfzctw` (verify linked ref
first — there are 3 live Supabase projects). Existing single-org users keep
working at every phase (their active org == their sole membership).

## 6. App-code change order (minimal surface)

1. **`switch_active_org(orgId)` server action** — validates membership, updates
   `user_active_org` + the `profiles` mirror in one transaction, `revalidatePath`.
2. **Org switcher UI** in the authenticated chrome (sidebar) — lists the user's
   memberships, shows active, calls the switch action. Hidden when membership count = 1.
3. **accept-on-login rework** (`src/app/(auth)/auth/callback/route.ts`) — on a
   pending invite, INSERT an `organisation_members` row (idempotent) instead of
   inserting a second `profiles` row (the current collision). Create profile only
   if the user has none.
4. **invite flow** (`settings/organisation/actions.ts`) — allow inviting a user who
   already has an account: the invite now resolves to a NEW membership on accept,
   so the `email_exists` short-circuit added in PR #22 is replaced by "send the
   invite, they'll gain the membership on accept."
5. Everything reading `profile.org_id`/`role` stays as-is (mirror).

## 7. Out of scope / deferred

- **Directory one-listing-per-org (SCRUM-238)** — `getMyProfessional` keyed by
  `org_id` is orthogonal; revisit after core multi-org lands.
- **JWT-claim active org** — rejected (D1); table chosen for instant switch.
- **Dropping profiles.org_id/role** — rejected (D2); kept as the active mirror.
- **Per-project membership** (`project_members` already exists) — unchanged.

## 8. Test plan (targets full coverage on the new paths)

- Unit: `is_org_member` / `has_org_role` true/false; `switch_active_org` rejects a
  non-member org; mirror trigger keeps profiles in sync; backfill idempotency.
- RLS: a user in orgs A+B sees only the active org's rows; switching flips
  visibility; cannot set active org to a non-membership; role gates honour the
  per-org role (admin in A, viewer in B).
- Integration: accept-on-login adds a membership for an existing user (no profile
  collision); invite to an existing user succeeds end-to-end.
- Regression: a single-org user's experience is byte-for-byte unchanged.

## 9. Rollback

Phase 1 is purely additive (drop the two tables to revert). Phase 2 flip is one
function + ~18 policy expressions — keep the prior definitions in the migration
comments so a single `CREATE OR REPLACE` reverts `get_user_org_id()` to the
profiles read. No data loss path (memberships are a superset of profiles).

## 10. Open decisions (defaults chosen, confirm before build)

- **OD1** On accepting an invite to a 2nd org, auto-switch active org to it? Default: **no** (stay on current, surface "you've joined X — switch?").
- **OD2** Seat-cap accounting (`getOrgSeatUsage`) under multi-org — count memberships per org (not profiles). Default: **yes**, fold into Phase 2.
- **OD3** Owner-of-last-resort: prevent removing the final owner membership of an org. Default: **yes**, add a guard.

---
_Generated by plan-eng-review (D1+D2 locked). Next: confirm OD1–OD3, then implement Phase 1._
