-- A5.2 — le calage décrit l'image, en pixels de l'image.
--
-- Les deux colonnes portaient une origine en mètres : la position, dans le
-- repère site, de l'origine du fond. A5.2 décrit l'inverse — « origin_x_px,
-- origin_y_px : position, dans l'image, de l'origine du repère site » — et
-- range ces colonnes parmi les seules en pixels que la base admette (M01.S2).
--
-- Ce n'est donc pas un renommage. Renommer aurait laissé des mètres sous un
-- nom de pixels, ce qui est pire que l'écart d'origine : la valeur aurait
-- menti sans que rien ne le dise. Les colonnes sont retirées et reposées.
-- Aucune ligne n'existe dans `plan_calibration` : rien n'est perdu, et sur une
-- base qui en porterait, la conversion demanderait l'échelle de chaque ligne
-- et relèverait de A2.2 nº 7.
--
-- Nullables, et c'est un choix : l'origine du repère site est fixée par le
-- premier calage (M01.S1) et ne tombe pas nécessairement dans l'image des
-- calages suivants, ceux des autres niveaux. Exiger une valeur obligerait à en
-- inventer une hors cadre.
--
-- `reference_distance_m` est la distance réelle saisie à l'étape 2 de M2.
-- Nullable pour la même raison de franchise : le calage par points de calage
-- mesurés n'en produit pas une, et la rendre obligatoire interdirait cette
-- voie sans que le document le demande.

ALTER TABLE azimut.plan_calibration DROP COLUMN origin_x;
ALTER TABLE azimut.plan_calibration DROP COLUMN origin_y;

ALTER TABLE azimut.plan_calibration ADD COLUMN origin_x_px numeric;
ALTER TABLE azimut.plan_calibration ADD COLUMN origin_y_px numeric;
ALTER TABLE azimut.plan_calibration ADD COLUMN reference_distance_m numeric
  CHECK (reference_distance_m IS NULL OR reference_distance_m > 0);

-- Les deux coordonnées de l'origine vont ensemble : une moitié d'origine n'est
-- pas une origine, comme sur `site` depuis la migration 0021.
ALTER TABLE azimut.plan_calibration
  ADD CONSTRAINT plan_calibration_origin_px_pair_check
  CHECK ((origin_x_px IS NULL) = (origin_y_px IS NULL));
