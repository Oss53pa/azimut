-- A5.6 : colonnes normatives du support, ajoutées en additif.
-- reading_distance_m alimente la formule de lisibilité (LEGIBILITY.MIN_CHAR_HEIGHT).
-- registry porte la portée du support et conditionne le durcissement du
-- registre de sécurité (safety plus contraignant que wayfinding).
-- Colonnes additives et nullables : aucune donnée existante n'est transformée.

ALTER TABLE azimut.support
  ADD COLUMN reading_distance_m numeric,
  ADD COLUMN registry text CHECK (registry IN ('safety','wayfinding'));
