-- M01.S2 — une seule table de points de calage.
--
-- « Seule exception, le calage d'une source de plan […] : ses points sont
-- conservés en pixels de l'image, suffixe `_px`, dans les tables
-- `plan_calibration` et `plan_calibration_point`. » `control_point` n'est
-- aucune des deux. Elle vient de la migration 0018, écrite d'après un document
-- antérieur qui ne fait plus foi depuis la consolidation, et la migration 0033
-- a depuis créé `plan_calibration_point`, conforme à A5.2.
--
-- Elle n'est pas fusionnée dans celle-ci. Ses colonnes `target_x_m`,
-- `target_y_m` et `residual_m` relèvent d'un calage à n points avec résidu,
-- que le cahier des charges ne décrit pas et que son registre range en
-- amélioration possible et non engagée. Les porter dans la table de A5.2
-- inscrirait dans le schéma une méthode qui n'est pas spécifiée.
--
-- La suppression est donc bien une suppression, et le garde ci-dessous est ce
-- qui la rend sûre : A2.2, point 7, interdit à une migration de détruire des
-- données existantes. La table est vide sur la base de développement, vérifié
-- avant écriture ; sur toute autre installation, la migration s'arrête au lieu
-- de détruire, et la question se pose à celui qui l'applique.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.control_point) THEN
    RAISE EXCEPTION
      'azimut.control_point porte des lignes : la migration 0052 refuse de les détruire (A2.2, point 7). Les traiter, puis réappliquer.';
  END IF;
END;
$$;

DROP TABLE azimut.control_point;
