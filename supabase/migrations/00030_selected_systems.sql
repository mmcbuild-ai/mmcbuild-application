-- Add construction system selection to projects
-- Stores user-selected MMC systems (SIPs, CLT, Steel Frame, etc.)
-- Used downstream by Comply (clause filtering), Quote (rate pre-population),
-- Directory (trade specialisation), and Training (course modules)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS selected_systems JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN projects.selected_systems IS 'User-selected construction systems for this project, e.g. ["sips","clt","steel_frame"]';
