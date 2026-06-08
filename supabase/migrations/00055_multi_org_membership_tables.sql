-- Migration 00055: Multi-org membership — additive tables (Phase 1 EXPAND)
-- See docs/plans/MULTI_ORG_MEMBERSHIP_PLAN.md.
-- ZERO behaviour change: these tables are created + RLS-enabled but are NOT yet
-- read by get_user_org_id() or any policy (that flip is Phase 2 / 00058-00059).
-- Idempotent: safe to re-run.

-- ============================================================
-- organisation_members — SOURCE OF TRUTH for (person, org, role, seat)
-- A person may have one row per org → multi-org membership.
-- ============================================================
CREATE TABLE IF NOT EXISTS organisation_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'viewer',
  seat_type   seat_type NOT NULL DEFAULT 'internal',
  invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organisation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON organisation_members(org_id);

ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

-- A user can see their own membership rows, plus co-members of their ACTIVE org
-- (so member lists work once the UI consumes this table). get_user_org_id() is
-- unchanged in Phase 1 (still the single-org read), so this is equivalent to the
-- user's only org today.
DROP POLICY IF EXISTS "org_members_select" ON organisation_members;
CREATE POLICY "org_members_select" ON organisation_members
  FOR SELECT USING (
    user_id = auth.uid() OR org_id = get_user_org_id()
  );

-- Membership writes happen server-side via the service-role client (which
-- bypasses RLS). These explicit policies also let owners/admins of the target
-- org manage members directly, and fail closed otherwise.
DROP POLICY IF EXISTS "org_members_write" ON organisation_members;
CREATE POLICY "org_members_write" ON organisation_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.org_id = organisation_members.org_id
        AND p.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.org_id = organisation_members.org_id
        AND p.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- user_active_org — which org is "current" for a (multi-org) user (D1)
-- The active org MUST be an org the user is a member of (composite FK).
-- ============================================================
CREATE TABLE IF NOT EXISTS user_active_org (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_active_org_is_member
    FOREIGN KEY (user_id, org_id)
    REFERENCES organisation_members (user_id, org_id) ON DELETE CASCADE
);

ALTER TABLE user_active_org ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_active_org_rw" ON user_active_org;
CREATE POLICY "user_active_org_rw" ON user_active_org
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
