-- A5.2 — un fond de plan porte un calage, pas deux.
--
-- Le modèle le dit depuis le début : « chacun est calé au plus une fois ».
-- Rien ne l'empêchait. Deux calages du même fond donneraient deux conversions
-- pixel → mètre pour la même image, et rien ne dirait laquelle s'applique : la
-- géométrie relevée dessus deviendrait indéterminée.
--
-- Recaler un fond (S9) met cette ligne à jour ; cela n'en ajoute pas une
-- seconde. `calibrated_at` reste alors la date à laquelle le calage a été
-- établi, et ne suit pas la mise à jour — sinon « le premier calage » de S1
-- se déplacerait à chaque recalage, et le contrôle du repère site
-- (CALIB.ORIGIN_MISMATCH) désignerait un autre fond que celui qui a fixé le
-- repère.
--
-- Aucune donnée n'est transformée ni supprimée. Si un fond porte déjà deux
-- calages, la création de l'index échoue et le dit : choisir lequel garder est
-- une décision métier, elle ne se devine pas en migration. Pour les trouver :
--
--   SELECT plan_source_id, count(*)
--     FROM azimut.plan_calibration
--    GROUP BY plan_source_id
--   HAVING count(*) > 1;

CREATE UNIQUE INDEX uq_plan_calibration_plan_source
  ON azimut.plan_calibration (plan_source_id);
