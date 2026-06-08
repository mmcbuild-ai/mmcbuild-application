-- Migration 00057: Membership helper functions (Phase 1).
-- Additive + read-only. These are NOT yet referenced by any policy — the role
-- checks repoint to has_org_role() in Phase 2 (00059). Defining them now keeps
-- Phase 2 a pure search-and-replace. Idempotent (CREATE OR REPLACE).
--
-- The profiles.org_id/role MIRROR sync trigger (D2) is deliberately deferred to
-- Phase 2, when org-switching ships — in Phase 1 nothing changes a user's active
-- org, so there is nothing to mirror yet and behaviour stays identical.

-- is_org_member: is the current user a member of target_org?
CREATE OR REPLACE FUNCTION is_org_member(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE user_id = auth.uid() AND org_id = target_org
  );
$$;

-- has_org_role: does the current user hold one of `roles` in target_org?
-- Behaviour-preserving replacement for the inline
--   EXISTS (SELECT 1 FROM profiles WHERE user_id=auth.uid() AND org_id=? AND role IN (...))
-- checks, but per-org (correct once a user belongs to several orgs).
CREATE OR REPLACE FUNCTION has_org_role(target_org UUID, roles user_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE user_id = auth.uid()
      AND org_id = target_org
      AND role = ANY(roles)
  );
$$;
