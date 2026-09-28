-- Retour à la place autonome d'avant la section S8.
--
-- Ce sens-là détruit aussi, et plus lourdement : le rattachement d'une place à
-- son empreinte disparaît, et le parking auquel la rendre n'existe plus comme
-- colonne. Une ligne ne se reconstruit pas. A2.2, point 7 — l'arrêt se produit
-- avant toute modification.
--
-- La migration inverse est écrite parce qu'une migration sans retour n'est pas
-- une migration ; elle n'est pas écrite pour être jouée sur des données.

DO $$
DECLARE
  lignes bigint;
BEGIN
  SELECT count(*) INTO lignes FROM azimut.parking_space;

  IF lignes > 0 THEN
    RAISE EXCEPTION
      'azimut.parking_space porte % ligne(s) rattachée(s) à une empreinte. Cette migration inverse perdrait ce rattachement (A2.2, point 7).',
      lignes;
  END IF;
END;
$$;

DROP INDEX azimut.idx_parking_space_footprint;
ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_row_label_not_blank;
ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_kind_known;
ALTER TABLE azimut.parking_space DROP CONSTRAINT parking_space_footprint_unique;
ALTER TABLE azimut.parking_space DROP COLUMN footprint_id;

ALTER TABLE azimut.parking_space RENAME COLUMN space_kind TO kind;

ALTER TABLE azimut.parking_space
  ADD COLUMN parking_id uuid NOT NULL
    REFERENCES azimut.parking(id) ON DELETE CASCADE;
ALTER TABLE azimut.parking_space ADD COLUMN geometry jsonb;
ALTER TABLE azimut.parking_space ADD COLUMN status text NOT NULL;
ALTER TABLE azimut.parking_space ADD COLUMN source text NOT NULL;

ALTER TABLE azimut.parking_space
  ADD CONSTRAINT parking_space_kind_known
  CHECK (kind IN ('standard','pmr','livraison'));
ALTER TABLE azimut.parking_space
  ADD CONSTRAINT parking_space_status_known
  CHECK (status IN ('existant','proposition','a_verifier','retire'));
ALTER TABLE azimut.parking_space
  ADD CONSTRAINT parking_space_source_not_blank
  CHECK (btrim(source) <> '');

CREATE INDEX idx_parking_space_parking ON azimut.parking_space (parking_id);
