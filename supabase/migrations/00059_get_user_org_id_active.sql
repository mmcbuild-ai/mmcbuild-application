-- Migration 00059: Flip get_user_org_id() to the ACTIVE org + profiles mirror sync (Phase 2).
-- See docs/plans/MULTI_ORG_MEMBERSHIP_PLAN.md (D1 + D2).
--
-- BEHAVIOUR-PRESERVING for every current user: Phase 1 backfilled
-- user_active_org.org_id = profiles.org_id for all 19 users, so the COALESCE
-- below returns the same value it did before. The profiles fallback also keeps
-- any user WITHOUT a user_active_org row (e.g. a brand-new signup created before
-- the signup flow seeds one) fully working. Idempotent (CREATE OR REPLACE).

-- 1. get_user_org_id() now reads the active org, falling back to the profile org.
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT org_id FROM user_active_org WHERE user_id = auth.uid()),
    (SELECT org_id FROM profiles        WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

-- 2. Keep profiles.org_id/role/seat_type a MIRROR of the active membership (D2),
--    so the ~185 app reads of profile.org_id/role transparently mean "active".
--    Single writer: this trigger, firing when the active org row changes.
--    Dormant for existing users until something switches their active org.
CREATE OR REPLACE FUNCTION sync_profile_to_active_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role user_role;
  v_seat seat_type;
BEGIN
  SELECT role, seat_type
    INTO v_role, v_seat
  FROM organisation_members
  WHERE user_id = NEW.user_id AND org_id = NEW.org_id;

  UPDATE profiles
  SET org_id     = NEW.org_id,
      role       = COALESCE(v_role, role),
      seat_type  = COALESCE(v_seat, seat_type),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_active_org ON user_active_org;
CREATE TRIGGER trg_sync_active_org
  AFTER INSERT OR UPDATE OF org_id ON user_active_org
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_to_active_org();
