-- Rétablit `azimut.control_point` dans l'état exact où la migration 0052 l'a
-- trouvée : la table de 0018, sa clé étrangère d'organisation resserrée en
-- RESTRICT par 0039, ses colonnes de pixels renommées par 0050, et le
-- forçage de sécurité par ligne posé par 0025.
--
-- Rien n'est restauré du contenu : la migration montante ne s'exécute que sur
-- une table vide, et une table vide se rétablit vide.

CREATE TABLE azimut.control_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  calibration_id uuid NOT NULL REFERENCES azimut.plan_calibration(id) ON DELETE CASCADE,
  image_x_px numeric NOT NULL,
  image_y_px numeric NOT NULL,
  target_x_m numeric NOT NULL,
  target_y_m numeric NOT NULL,
  residual_m numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT control_point_residual_non_negative CHECK (residual_m IS NULL OR residual_m >= 0)
);
CREATE INDEX idx_control_point_org ON azimut.control_point(org_id);
CREATE INDEX idx_control_point_calibration ON azimut.control_point(calibration_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.control_point
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

ALTER TABLE azimut.control_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.control_point FORCE ROW LEVEL SECURITY;

CREATE POLICY control_point_org_policy ON azimut.control_point
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

-- Les droits viennent de 0025, qui les a posés sur toutes les tables du schéma
-- et en a fait le défaut des suivantes. Les écrire ici plutôt que de compter
-- sur ce défaut : une base restaurée doit l'être par ce fichier, pas par
-- l'état d'un privilège par défaut.
GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.control_point TO authenticated;
