-- A5.2 — les valeurs de `zone.kind` et de `opening.kind`.
--
-- Les deux colonnes ont été créées en `text` libre par la migration 0003 :
-- le schéma n'énumérait alors pas leurs valeurs, et en inventer aurait été
-- une faute. A5.2 les déclare désormais, et la contrainte les rend opposables
-- comme celle de `footprint.kind` l'est depuis la migration 0019.
--
-- Aucune donnée n'est transformée : ces deux tables ne sont écrites par aucun
-- chemin d'écriture, n'ont ni type au modèle ni ligne dans les sites de
-- référence. La contrainte est vérifiée à la pose ; une ligne non conforme la
-- ferait échouer bruyamment plutôt que de passer.

ALTER TABLE azimut.zone
  ADD CONSTRAINT zone_kind_check
  CHECK (kind IN ('commercial','food','service','technical','parking','outdoor'));

ALTER TABLE azimut.opening
  ADD CONSTRAINT opening_kind_check
  CHECK (kind IN ('door','automatic_door','emergency_door','shop_front','bay'));
