-- Retour à la divergence de 0006 : rattachée à la pose, avec `notes`.
--
-- Le retour refuse plutôt que de perdre : une divergence sans pose (point non
-- couvert, ou support sans pose enregistrée) n'a pas de place dans l'ancien
-- schéma, et un `detail` qui porte autre chose qu'une note texte ne tient pas
-- dans `notes`. Les supprimer relèverait de A2.2 nº 7.
--
-- FORCE ROW LEVEL SECURITY est levé le temps des contrôles et de la recopie,
-- comme à la montée : sans cela, les contrôles ne verraient aucune ligne et
-- passeraient à tort.

ALTER TABLE azimut.divergence NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.divergence WHERE installed_support_id IS NULL) THEN
    RAISE EXCEPTION 'divergence rows without installed_support_id cannot return to the 0006 schema';
  END IF;
  IF EXISTS (
    SELECT 1 FROM azimut.divergence
    WHERE detail IS NOT NULL
      AND ((detail - 'notes') <> '{}'::jsonb OR jsonb_typeof(detail -> 'notes') IS DISTINCT FROM 'string')
  ) THEN
    RAISE EXCEPTION 'divergence rows whose detail is not a single text note cannot return to the 0006 schema';
  END IF;
END $$;

ALTER TABLE azimut.divergence ADD COLUMN notes text;

UPDATE azimut.divergence SET notes = detail ->> 'notes' WHERE detail IS NOT NULL;

ALTER TABLE azimut.divergence FORCE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS azimut.idx_divergence_node;
DROP INDEX IF EXISTS azimut.idx_divergence_support;

ALTER TABLE azimut.divergence
  DROP CONSTRAINT divergence_designates_support_or_node,
  ALTER COLUMN installed_support_id SET NOT NULL,
  DROP COLUMN detail,
  DROP COLUMN node_id,
  DROP COLUMN support_id;
