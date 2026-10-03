-- Retour à l'état de 0064 : le rôle disparaît.
--
-- Une surcouche n'a pas d'équivalent avant 0065, où un site ne portait qu'un
-- paquet. Le retour s'arrête donc s'il en existe une (A2.2, point 7).
--
-- Les socles reportés depuis `site.rules_pack_id` restent dans la table : la
-- colonne porte toujours la même valeur, et rien n'est perdu à les garder.

DO $$
DECLARE
  surcouches bigint;
BEGIN
  SELECT count(*) INTO surcouches FROM azimut.site_rules_binding WHERE role = 'overlay';
  IF surcouches > 0 THEN
    RAISE EXCEPTION
      'site_rules_binding porte % surcouche(s) : avant 0065 un site ne portait qu''un paquet, et le retour les perdrait (A2.2, point 7).',
      surcouches;
  END IF;
END;
$$;

DROP INDEX IF EXISTS azimut.uq_site_rules_binding_role;

ALTER TABLE azimut.site_rules_binding
  DROP CONSTRAINT IF EXISTS site_rules_binding_role_check;

ALTER TABLE azimut.site_rules_binding
  DROP COLUMN IF EXISTS role;
