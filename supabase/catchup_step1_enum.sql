-- STEP 1: Run this FIRST, by itself
-- Adds project_manager to user_role enum
-- (ALTER TYPE ... ADD VALUE cannot run inside a transaction block)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_manager' AFTER 'admin';
