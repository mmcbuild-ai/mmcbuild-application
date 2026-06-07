-- Migration 00052: Move mis-homed user accounts off the SYSTEM org (SCRUM-230)
--
-- The all-zeros org (00000000-0000-0000-0000-000000000000) "MMC Build System"
-- is the intentional SYSTEM org: the shared-knowledge sentinel hardcoded in the
-- RAG retriever (include_system AND doc.org_id = '00000000-...') and as
-- SYSTEM_ORG_ID in knowledge ingestion. Two real user profiles
-- (dennis@corporateaisolutions.com = owner, rao.kar@gmail.com = admin) were
-- wrongly seeded under it, so every project / plan / cert they create lands
-- under the system org (the "uploaders writing under the all-zeros org" symptom
-- in SCRUM-230). The uploaders themselves already derive org_id from the
-- session profile — so this is a DATA fix: move those users + all their
-- user-owned, org-scoped rows to the real "MMC Build" org.
--
-- LEFT under the system org ON PURPOSE:
--   * knowledge_bases / knowledge_documents — the system NCC knowledge.
--   * subscriptions — the 'perpetual_admin_00000000...' seed sub (billing;
--     MMC Build has no sub row — handled separately, not in this migration).
--   * the organisations row itself — it stays the KB sentinel.
--
-- Idempotent: re-running is a no-op (no all-zeros user rows remain). Transaction
-- wrapped so it's all-or-nothing.

BEGIN;

DO $$
DECLARE
  sys_org  uuid := '00000000-0000-0000-0000-000000000000';
  real_org uuid := '71d9fefc-97ec-442c-b22c-eb01be1c5583'; -- "MMC Build"
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE id = real_org) THEN
    RAISE EXCEPTION 'Target org % does not exist — aborting', real_org;
  END IF;

  UPDATE profiles                SET org_id = real_org WHERE org_id = sys_org;
  UPDATE projects                SET org_id = real_org WHERE org_id = sys_org;
  UPDATE plans                   SET org_id = real_org WHERE org_id = sys_org;
  UPDATE project_site_intel      SET org_id = real_org WHERE org_id = sys_org;
  UPDATE questionnaire_responses SET org_id = real_org WHERE org_id = sys_org;
  UPDATE project_certifications  SET org_id = real_org WHERE org_id = sys_org;
  UPDATE project_contributors    SET org_id = real_org WHERE org_id = sys_org;
  UPDATE design_checks           SET org_id = real_org WHERE org_id = sys_org;
  UPDATE compliance_checks       SET org_id = real_org WHERE org_id = sys_org;
  UPDATE cost_estimates          SET org_id = real_org WHERE org_id = sys_org;
  UPDATE report_versions         SET org_id = real_org WHERE org_id = sys_org;
  UPDATE test_3d_jobs            SET org_id = real_org WHERE org_id = sys_org;
  UPDATE ai_usage_log            SET org_id = real_org WHERE org_id = sys_org;
  UPDATE beta_feedback           SET org_id = real_org WHERE org_id = sys_org;
  UPDATE enrollments             SET org_id = real_org WHERE org_id = sys_org;
  UPDATE professionals           SET org_id = real_org WHERE org_id = sys_org;
  UPDATE org_invitations         SET org_id = real_org WHERE org_id = sys_org;

  -- document_embeddings holds BOTH user (plan/certification) and potential
  -- system KB embeddings. Move ONLY the user-owned ones; leave KB-sourced
  -- embeddings (if any) under the system org.
  UPDATE document_embeddings     SET org_id = real_org
   WHERE org_id = sys_org AND source_type IN ('plan', 'certification');
END $$;

COMMIT;

-- Post-check (expect only knowledge_bases / knowledge_documents / subscriptions
-- to still reference the system org):
--   SELECT 'profiles' AS t, count(*) FROM profiles WHERE org_id = '00000000-0000-0000-0000-000000000000'
--   UNION ALL SELECT 'projects', count(*) FROM projects WHERE org_id = '00000000-0000-0000-0000-000000000000'
--   UNION ALL SELECT 'plans', count(*) FROM plans WHERE org_id = '00000000-0000-0000-0000-000000000000';
