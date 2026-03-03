-- Cost Estimation tables for MMC Quote (Stage 4)

-- Enum
CREATE TYPE cost_estimate_status AS ENUM ('queued', 'processing', 'completed', 'error');
CREATE TYPE cost_line_source AS ENUM ('ai_estimated', 'reference', 'user_override');

-- cost_estimates — mirrors design_checks / compliance_checks
CREATE TABLE cost_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  status cost_estimate_status NOT NULL DEFAULT 'queued',
  summary TEXT,
  total_traditional NUMERIC,
  total_mmc NUMERIC,
  total_savings_pct NUMERIC,
  region TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_estimates_project ON cost_estimates(project_id);
CREATE INDEX idx_cost_estimates_org ON cost_estimates(org_id);
CREATE INDEX idx_cost_estimates_status ON cost_estimates(status);

ALTER TABLE cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org cost estimates"
  ON cost_estimates FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can insert own org cost estimates"
  ON cost_estimates FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Users can update own org cost estimates"
  ON cost_estimates FOR UPDATE
  USING (org_id = get_user_org_id());

-- cost_line_items — individual costed elements
CREATE TABLE cost_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES cost_estimates(id) ON DELETE CASCADE,
  cost_category TEXT NOT NULL,
  element_description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  traditional_rate NUMERIC,
  traditional_total NUMERIC,
  mmc_rate NUMERIC,
  mmc_total NUMERIC,
  mmc_alternative TEXT,
  savings_pct NUMERIC,
  source cost_line_source NOT NULL DEFAULT 'ai_estimated',
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_line_items_estimate ON cost_line_items(estimate_id);

ALTER TABLE cost_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org cost line items"
  ON cost_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cost_estimates ce
      WHERE ce.id = cost_line_items.estimate_id
        AND ce.org_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can insert own org cost line items"
  ON cost_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cost_estimates ce
      WHERE ce.id = cost_line_items.estimate_id
        AND ce.org_id = get_user_org_id()
    )
  );

-- cost_reference_rates — seed data for rate lookups
CREATE TABLE cost_reference_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  element TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_rate NUMERIC NOT NULL,
  state TEXT NOT NULL DEFAULT 'NSW',
  year INTEGER NOT NULL DEFAULT 2025,
  source TEXT NOT NULL DEFAULT 'market',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_reference_rates_category ON cost_reference_rates(category);
CREATE INDEX idx_cost_reference_rates_state ON cost_reference_rates(state);

-- Reference rates are shared across all orgs (no RLS needed)
-- Seed with Australian residential construction base rates

INSERT INTO cost_reference_rates (category, element, unit, base_rate, state, year, source) VALUES
-- Preliminaries
('preliminaries', 'Site establishment & temporary facilities', 'lump_sum', 15000, 'NSW', 2025, 'market'),
('preliminaries', 'Project management & supervision', 'percent_of_total', 8, 'NSW', 2025, 'market'),
('preliminaries', 'Insurance & permits', 'lump_sum', 8000, 'NSW', 2025, 'market'),
('preliminaries', 'Scaffolding', 'sqm', 35, 'NSW', 2025, 'market'),
('preliminaries', 'Waste management & skip bins', 'lump_sum', 5000, 'NSW', 2025, 'market'),

-- Substructure
('substructure', 'Strip footing (standard)', 'lm', 180, 'NSW', 2025, 'market'),
('substructure', 'Concrete slab on ground (standard)', 'sqm', 120, 'NSW', 2025, 'market'),
('substructure', 'Concrete slab on ground (waffle pod)', 'sqm', 140, 'NSW', 2025, 'market'),
('substructure', 'Pier and beam foundation', 'each', 450, 'NSW', 2025, 'market'),
('substructure', 'Excavation (standard soil)', 'cum', 65, 'NSW', 2025, 'market'),
('substructure', 'Retaining wall (concrete block)', 'sqm', 350, 'NSW', 2025, 'market'),

-- Frame
('frame', 'Timber wall frame supply & erect', 'sqm_wall', 85, 'NSW', 2025, 'market'),
('frame', 'Steel wall frame supply & erect', 'sqm_wall', 110, 'NSW', 2025, 'market'),
('frame', 'Timber roof truss supply & erect', 'sqm_roof', 65, 'NSW', 2025, 'market'),
('frame', 'SIP panel wall (installed)', 'sqm_wall', 250, 'NSW', 2025, 'market'),
('frame', 'Prefabricated wall panel (timber)', 'sqm_wall', 180, 'NSW', 2025, 'market'),
('frame', 'CLT wall panel (installed)', 'sqm_wall', 350, 'NSW', 2025, 'market'),
('frame', 'Light gauge steel frame', 'sqm_wall', 120, 'NSW', 2025, 'market'),

-- Roof
('roof', 'Concrete roof tiles (installed)', 'sqm', 65, 'NSW', 2025, 'market'),
('roof', 'Metal roofing Colorbond (installed)', 'sqm', 55, 'NSW', 2025, 'market'),
('roof', 'Roof insulation batts R4.0', 'sqm', 18, 'NSW', 2025, 'market'),
('roof', 'Fascia and gutter (Colorbond)', 'lm', 45, 'NSW', 2025, 'market'),
('roof', 'Roof sarking', 'sqm', 8, 'NSW', 2025, 'market'),

-- External walls
('external_walls', 'Brick veneer (standard)', 'sqm', 180, 'NSW', 2025, 'market'),
('external_walls', 'Fibre cement cladding (installed)', 'sqm', 120, 'NSW', 2025, 'market'),
('external_walls', 'Weatherboard cladding (installed)', 'sqm', 140, 'NSW', 2025, 'market'),
('external_walls', 'Render on block', 'sqm', 160, 'NSW', 2025, 'market'),
('external_walls', 'Wall insulation batts R2.5', 'sqm', 14, 'NSW', 2025, 'market'),

-- Windows & external doors
('windows_doors', 'Aluminium sliding window (standard)', 'sqm', 450, 'NSW', 2025, 'market'),
('windows_doors', 'Aluminium awning window', 'sqm', 500, 'NSW', 2025, 'market'),
('windows_doors', 'Timber entry door (solid core)', 'each', 1200, 'NSW', 2025, 'market'),
('windows_doors', 'Aluminium sliding door', 'sqm', 550, 'NSW', 2025, 'market'),
('windows_doors', 'Double glazed window upgrade', 'sqm', 650, 'NSW', 2025, 'market'),

-- Internal walls
('internal_walls', 'Plasterboard on timber stud', 'sqm', 65, 'NSW', 2025, 'market'),
('internal_walls', 'Plasterboard on steel stud', 'sqm', 75, 'NSW', 2025, 'market'),
('internal_walls', 'Wet area plasterboard', 'sqm', 80, 'NSW', 2025, 'market'),

-- Internal doors
('internal_doors', 'Hollow core internal door (installed)', 'each', 350, 'NSW', 2025, 'market'),
('internal_doors', 'Solid core internal door (installed)', 'each', 550, 'NSW', 2025, 'market'),
('internal_doors', 'Cavity slider door (installed)', 'each', 750, 'NSW', 2025, 'market'),

-- Finishes
('wall_finishes', 'Internal painting (2 coats)', 'sqm', 22, 'NSW', 2025, 'market'),
('wall_finishes', 'Wet area wall tiling', 'sqm', 95, 'NSW', 2025, 'market'),
('floor_finishes', 'Ceramic floor tiles (installed)', 'sqm', 85, 'NSW', 2025, 'market'),
('floor_finishes', 'Timber flooring (engineered, installed)', 'sqm', 110, 'NSW', 2025, 'market'),
('floor_finishes', 'Carpet (mid-range, installed)', 'sqm', 55, 'NSW', 2025, 'market'),
('ceiling_finishes', 'Plasterboard ceiling (installed)', 'sqm', 45, 'NSW', 2025, 'market'),
('ceiling_finishes', 'Cornice (installed)', 'lm', 12, 'NSW', 2025, 'market'),

-- Fitments
('fitments', 'Kitchen cabinetry (mid-range)', 'lm', 1200, 'NSW', 2025, 'market'),
('fitments', 'Bathroom vanity (standard)', 'each', 800, 'NSW', 2025, 'market'),
('fitments', 'Built-in wardrobe (per robe)', 'each', 1500, 'NSW', 2025, 'market'),
('fitments', 'Laundry cabinetry', 'lm', 600, 'NSW', 2025, 'market'),

-- Plumbing
('plumbing', 'Rough-in plumbing (per fixture point)', 'each', 850, 'NSW', 2025, 'market'),
('plumbing', 'Hot water system (electric heat pump)', 'each', 3500, 'NSW', 2025, 'market'),
('plumbing', 'Hot water system (gas instantaneous)', 'each', 2200, 'NSW', 2025, 'market'),
('plumbing', 'Stormwater drainage', 'lm', 85, 'NSW', 2025, 'market'),
('plumbing', 'Sewer connection', 'lump_sum', 5000, 'NSW', 2025, 'market'),
('plumbing', 'Prefabricated bathroom pod (complete)', 'each', 18000, 'NSW', 2025, 'market'),

-- Electrical
('electrical', 'Electrical rough-in (per point)', 'each', 120, 'NSW', 2025, 'market'),
('electrical', 'Switchboard (standard residential)', 'each', 2500, 'NSW', 2025, 'market'),
('electrical', 'LED downlight (supplied & installed)', 'each', 85, 'NSW', 2025, 'market'),
('electrical', 'Solar PV system (6.6kW)', 'each', 7500, 'NSW', 2025, 'market'),
('electrical', 'Data/communications cabling', 'each', 150, 'NSW', 2025, 'market'),

-- Mechanical
('mechanical', 'Split system AC (per unit)', 'each', 2200, 'NSW', 2025, 'market'),
('mechanical', 'Ducted AC system', 'sqm', 65, 'NSW', 2025, 'market'),
('mechanical', 'Bathroom exhaust fan (installed)', 'each', 350, 'NSW', 2025, 'market'),

-- Fire services
('fire_services', 'Smoke alarm (interconnected)', 'each', 180, 'NSW', 2025, 'market'),

-- External works
('external_works', 'Concrete driveway', 'sqm', 85, 'NSW', 2025, 'market'),
('external_works', 'Concrete pathways', 'sqm', 75, 'NSW', 2025, 'market'),
('external_works', 'Timber fencing (1.8m)', 'lm', 120, 'NSW', 2025, 'market'),
('external_works', 'Colorbond fencing (1.8m)', 'lm', 95, 'NSW', 2025, 'market'),
('external_works', 'Basic landscaping', 'sqm', 45, 'NSW', 2025, 'market'),
('external_works', 'Turf (supplied & laid)', 'sqm', 18, 'NSW', 2025, 'market');
