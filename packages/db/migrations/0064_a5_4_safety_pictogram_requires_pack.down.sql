-- Retour à l'état de 0063 : la contrainte tombe, aucune ligne n'est touchée.

ALTER TABLE azimut.pictogram
  DROP CONSTRAINT IF EXISTS pictogram_pack_by_registry;
