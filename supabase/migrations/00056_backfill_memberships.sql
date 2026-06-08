-- Migration 00056: Backfill organisation_members + user_active_org from profiles
-- (Phase 1). Idempotent (ON CONFLICT DO NOTHING) — safe to re-run.
-- Must run AFTER 00055 (members before active-org, due to the composite FK).

-- One membership per existing profile row, carrying its role + seat_type.
-- (profiles UNIQUE(org_id,user_id) already permits multiple rows per user, so a
-- user who is somehow in >1 org today gets a membership for each — correct.)
INSERT INTO organisation_members (user_id, org_id, role, seat_type, created_at)
SELECT p.user_id, p.org_id, p.role, p.seat_type, p.created_at
FROM profiles p
WHERE p.user_id IS NOT NULL
  AND p.org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Each user's current org becomes their active org. DISTINCT ON picks the
-- earliest profile if a user has more than one (all users have exactly one today).
INSERT INTO user_active_org (user_id, org_id)
SELECT DISTINCT ON (p.user_id) p.user_id, p.org_id
FROM profiles p
WHERE p.user_id IS NOT NULL
  AND p.org_id IS NOT NULL
ORDER BY p.user_id, p.created_at ASC
ON CONFLICT (user_id) DO NOTHING;

-- Sanity (advisory, not enforced): every active-org row should now be backed by
-- a membership row. The composite FK on user_active_org guarantees this.
