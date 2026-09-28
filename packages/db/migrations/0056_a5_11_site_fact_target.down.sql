-- Retour à l'unicité par site et clé, d'avant la version 17 du consolidé.
--
-- Ce sens-là resserre : deux faits de même clé rattachés à deux objets
-- différents sont légitimes sous A5.11, et l'ancienne contrainte les rejette.
-- C'est exactement le cas qu'un site à deux parkings produit, et il ne se
-- tranche pas en migration : lequel des deux faits garder n'est pas une
-- question de schéma. A2.2, point 7, et l'arrêt se produit avant toute
-- modification.

DO $$
DECLARE
  cibles bigint;
  doublons bigint;
BEGIN
  SELECT count(*) INTO cibles
  FROM azimut.site_fact
  WHERE target_kind IS NOT NULL;

  SELECT count(*) INTO doublons
  FROM (
    SELECT site_id, key
    FROM azimut.site_fact
    GROUP BY site_id, key
    HAVING count(*) > 1
  ) AS d;

  IF cibles > 0 OR doublons > 0 THEN
    RAISE EXCEPTION
      'azimut.site_fact porte % fait(s) rattaché(s) à un objet et % clé(s) déclarée(s) plusieurs fois par site. Cette migration inverse les rejetterait. Trancher leur sort avant de redescendre (A2.2, point 7).',
      cibles, doublons;
  END IF;
END;
$$;

ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_key_target_unique;

ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_key_unique UNIQUE (site_id, key);

ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_target_kind_not_blank;
ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_target_complete;
ALTER TABLE azimut.site_fact DROP COLUMN target_id;
ALTER TABLE azimut.site_fact DROP COLUMN target_kind;
