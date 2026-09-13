-- K2.1 : ordre de rendu manuel des volumes
-- Attribut render_order ajouté à la table des volumes, nul par défaut.
-- Quand il est renseigné, il prime sur le tri par profondeur calculé.
-- Colonne additive et nullable : aucune donnée existante n'est transformée.

ALTER TABLE azimut.volume
  ADD COLUMN render_order integer;
