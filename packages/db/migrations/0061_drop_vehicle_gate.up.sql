-- Retrait de `vehicle_gate` : rien ne la lit, et rien du socle ne la reprend.
--
-- La table portait un portail ou un accès véhicule — code du plan source, rôle,
-- largeur, position, statut, source. Elle a été écrite avec le module de
-- stationnement, avant que la section S8 ne dise ce que le socle porte du
-- stationnement. S8 nomme deux objets, la zone et l'empreinte de place ; elle
-- ne nomme aucun accès véhicule, et aucune autre section du document ne le
-- décrit.
--
-- **Contrairement aux deux autres, celle-ci ne se reporte nulle part.**
-- `parking` est devenue une zone, l'ancienne `parking_space` une extension
-- d'empreinte ; un portail n'a ni équivalent ni remplaçant. Le besoin est réel
-- — un plan d'accueil qui montre par où l'on entre en voiture a quelque chose à
-- dire — et il est inscrit au registre des points ouverts : il reviendra avec
-- les accès de livraison, qui poseront la même question et méritent une seule
-- réponse.
--
-- Garder la table en attendant coûterait plus que la retirer. Une table que
-- rien n'écrit et que rien ne lit se démode en silence, et la forme qu'elle
-- prendra quand la question sera tranchée n'a aucune raison d'être celle-ci.
--
-- **Migration destructrice.** A2.2, point 7 : la table a été vérifiée vide sur
-- le seul instantané atteignable, aucun chemin d'écriture du dépôt n'y insère,
-- et plus aucune lecture ne la touche. L'arrêt se produit avant toute
-- modification.

DO $$
DECLARE
  lignes bigint;
BEGIN
  SELECT count(*) INTO lignes FROM azimut.vehicle_gate;

  IF lignes > 0 THEN
    RAISE EXCEPTION
      'azimut.vehicle_gate porte % ligne(s), et aucune table ne les reprend : le socle ne décrit aucun accès véhicule (A2.2, point 7).',
      lignes;
  END IF;
END;
$$;

DROP TABLE azimut.vehicle_gate;
