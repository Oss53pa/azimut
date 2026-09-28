-- A5.4 : le paquet est obligatoire pour un pictogramme de sécurité.
--
-- « Pour le registre de sécurité, la désignation vient du paquet de règles et
-- n'est jamais saisie : c'est lui qui porte ces pictogrammes. rules_pack_id est
-- alors obligatoire, contrainte posée en base : un pictogramme de sécurité sans
-- paquet n'est vu par aucun site, c'est donc une donnée morte. Pour le registre
-- d'orientation, la désignation est libre et le paquet reste vide. »
--
-- Une seule contrainte tient les deux phrases : un pictogramme porte un paquet
-- si et seulement s'il relève du registre de sécurité.
--
-- **Aucune ligne n'est transformée.** Une ligne qui contredirait la règle
-- ferait échouer la pose de la contrainte ; l'arrêt se produit avant, avec le
-- compte, pour que la correction se décide et ne se devine pas (A2.2, point 7).

DO $$
DECLARE
  securite_sans_paquet bigint;
  orientation_avec_paquet bigint;
BEGIN
  SELECT count(*) INTO securite_sans_paquet
    FROM azimut.pictogram WHERE registry = 'safety' AND rules_pack_id IS NULL;
  SELECT count(*) INTO orientation_avec_paquet
    FROM azimut.pictogram WHERE registry = 'wayfinding' AND rules_pack_id IS NOT NULL;

  IF securite_sans_paquet > 0 OR orientation_avec_paquet > 0 THEN
    RAISE EXCEPTION
      'azimut.pictogram porte % pictogramme(s) de sécurité sans paquet et % d''orientation avec paquet : A5.4 les refuse, et cette migration ne décide pas à leur place (A2.2, point 7).',
      securite_sans_paquet, orientation_avec_paquet;
  END IF;
END;
$$;

ALTER TABLE azimut.pictogram
  ADD CONSTRAINT pictogram_pack_by_registry
  CHECK ((registry = 'safety') = (rules_pack_id IS NOT NULL));
