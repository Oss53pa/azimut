-- A5.11 — `site_fact` alignée sur la table que la section déclare.
--
-- « site_fact (id, org_id, site_id, key, value jsonb, status, source_ref,
-- declared_by, declared_at) — status in ('existing','proposal','to_verify') ».
--
-- La table vient de la migration 0019, écrite d'après un document qui ne fait
-- plus foi. La version 13 du consolidé a inscrit les faits du site en A5.11,
-- avec la règle M01.S11, et la table du dépôt en divergeait sur quatre points :
-- pas de statut, une valeur en texte, et deux colonnes portant d'autres noms.
--
-- **Le statut est le point qui compte.** « Un fait de statut `proposal` ne
-- s'affiche jamais comme un existant » : sans colonne pour le porter, la règle
-- n'était opposable que sur les objets de stationnement, qui portaient un
-- statut de leur côté. Un fait déclaré n'en avait aucun, donc tout fait
-- s'affichait comme un existant.
--
-- `declared_by` est un ajout et non un renommage : la table n'avait aucune
-- colonne d'auteur. Nullable, et sans valeur de repli : un fait enregistré
-- avant cette colonne n'a pas d'auteur connu, et le nom de celui qui applique
-- la migration n'est pas celui qui a déclaré le fait.
--
-- `declared_at` garde le type `date` de `recorded_on`, qu'A5.11 ne type pas :
-- ce qui est consigné est un jour de constatation, non un instant. Le
-- renommage est ce que la tâche autorise, la conversion de type n'en est pas.
--
-- **A2.2, point 7.** Le passage de `value` en `jsonb` est une transformation de
-- donnée. La table est vide sur la base de développement, vérifié avant
-- écriture ; sur toute autre installation, la migration s'arrête au lieu de
-- transformer, et la question se pose à celui qui l'applique. Un `to_jsonb`
-- sur du texte libre produirait des chaînes JSON là où la valeur voulait être
-- un nombre ou un objet, et personne ne saurait ensuite lesquelles.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.site_fact) THEN
    RAISE EXCEPTION
      'azimut.site_fact porte des lignes : la migration 0044 refuse de transformer `value` en jsonb (A2.2, point 7). Les convertir, puis réappliquer.';
  END IF;
END;
$$;

-- La contrainte de non-vacuité porte sur du texte ; elle tombe avant le
-- changement de type et revient sous une forme que `jsonb` admet.
ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_value_not_blank;

ALTER TABLE azimut.site_fact
  ALTER COLUMN value TYPE jsonb USING to_jsonb(value);

-- Une valeur vide se rendrait telle quelle dans un texte lié (`DOC.BINDING_*`).
-- En `jsonb`, « vide » a trois formes de plus que la chaîne blanche : le null
-- JSON, le tableau vide et l'objet vide. Les quatre sont refusées.
ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_value_not_empty CHECK (
    jsonb_typeof(value) <> 'null'
    AND value <> '""'::jsonb
    AND value <> '[]'::jsonb
    AND value <> '{}'::jsonb
    AND (jsonb_typeof(value) <> 'string' OR btrim(value #>> '{}') <> '')
  );

ALTER TABLE azimut.site_fact RENAME COLUMN source TO source_ref;
ALTER TABLE azimut.site_fact RENAME CONSTRAINT site_fact_source_not_blank TO site_fact_source_ref_not_blank;

ALTER TABLE azimut.site_fact RENAME COLUMN recorded_on TO declared_at;

ALTER TABLE azimut.site_fact ADD COLUMN declared_by uuid;

-- Le statut est requis : c'est tout l'objet de la colonne. Sans valeur par
-- défaut non plus, pour la même raison qu'en A5.8 une règle absente n'est pas
-- une règle permissive — `existing` par défaut ferait passer toute proposition
-- pour un existant, ce que la règle interdit précisément.
ALTER TABLE azimut.site_fact ADD COLUMN status text NOT NULL;

ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_status_check
  CHECK (status IN ('existing', 'proposal', 'to_verify'));
