-- M01.S2 — les coordonnées en pixels d'un point de calage portent le nom que
-- A5.2 leur donne : `image_x_px` et `image_y_px`.
--
-- `control_point` vient de la migration 0018, écrite d'après le complément
-- « atelier », document qui ne fait plus foi depuis la consolidation. Ses
-- deux colonnes s'appelaient `source_x_px` et `source_y_px`, nomenclature
-- qu'aucune section du cahier des charges ne porte.
--
-- Un renommage conserve les données : la migration n'en détruit ni n'en
-- transforme aucune, et elle se défait à l'identique.
--
-- Elle ne referme pas à elle seule l'infraction déclarée en M01.S2 : la règle
-- nomme `plan_calibration` et `plan_calibration_point` comme seules tables
-- autorisées à porter des pixels, et `control_point` n'en est pas. Le nom de
-- la table reste donc à trancher, la migration 0033 ayant déjà créé la table
-- `plan_calibration_point` conforme à A5.2.

ALTER TABLE azimut.control_point RENAME COLUMN source_x_px TO image_x_px;
ALTER TABLE azimut.control_point RENAME COLUMN source_y_px TO image_y_px;
