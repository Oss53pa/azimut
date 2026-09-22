-- N1.2 et A8 — l'origine du repère site porte son unité dans son nom.
--
-- A5.2 nomme ces deux colonnes `origin_x_m` et `origin_y_m`. A8 en fait une
-- règle générale : « Unités toujours dans le nom. Une variable de dimension
-- sans unité dans son nom est refusée en revue. » Les colonnes avaient été
-- créées sans le suffixe, ce qui les rendait indiscernables, à la lecture,
-- de `plan_calibration.origin_x` — qui décrit tout autre chose.
--
-- Un renommage ne touche à aucune valeur : chaque ligne garde son origine,
-- dans la même unité. Ce n'est donc pas une migration destructive au sens de
-- A2.2 nº 7, et elle est réversible telle quelle.
--
-- La contrainte `site_origin_pair_check` suit le renommage sans être
-- redéclarée : PostgreSQL réécrit son expression avec les nouveaux noms.

ALTER TABLE azimut.site RENAME COLUMN origin_x TO origin_x_m;
ALTER TABLE azimut.site RENAME COLUMN origin_y TO origin_y_m;
