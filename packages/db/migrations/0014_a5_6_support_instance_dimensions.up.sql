-- A5.6 : dimensions portées par l'instance de support (mm), et leur origine.
-- Quand width_mm/height_mm sont renseignées, elles priment sur le format par
-- défaut de la typologie ; dimensions_source distingue le calcul du moteur
-- ('computed') d'une saisie manuelle ('overridden'). Additif, nullable :
-- aucune donnée existante n'est transformée. Les colonnes width_m/height_m
-- (mètres) préexistantes sont laissées en place.

ALTER TABLE azimut.support
  ADD COLUMN width_mm integer,
  ADD COLUMN height_mm integer,
  ADD COLUMN dimensions_source text CHECK (dimensions_source IN ('computed','overridden'));
