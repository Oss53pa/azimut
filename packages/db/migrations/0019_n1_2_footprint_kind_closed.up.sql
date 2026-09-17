-- N1.2 — l'énuméré des natures d'empreinte se ferme.
--
-- `footprint.kind` était la seule colonne d'énumération du schéma sans
-- contrainte : `node.kind`, `vertical_link.kind`, `destination.occupancy_status`
-- et `proof.status` en portent une depuis l'origine. Le type TypeScript se
-- ferme sur les mêmes cinq natures, et cette contrainte est ce qui l'adosse.
--
-- Cette migration ne transforme aucune donnée. Si une installation porte des
-- natures antérieures — « room », « corridor », « floor » ont circulé —
-- l'ajout de la contrainte échoue en nommant les lignes fautives. C'est
-- voulu : la correspondance vers les cinq natures de N1.2 est une décision
-- métier, elle ne se devine pas en migration. La requête ci-dessous, laissée
-- en commentaire, liste ce qu'il faudrait trancher :
--
--   SELECT DISTINCT kind, count(*) FROM azimut.footprint
--   WHERE kind NOT IN ('cell','circulation','technical','vertical_core','outdoor')
--   GROUP BY kind;

ALTER TABLE azimut.footprint
  ADD CONSTRAINT footprint_kind_check
  CHECK (kind IN ('cell', 'circulation', 'technical', 'vertical_core', 'outdoor'));
