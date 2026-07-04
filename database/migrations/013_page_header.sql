-- Migration: project page header metadata (cover image + header settings). Apply after 012.
-- Idempotent. `config` JSONB remains the single block-document / dashboard state;
-- these columns only cover page presentation. cover_image_url stores either an
-- image URL or a preset token like "gradient:aurora". header_settings is
-- frontend-owned, e.g. {"full_width": true, "cover_position": 50}.

ALTER TABLE project_pages ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE project_pages ADD COLUMN IF NOT EXISTS header_settings JSONB NOT NULL DEFAULT '{}';
