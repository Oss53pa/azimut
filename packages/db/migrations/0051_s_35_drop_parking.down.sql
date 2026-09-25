-- Rétablit la table des parkings, d'avant la section S8.
--
-- La table revient vide. Les zones de nature `parking` et les faits ciblés qui
-- l'ont remplacée ne s'y reversent pas : une liste d'empreintes ne redonne pas
-- un polygone d'emprise, et rien ne dit lequel des deux faits porte le statut
-- du parking.
--
-- Doit être jouée avant le retour de 0050, qui recrée une table pendant à
-- celle-ci.

CREATE TABLE azimut.parking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  geometry jsonb NOT NULL,
  name text NOT NULL,
  free boolean NOT NULL,
  declared_capacity integer NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT parking_source_not_blank CHECK (btrim(source) <> ''),
  CONSTRAINT parking_capacity_non_negative CHECK (declared_capacity >= 0),
  CONSTRAINT parking_status_known
    CHECK (status IN ('existant','proposition','a_verifier','retire'))
);

CREATE INDEX idx_parking_org ON azimut.parking (org_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.parking
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- A6.1 — toute table portant `org_id` porte sa politique, et elle est forcée.
ALTER TABLE azimut.parking ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.parking FORCE ROW LEVEL SECURITY;

CREATE POLICY parking_org_policy ON azimut.parking
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
