-- A5.8 : le rattachement d'un site à ses paquets porte un rôle, socle ou
-- surcouche, et la table de rattachement fait foi.
--
-- « site_rules_binding (id, org_id, site_id, rules_pack_id, role, bound_at)
--   role in ('base','overlay')
-- Cette table fait foi pour le rattachement d'un site à ses paquets. Un site
-- porte au plus un socle et au plus une surcouche pays, section D3.6. »
--
-- Cette migration pose le rôle et reporte dans la table ce que portait la
-- colonne `site.rules_pack_id`. Elle ne retire pas la colonne : les lectures
-- migrent d'abord, et le retrait vient ensuite, dans sa propre migration.
--
-- **Ce qui est reporté, et pourquoi en socle.** Un site ne portait qu'un
-- paquet. D3.6 nomme le socle le paquet qu'une surcouche durcit ; un paquet
-- seul n'est la surcouche de rien. Un rattachement existant devient donc un
-- socle, et la colonne du site aussi, quand la table ne le porte pas déjà.
--
-- **Ce qui ne se décide pas ici.** Un site qui porterait déjà plusieurs
-- rattachements, ou dont la table et la colonne nomment deux paquets
-- différents, n'a pas de socle évident. La migration s'arrête avant toute
-- modification et donne le compte (A2.2, point 7).

DO $$
DECLARE
  plusieurs bigint;
  contradictoires bigint;
BEGIN
  SELECT count(*) INTO plusieurs FROM (
    SELECT site_id FROM azimut.site_rules_binding GROUP BY site_id HAVING count(*) > 1
  ) AS s;

  SELECT count(*) INTO contradictoires
    FROM azimut.site s
    JOIN azimut.site_rules_binding b ON b.site_id = s.id
   WHERE s.rules_pack_id IS NOT NULL AND b.rules_pack_id <> s.rules_pack_id;

  IF plusieurs > 0 OR contradictoires > 0 THEN
    RAISE EXCEPTION
      'site_rules_binding : % site(s) portent plusieurs rattachements et % contredisent site.rules_pack_id. Aucun socle ne se déduit ; cette migration ne choisit pas (A2.2, point 7).',
      plusieurs, contradictoires;
  END IF;
END;
$$;

ALTER TABLE azimut.site_rules_binding
  ADD COLUMN role text;

UPDATE azimut.site_rules_binding SET role = 'base';

INSERT INTO azimut.site_rules_binding (org_id, site_id, rules_pack_id, role)
SELECT s.org_id, s.id, s.rules_pack_id, 'base'
  FROM azimut.site s
 WHERE s.rules_pack_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM azimut.site_rules_binding b WHERE b.site_id = s.id
   );

ALTER TABLE azimut.site_rules_binding
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE azimut.site_rules_binding
  ADD CONSTRAINT site_rules_binding_role_check CHECK (role IN ('base', 'overlay'));

-- « Au plus un socle et au plus une surcouche. » `org_id` en tête de clé, pour
-- la raison déjà donnée en 0054 : un index qui franchirait la frontière
-- d'organisation révélerait par son message de conflit une ligne voisine.
CREATE UNIQUE INDEX uq_site_rules_binding_role
  ON azimut.site_rules_binding(org_id, site_id, role);
