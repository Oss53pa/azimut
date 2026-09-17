-- Complément atelier, M1.4 : calage mesuré sur points homologues.
--
-- Le calage existant (scale_m_per_px, origin, rotation) pose une similitude et
-- ne dit rien de l'erreur commise. Le calage mesuré ajoute la transformation
-- affine à six réels ajustée par moindres carrés, les points homologues qui la
-- fondent, et le résidu que chacun laisse.
--
-- Ajout strictement additif : les colonnes sont nullables, aucune ligne
-- existante n'est lue, transformée ni supprimée. Un plan calé à deux points
-- reste exploitable tel quel, ses colonnes affines restant nulles.

ALTER TABLE azimut.plan_calibration
  ADD COLUMN affine_a numeric,
  ADD COLUMN affine_b numeric,
  ADD COLUMN affine_c numeric,
  ADD COLUMN affine_d numeric,
  ADD COLUMN affine_e numeric,
  ADD COLUMN affine_f numeric,
  ADD COLUMN mean_residual_m numeric,
  ADD COLUMN max_residual_m numeric;

-- Les six réels vont ensemble ou pas du tout : une affine partielle est une
-- transformation fausse, pas une transformation incomplète.
ALTER TABLE azimut.plan_calibration
  ADD CONSTRAINT plan_calibration_affine_complete CHECK (
    num_nulls(affine_a, affine_b, affine_c, affine_d, affine_e, affine_f) IN (0, 6)
  );

-- Un résidu est une distance : jamais négatif, et le maximum majore la moyenne.
-- Les deux vont ensemble ou pas du tout, comme les six réels ci-dessus : la
-- forme `(les deux NULL) OR (...)` laisserait passer un maximum seul, parce que
-- la seconde branche vaudrait alors NULL et qu'une contrainte NULL est réputée
-- satisfaite. `num_nulls` évite ce piège.
ALTER TABLE azimut.plan_calibration
  ADD CONSTRAINT plan_calibration_residuals_ordered CHECK (
    num_nulls(mean_residual_m, max_residual_m) = 2
    OR (num_nulls(mean_residual_m, max_residual_m) = 0
        AND mean_residual_m >= 0
        AND max_residual_m >= mean_residual_m)
  );

CREATE TABLE azimut.control_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  calibration_id uuid NOT NULL REFERENCES azimut.plan_calibration(id) ON DELETE CASCADE,
  -- Le point tel qu'il est désigné sur le fond, dans les pixels du fichier.
  source_x_px numeric NOT NULL,
  source_y_px numeric NOT NULL,
  -- Le même lieu dans le repère métier du niveau (D1.1, mètres).
  target_x_m numeric NOT NULL,
  target_y_m numeric NOT NULL,
  -- Écart laissé par l'ajustement. Calculé, jamais saisi, comme edge.length_m.
  residual_m numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT control_point_residual_non_negative CHECK (residual_m IS NULL OR residual_m >= 0)
);
CREATE INDEX idx_control_point_org ON azimut.control_point(org_id);
CREATE INDEX idx_control_point_calibration ON azimut.control_point(calibration_id);

-- `updated_at` ne bouge pas tout seul : toutes les tables antérieures qui le
-- portent ont ce déclencheur, et l'oublier laisserait une colonne qui paraît
-- dire la fraîcheur de la ligne sans jamais changer.
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.control_point
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

ALTER TABLE azimut.control_point ENABLE ROW LEVEL SECURITY;

CREATE POLICY control_point_org_policy ON azimut.control_point
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
