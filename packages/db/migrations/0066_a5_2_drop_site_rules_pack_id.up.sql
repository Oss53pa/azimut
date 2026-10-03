-- A5.2 et A5.8 : la colonne `site.rules_pack_id` disparaît.
--
-- « La colonne de paquet disparaît de la table des sites. » Le rattachement
-- d'un site à ses paquets est porté par `site_rules_binding`, qui fait foi
-- depuis 0065, et plus aucune lecture ne passe par la colonne.
--
-- **Migration destructrice.** Elle ne s'applique que si la colonne ne porte
-- plus rien que la table ne porte déjà : chaque valeur non nulle doit s'y
-- retrouver en socle, pour le même site et le même paquet. 0065 les y a
-- reportées ; une valeur écrite depuis, ou qui contredit la table, serait
-- perdue au retrait. La migration s'arrête alors avant toute modification et
-- donne le compte (A2.2, point 7).

DO $$
DECLARE
  orphelines bigint;
BEGIN
  SELECT count(*) INTO orphelines
    FROM azimut.site s
   WHERE s.rules_pack_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM azimut.site_rules_binding b
        WHERE b.site_id = s.id
          AND b.role = 'base'
          AND b.rules_pack_id = s.rules_pack_id
     );

  IF orphelines > 0 THEN
    RAISE EXCEPTION
      'site.rules_pack_id : % site(s) portent un paquet que site_rules_binding ne porte pas en socle. Le retrait le perdrait ; cette migration ne choisit pas (A2.2, point 7).',
      orphelines;
  END IF;
END;
$$;

ALTER TABLE azimut.site
  DROP COLUMN rules_pack_id;
