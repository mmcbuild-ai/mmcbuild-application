-- Public directory listing submissions (no auth required)
-- Separate from the auth-based `professionals` table.
-- These are unauthenticated public submissions that go through admin approval.

CREATE TABLE directory_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  abn TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  location TEXT,
  service_area TEXT[] DEFAULT '{}',
  licences_held TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'info_requested')),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: public can only see published listings
ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_can_view_published_listings"
  ON directory_listings FOR SELECT
  USING (status = 'published');

CREATE POLICY "public_can_insert_listings"
  ON directory_listings FOR INSERT
  WITH CHECK (true);

-- Admins can do everything (via service role / admin client)
-- No user-scoped update/delete policies needed — admin actions use service role

CREATE INDEX idx_directory_listings_status ON directory_listings (status);
CREATE INDEX idx_directory_listings_created ON directory_listings (created_at DESC);

COMMENT ON TABLE directory_listings IS 'Public directory listing submissions — unauthenticated, admin-approved';
