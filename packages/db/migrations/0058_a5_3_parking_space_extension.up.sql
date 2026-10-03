-- A5.3 — `parking_space` devient l'extension d'une empreinte.
--
-- ```sql
-- parking_space (id, org_id, footprint_id, space_kind, row_label)
--               space_kind in ('standard','accessible','family','electric','delivery')
-- ```
--
-- « Extension d'une empreinte de nature `parking_space`, une ligne par
-- empreinte, sur le modèle de `vertical_link` qui étend une arête. Ne porte que
-- ce que l'empreinte générique n'a pas à porter : le type de place et son
-- repère de travée. »
--
-- **Ce que la table portait.** Une place autonome, avec sa géométrie, son
-- statut, sa source et un rattachement à un parking. La section S8 a tranché :
-- « une place de stationnement est une empreinte de nature `parking_space` »
-- (S-35). La géométrie revient donc à l'empreinte, le rattachement à la zone
-- qui déclare ses empreintes, et le statut à personne — A5.2 n'en donne aucun
-- à `footprint`, et A5.11 pose le statut d'un fait sur `site_fact`.
--
-- **Migration destructrice.** Quatre colonnes disparaissent, dont deux qui ne
-- se reconstruisent pas : une géométrie de place et sa source. A2.2, point 7 —
-- la table a été vérifiée vide avant ce commit, sur le seul instantané
-- atteignable, et aucun chemin d'écriture du dépôt n'y insère. La migration
-- s'arrête d'elle-même si elle trouve une ligne, ci-dessous.
--
-- **Pourquoi pas une table neuve.** Le nom reste le même en A5.3, et le
-- registre des migrations est tenu par nom : créer `parking_space_v2` pour
-- ensuite la renommer laisserait deux noms pour une table, et le second
-- porterait une cicatrice que rien n'explique.

-- A2.2, point 7 — l'arrêt se produit avant toute modification.
DO $$
DECLARE
  lignes bigint;
BEGIN
  SELECT count(*) INTO lignes FROM azimut.parking_space;

  IF lignes > 0 THEN
    RAISE EXCEPTION
      'azimut.parking_space porte % ligne(s). Cette migration retire la géométrie, le statut et la source d''une place, qui ne se reconstruisent pas (A2.2, point 7).',
      lignes;
  END IF;
END;
$$;

ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_parking_id_fkey;
ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_kind_known;
ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_status_known;
ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_source_not_blank;
DROP INDEX azimut.idx_parking_space_parking;

ALTER TABLE azimut.parking_space DROP COLUMN parking_id;
ALTER TABLE azimut.parking_space DROP COLUMN geometry;
ALTER TABLE azimut.parking_space DROP COLUMN status;
ALTER TABLE azimut.parking_space DROP COLUMN source;

-- Une ligne par empreinte, et l'unicité le dit. C'est ce qui fait de cette
-- table une extension et non une table d'objets : deux lignes pour une même
-- empreinte donneraient deux types à une seule place.
ALTER TABLE azimut.parking_space
  ADD COLUMN footprint_id uuid NOT NULL
    REFERENCES azimut.footprint(id) ON DELETE CASCADE;
ALTER TABLE azimut.parking_space
  ADD CONSTRAINT parking_space_footprint_unique UNIQUE (footprint_id);

-- La colonne se renomme plutôt que de se recréer : `kind` seul ne dit plus
-- rien d'utile à côté de `footprint.kind`, qui vaut déjà `parking_space`.
ALTER TABLE azimut.parking_space RENAME COLUMN kind TO space_kind;

-- Les cinq valeurs d'A5.3, en anglais comme tout autre énuméré du modèle.
-- L'ancienne liste en comptait trois, en français.
ALTER TABLE azimut.parking_space
  ADD CONSTRAINT parking_space_kind_known
  CHECK (space_kind IN ('standard','accessible','family','electric','delivery'));

ALTER TABLE azimut.parking_space
  ADD CONSTRAINT parking_space_row_label_not_blank
  CHECK (btrim(row_label) <> '');

CREATE INDEX idx_parking_space_footprint ON azimut.parking_space (footprint_id);
