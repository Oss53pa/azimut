-- A5.2 Site et géométrie

CREATE TABLE azimut.site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_code text NOT NULL,
  rules_pack_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.site
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_site_org ON azimut.site(org_id);

CREATE TABLE azimut.building (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  name text NOT NULL,
  independent_access boolean NOT NULL DEFAULT false,
  opening_hours jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.building
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_building_org ON azimut.building(org_id);
CREATE INDEX idx_building_site ON azimut.building(site_id);

CREATE TABLE azimut.level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES azimut.building(id) ON DELETE CASCADE,
  name text NOT NULL,
  ordinal integer NOT NULL,
  elevation_m numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.level
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_level_org ON azimut.level(org_id);
CREATE INDEX idx_level_building ON azimut.level(building_id);

CREATE TABLE azimut.zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.zone
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_zone_org ON azimut.zone(org_id);

CREATE TABLE azimut.plan_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  media_type text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_source_org ON azimut.plan_source(org_id);

CREATE TABLE azimut.plan_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  plan_source_id uuid NOT NULL REFERENCES azimut.plan_source(id) ON DELETE CASCADE,
  scale_m_per_px numeric NOT NULL,
  origin_x numeric NOT NULL,
  origin_y numeric NOT NULL,
  rotation_deg numeric NOT NULL DEFAULT 0
);
CREATE INDEX idx_plan_calibration_org ON azimut.plan_calibration(org_id);

CREATE TABLE azimut.footprint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  geometry jsonb NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.footprint
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_footprint_org ON azimut.footprint(org_id);

CREATE TABLE azimut.volume (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  footprint_id uuid NOT NULL REFERENCES azimut.footprint(id) ON DELETE CASCADE,
  base_elevation_m numeric NOT NULL,
  height_m numeric NOT NULL CHECK (height_m > 0),
  material_key text NOT NULL
);
CREATE INDEX idx_volume_org ON azimut.volume(org_id);

CREATE TABLE azimut.opening (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  footprint_id uuid NOT NULL REFERENCES azimut.footprint(id) ON DELETE CASCADE,
  position jsonb NOT NULL,
  width_m numeric NOT NULL CHECK (width_m > 0),
  kind text NOT NULL
);
CREATE INDEX idx_opening_org ON azimut.opening(org_id);
