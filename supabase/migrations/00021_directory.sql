-- MMC Direct: Trade Directory schema
-- Enums
CREATE TYPE professional_status AS ENUM ('pending', 'approved', 'suspended');

CREATE TYPE trade_type AS ENUM (
  'builder', 'architect', 'structural_engineer', 'certifier',
  'electrician', 'plumber', 'carpenter', 'steel_fabricator',
  'clt_specialist', 'modular_manufacturer', 'prefab_supplier',
  'facade_specialist', 'sustainability_consultant', 'quantity_surveyor',
  'project_manager', 'interior_designer', 'landscaper', 'other'
);

CREATE TYPE australian_state AS ENUM (
  'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'
);

-- Professionals (one listing per org)
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  abn TEXT,
  trade_type trade_type NOT NULL DEFAULT 'other',
  headline TEXT,
  description TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  regions australian_state[] NOT NULL DEFAULT '{}',
  years_experience INTEGER,
  insurance_verified BOOLEAN NOT NULL DEFAULT false,
  licence_number TEXT,
  avg_rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  status professional_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fts TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(headline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED,
  UNIQUE(org_id)
);

-- Specialisation tags (MMC methods)
CREATE TABLE professional_specialisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(professional_id, label)
);

-- Portfolio items
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  image_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews (one per reviewer org per professional)
CREATE TABLE directory_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  reviewer_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(professional_id, reviewer_org_id)
);

-- Enquiries (lead messages)
CREATE TABLE directory_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  sender_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-update avg_rating and review_count on professionals
CREATE OR REPLACE FUNCTION update_professional_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE professionals SET
    avg_rating = COALESCE((
      SELECT AVG(rating)::NUMERIC(3,2) FROM directory_reviews
      WHERE professional_id = COALESCE(NEW.professional_id, OLD.professional_id)
    ), 0),
    review_count = (
      SELECT COUNT(*) FROM directory_reviews
      WHERE professional_id = COALESCE(NEW.professional_id, OLD.professional_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.professional_id, OLD.professional_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_professional_rating
AFTER INSERT OR UPDATE OR DELETE ON directory_reviews
FOR EACH ROW EXECUTE FUNCTION update_professional_rating();

-- Indexes
CREATE INDEX idx_professionals_status ON professionals(status);
CREATE INDEX idx_professionals_trade_type ON professionals(trade_type);
CREATE INDEX idx_professionals_org_id ON professionals(org_id);
CREATE INDEX idx_professionals_regions ON professionals USING GIN(regions);
CREATE INDEX idx_professionals_fts ON professionals USING GIN(fts);
CREATE INDEX idx_specialisations_professional ON professional_specialisations(professional_id);
CREATE INDEX idx_portfolio_professional ON portfolio_items(professional_id);
CREATE INDEX idx_reviews_professional ON directory_reviews(professional_id);
CREATE INDEX idx_enquiries_professional ON directory_enquiries(professional_id);
CREATE INDEX idx_enquiries_sender ON directory_enquiries(sender_org_id);

-- RLS
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_specialisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_enquiries ENABLE ROW LEVEL SECURITY;

-- Professionals: approved visible to all authed, own org full CRUD
CREATE POLICY "Approved professionals visible to all authed users"
  ON professionals FOR SELECT
  USING (status = 'approved' OR org_id = get_user_org_id());

CREATE POLICY "Org can insert own professional"
  ON professionals FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org can update own professional"
  ON professionals FOR UPDATE
  USING (org_id = get_user_org_id());

CREATE POLICY "Org can delete own professional"
  ON professionals FOR DELETE
  USING (org_id = get_user_org_id());

-- Specialisations: readable if professional is visible, writable by owner org
CREATE POLICY "Specialisations readable for visible professionals"
  ON professional_specialisations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = professional_specialisations.professional_id
      AND (p.status = 'approved' OR p.org_id = get_user_org_id())
  ));

CREATE POLICY "Org can manage own specialisations"
  ON professional_specialisations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = professional_specialisations.professional_id
      AND p.org_id = get_user_org_id()
  ));

CREATE POLICY "Org can update own specialisations"
  ON professional_specialisations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = professional_specialisations.professional_id
      AND p.org_id = get_user_org_id()
  ));

CREATE POLICY "Org can delete own specialisations"
  ON professional_specialisations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = professional_specialisations.professional_id
      AND p.org_id = get_user_org_id()
  ));

-- Portfolio: readable if professional is visible, writable by owner org
CREATE POLICY "Portfolio readable for visible professionals"
  ON portfolio_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = portfolio_items.professional_id
      AND (p.status = 'approved' OR p.org_id = get_user_org_id())
  ));

CREATE POLICY "Org can insert own portfolio items"
  ON portfolio_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = portfolio_items.professional_id
      AND p.org_id = get_user_org_id()
  ));

CREATE POLICY "Org can update own portfolio items"
  ON portfolio_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = portfolio_items.professional_id
      AND p.org_id = get_user_org_id()
  ));

CREATE POLICY "Org can delete own portfolio items"
  ON portfolio_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = portfolio_items.professional_id
      AND p.org_id = get_user_org_id()
  ));

-- Reviews: readable for visible professionals, writable by reviewer org (not own org)
CREATE POLICY "Reviews readable for visible professionals"
  ON directory_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = directory_reviews.professional_id
      AND (p.status = 'approved' OR p.org_id = get_user_org_id())
  ));

CREATE POLICY "Authed users can submit reviews"
  ON directory_reviews FOR INSERT
  WITH CHECK (reviewer_org_id = get_user_org_id());

CREATE POLICY "Reviewer can update own review"
  ON directory_reviews FOR UPDATE
  USING (reviewer_org_id = get_user_org_id());

CREATE POLICY "Reviewer can delete own review"
  ON directory_reviews FOR DELETE
  USING (reviewer_org_id = get_user_org_id());

-- Enquiries: readable by sender and recipient org
CREATE POLICY "Sender can view own enquiries"
  ON directory_enquiries FOR SELECT
  USING (sender_org_id = get_user_org_id());

CREATE POLICY "Recipient can view received enquiries"
  ON directory_enquiries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = directory_enquiries.professional_id
      AND p.org_id = get_user_org_id()
  ));

CREATE POLICY "Authed users can send enquiries"
  ON directory_enquiries FOR INSERT
  WITH CHECK (sender_org_id = get_user_org_id());

CREATE POLICY "Recipient can update enquiry status"
  ON directory_enquiries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = directory_enquiries.professional_id
      AND p.org_id = get_user_org_id()
  ));

-- Storage bucket for directory uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('directory-uploads', 'directory-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authed users can upload to own org prefix"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'directory-uploads'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Anyone can view directory uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'directory-uploads');
