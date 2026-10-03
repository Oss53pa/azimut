-- Retour à la forme de la migration 0019.
--
-- Réversible par construction : la migration aller s'arrête sur une table non
-- vide, donc le retour ne peut porter que sur des lignes écrites après elle.
-- Le `#>>` rend une valeur JSON en texte ; un objet ou un tableau y devient sa
-- propre écriture JSON, ce qui est la seule reprise possible vers du texte.

ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_status_check;
ALTER TABLE azimut.site_fact DROP COLUMN status;
ALTER TABLE azimut.site_fact DROP COLUMN declared_by;

ALTER TABLE azimut.site_fact RENAME COLUMN declared_at TO recorded_on;

ALTER TABLE azimut.site_fact RENAME CONSTRAINT site_fact_source_ref_not_blank TO site_fact_source_not_blank;
ALTER TABLE azimut.site_fact RENAME COLUMN source_ref TO source;

ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_value_not_empty;

ALTER TABLE azimut.site_fact
  ALTER COLUMN value TYPE text USING (value #>> '{}');

ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_value_not_blank CHECK (btrim(value) <> '');
