-- A5.3 Circulation

CREATE TABLE azimut.node (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'entrance','junction','landing','elevator','stair',
    'escalator','emergency_exit','restroom','security_post',
    'information_point','destination_access'
  )),
  position jsonb NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.node
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_node_org ON azimut.node(org_id);
CREATE INDEX idx_node_level ON azimut.node(level_id);

CREATE TABLE azimut.edge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  width_m numeric NOT NULL,
  slope_pct numeric NOT NULL DEFAULT 0,
  accessible boolean NOT NULL DEFAULT true,
  direction text NOT NULL DEFAULT 'both' CHECK (direction IN ('both','forward','backward')),
  availability jsonb,
  evacuation_route boolean NOT NULL DEFAULT false,
  length_m numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_node_id <> to_node_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.edge
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_edge_org ON azimut.edge(org_id);
CREATE INDEX idx_edge_from ON azimut.edge(from_node_id);
CREATE INDEX idx_edge_to ON azimut.edge(to_node_id);

CREATE TABLE azimut.vertical_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  edge_id uuid NOT NULL REFERENCES azimut.edge(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('elevator','stair','escalator','ramp')),
  capacity integer NOT NULL DEFAULT 1,
  accessible boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_vertical_link_org ON azimut.vertical_link(org_id);

CREATE TABLE azimut.building_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  edge_id uuid NOT NULL REFERENCES azimut.edge(id) ON DELETE CASCADE,
  from_building_id uuid NOT NULL REFERENCES azimut.building(id) ON DELETE CASCADE,
  to_building_id uuid NOT NULL REFERENCES azimut.building(id) ON DELETE CASCADE,
  sheltered boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_building_link_org ON azimut.building_link(org_id);
