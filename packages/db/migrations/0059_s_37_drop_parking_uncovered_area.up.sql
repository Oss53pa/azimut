-- S-37 — la surface non numérisée devient un fait, et sa table part.
--
-- « Une surface de parking non numérisée se déclare comme telle : une empreinte
-- de nature `parking_space` peut être marquée non numérisée, avec le nombre de
-- places qu'elle est censée porter et sa source. C'est elle qui explique un
-- écart entre la capacité annoncée et les places comptées. »
--
-- **La marque est l'existence du fait.** `parking.undigitized_spaces` (A5.11),
-- entier, ciblant l'empreinte. Ce que la table portait s'y retrouve entier :
-- son tracé est celui de l'empreinte, son compte est la valeur du fait, sa
-- source est `site_fact.source_ref`, et son statut `site_fact.status`.
--
-- **Ce qu'elle portait et que le fait ne porte pas** : `reason`, le motif
-- textuel — bord de page, calque absent, zone illisible. S-37 nomme « le nombre
-- de places qu'elle est censée porter et sa source », et rien d'autre. La
-- source d'un fait est le lieu prévu pour dire d'où vient la déclaration ; un
-- motif libre en plus serait une colonne qu'aucune section ne demande.
--
-- **Cette table n'est pas l'une des trois.** L'éditeur a tranché le sort de
-- `parking`, `parking_space` et `vehicle_gate`. `parking_uncovered_area` est la
-- quatrième, et son retrait est entraîné : elle pend à `parking` par une clé
-- étrangère, et `parking` part. Le choix est donc assumé ici et porté au
-- rapport, non glissé dans la migration d'une autre table.
--
-- **Migration destructrice.** A2.2, point 7 : la table a été vérifiée vide sur
-- le seul instantané atteignable, aucun chemin d'écriture du dépôt n'y insère,
-- et plus aucune lecture ne la touche depuis le commit précédent. L'arrêt
-- ci-dessous se produit avant toute modification.

DO $$
DECLARE
  lignes bigint;
BEGIN
  SELECT count(*) INTO lignes FROM azimut.parking_uncovered_area;

  IF lignes > 0 THEN
    RAISE EXCEPTION
      'azimut.parking_uncovered_area porte % ligne(s). Leur équivalent est un fait `parking.undigitized_spaces` ciblant une empreinte, et cette migration ne le construit pas : le tracé d''une surface n''est pas une empreinte tant que personne ne l''a tracée (A2.2, point 7).',
      lignes;
  END IF;
END;
$$;

DROP TABLE azimut.parking_uncovered_area;
