-- A5.6 — les colonnes héritées de support_face et support_content_block
-- deviennent facultatives.
--
-- A5.6 identifie une face par `face_index` et un bloc par `block_index` ;
-- `support_face.side` et `support_content_block.ordinal`, antérieurs à 0016,
-- n'y figurent pas mais restaient obligatoires. Une face ou un bloc écrit selon
-- A5.6 devait donc inventer une valeur, ou recopier l'indice (INV-1). Décision
-- du 26/09/2026 : ces colonnes deviennent facultatives. Aucune donnée n'est
-- transformée, aucune colonne retirée.
--
-- Un bloc garde une place sur sa face : `block_index` ou, à défaut, l'`ordinal`
-- hérité, que la lecture prend en repli. Les lignes existantes portent toutes
-- un `ordinal` : la contrainte se pose sans rien réécrire.

ALTER TABLE azimut.support_face ALTER COLUMN side DROP NOT NULL;

ALTER TABLE azimut.support_content_block ALTER COLUMN ordinal DROP NOT NULL;

ALTER TABLE azimut.support_content_block
  ADD CONSTRAINT support_content_block_position_present
  CHECK (block_index IS NOT NULL OR ordinal IS NOT NULL);
