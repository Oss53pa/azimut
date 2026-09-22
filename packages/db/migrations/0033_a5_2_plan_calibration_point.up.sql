-- A5.2 — les points de calage d'une source de plan.
--
-- « Les points de calage permettent de rejouer le calage à l'identique. »
-- Sans eux, M2 critère 2 — « Le calage rejoué sur les mêmes points donne
-- exactement le même résultat » — est une promesse invérifiable : la base
-- garde l'échelle obtenue, jamais la mesure qui l'a produite.
--
-- Les coordonnées sont en pixels de l'image, et c'est la seconde des deux
-- exceptions que M01.S2 admet : elles décrivent l'image source, jamais le
-- site.
--
-- `ordinal` ordonne les points, et l'unicité par calage empêche deux points
-- de porter le même rang — sans quoi « les mêmes points » n'aurait pas de
-- sens.

CREATE TABLE azimut.plan_calibration_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  calibration_id uuid NOT NULL
    REFERENCES azimut.plan_calibration(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  image_x_px numeric NOT NULL,
  image_y_px numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_id, ordinal)
);
CREATE INDEX idx_plan_calibration_point_org ON azimut.plan_calibration_point(org_id);
CREATE INDEX idx_plan_calibration_point_calibration
  ON azimut.plan_calibration_point(calibration_id);

-- A6.1 et A13.3 : la politique arrive avec la table.
ALTER TABLE azimut.plan_calibration_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.plan_calibration_point FORCE ROW LEVEL SECURITY;

CREATE POLICY plan_calibration_point_org_policy ON azimut.plan_calibration_point
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.plan_calibration_point TO authenticated;
