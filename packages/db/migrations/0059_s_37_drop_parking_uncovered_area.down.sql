-- Rétablit la table des surfaces non couvertes, d'avant la règle S-37.
--
-- La table revient vide, et c'est tout ce que ce sens peut faire : les faits
-- `parking.undigitized_spaces` qui l'ont remplacée ne s'y reversent pas — ils
-- ciblent une empreinte, quand la table pendait à un parking qui n'existe
-- peut-être plus.
--
-- Elle dépend de `azimut.parking`, que la migration 0060 retire. Ce sens-ci ne
-- se joue donc qu'avec le retour de 0060, et dans cet ordre.

CREATE TABLE azimut.parking_uncovered_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  parking_id uuid NOT NULL REFERENCES azimut.parking(id) ON DELETE CASCADE,
  geometry jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_uncovered_reason_not_blank CHECK (btrim(reason) <> '')
);

CREATE INDEX idx_parking_uncovered_org ON azimut.parking_uncovered_area (org_id);
CREATE INDEX idx_parking_uncovered_parking ON azimut.parking_uncovered_area (parking_id);

-- A6.1 — toute table portant `org_id` porte sa politique, et elle est forcée.
ALTER TABLE azimut.parking_uncovered_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.parking_uncovered_area FORCE ROW LEVEL SECURITY;

CREATE POLICY parking_uncovered_area_org_policy ON azimut.parking_uncovered_area
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
