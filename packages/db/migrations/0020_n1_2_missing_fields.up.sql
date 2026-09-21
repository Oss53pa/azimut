-- N1.2 — champs spécifiés par la partie N et absents du schéma.
--
-- Cinq colonnes, toutes nullables et sans valeur par défaut. Aucune ligne
-- existante n'est lue, modifiée ni supprimée : la migration ajoute de la place,
-- elle ne déclare rien à la place de personne. Une valeur par défaut aurait
-- affirmé quelque chose de faux sur les données déjà en base — que le site
-- parle français, que son niveau de référence est au niveau de la mer, que
-- l'occupant en place est entré à telle date.

-- N1.2 — langues actives du site. Au moins une, `fr` et `en` seules admises
-- en V1. Le CHECK tolère NULL (non déclaré) et interdit le tableau vide, qui
-- ne dirait rien de plus que NULL en ayant l'air d'une déclaration.
ALTER TABLE azimut.site
  ADD COLUMN active_langs text[],
  ADD COLUMN reference_elevation_m numeric;

ALTER TABLE azimut.site
  ADD CONSTRAINT site_active_langs_check CHECK (
    active_langs IS NULL
    OR (
      cardinality(active_langs) >= 1
      AND active_langs <@ ARRAY['fr', 'en']::text[]
    )
  );

-- N1.2 — largeur héritée par les arêtes du bâtiment. Valeur de saisie : une
-- arête déjà tracée garde la sienne.
ALTER TABLE azimut.building
  ADD COLUMN default_edge_width_m numeric;

ALTER TABLE azimut.building
  ADD CONSTRAINT building_default_edge_width_check CHECK (
    default_edge_width_m IS NULL OR default_edge_width_m > 0
  );

-- N1.2 / S5 — période d'occupation. `valid_to` NULL désigne l'occupant en
-- cours ; `valid_from` NULL une entrée non relevée. L'historique se lit par la
-- succession des lignes, aucune n'est écrasée.
ALTER TABLE azimut.destination
  ADD COLUMN valid_from date,
  ADD COLUMN valid_to date;

ALTER TABLE azimut.destination
  ADD CONSTRAINT destination_validity_order_check CHECK (
    valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to
  );
