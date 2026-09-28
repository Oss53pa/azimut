-- Retour à l'état antérieur à 0062 : la colonne, sa contrainte de forme et son
-- index d'unicité disparaissent ensemble. La contrainte et l'index tombent avec
-- la colonne, mais les nommer dit ce que cette migration a posé.

DROP INDEX IF EXISTS azimut.uq_pictogram_function;

ALTER TABLE azimut.pictogram
  DROP CONSTRAINT IF EXISTS pictogram_function_key_shape;

ALTER TABLE azimut.pictogram
  DROP COLUMN IF EXISTS function_key;
