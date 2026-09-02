-- A5.4 Destinations

CREATE TABLE azimut.category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  sector_key text NOT NULL,
  code text NOT NULL,
  parent_id uuid REFERENCES azimut.category(id) ON DELETE SET NULL
);
CREATE INDEX idx_category_org ON azimut.category(org_id);

CREATE TABLE azimut.pictogram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES azimut.category(id) ON DELETE CASCADE,
  source text NOT NULL,
  standard_ref text NOT NULL,
  svg_path text NOT NULL,
  registry text NOT NULL CHECK (registry IN ('safety','wayfinding'))
);
CREATE INDEX idx_pictogram_org ON azimut.pictogram(org_id);

CREATE TABLE azimut.destination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  footprint_id uuid NOT NULL REFERENCES azimut.footprint(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES azimut.category(id) ON DELETE CASCADE,
  occupant_name text NOT NULL DEFAULT '',
  occupancy_status text NOT NULL DEFAULT 'vacant'
    CHECK (occupancy_status IN ('occupied','vacant','reserved','under_fit_out')),
  display_priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.destination
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_destination_org ON azimut.destination(org_id);

CREATE TABLE azimut.destination_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES azimut.destination(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  value text NOT NULL,
  UNIQUE (destination_id, lang)
);
CREATE INDEX idx_destination_name_org ON azimut.destination_name(org_id);
