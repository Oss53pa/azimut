-- Rétablit la table des accès véhicule, vide.
--
-- Rien ne s'y reverse : aucune table du socle ne porte ce que celle-ci portait.

CREATE TABLE azimut.vehicle_gate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  code text NOT NULL,
  role text NOT NULL,
  width_m numeric NOT NULL,
  position jsonb NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_gate_width_positive CHECK (width_m > 0),
  CONSTRAINT vehicle_gate_source_not_blank CHECK (btrim(source) <> ''),
  CONSTRAINT vehicle_gate_status_known
    CHECK (status IN ('existant','proposition','a_verifier','retire'))
);

CREATE INDEX idx_vehicle_gate_org ON azimut.vehicle_gate (org_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.vehicle_gate
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- A6.1 — toute table portant `org_id` porte sa politique, et elle est forcée.
ALTER TABLE azimut.vehicle_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.vehicle_gate FORCE ROW LEVEL SECURITY;

CREATE POLICY vehicle_gate_org_policy ON azimut.vehicle_gate
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
