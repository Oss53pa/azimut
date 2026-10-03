-- S-35 — un parking est une zone, et sa table part.
--
-- « Une place de stationnement est une empreinte de nature `parking_space`. Un
-- parking est une zone de nature `parking`. Ce sont les objets du socle,
-- module 01. »
--
-- La table doublait `zone` d'A5.2. Ce qu'elle portait a trouvé sa place :
--
--   geometry          → les empreintes que la zone déclare (`zone.footprint_ids`)
--   name              → `zone.name`
--   free              → fait `parking.free`, booléen, ciblant la zone
--   declared_capacity → fait `parking.capacity`, entier, ciblant la zone
--   status, source    → `site_fact.status` et `site_fact.source_ref`
--
-- **Une zone n'a pas de géométrie propre**, et A5.2 n'en donne aucune : elle
-- déclare les empreintes qu'elle couvre, « appartenance déclarée et non
-- calculée ». L'emprise d'un parking est donc celle de ses empreintes, place
-- par place, et le sol lui-même une empreinte de nature `outdoor` si le plan la
-- montre. Aucune colonne de géométrie n'est ajoutée à `zone` : A5.2 est la
-- forme qui fait foi, et lui en ajouter une serait un choix de modèle que la
-- section ne prévoit pas.
--
-- **Le statut d'objet ne se reporte nulle part**, et c'est voulu. A5.11 le pose
-- « là où le modèle le déclare » ; ni `zone` ni `footprint` ne le déclarent.
-- Ce qui reste de la règle — « un objet ou un fait de statut proposal ne
-- s'affiche jamais comme un existant » — vit sur le fait.
--
-- **Migration destructrice.** A2.2, point 7 : la table a été vérifiée vide sur
-- le seul instantané atteignable, aucun chemin d'écriture du dépôt n'y insère,
-- et plus aucune lecture ne la touche. L'arrêt se produit avant toute
-- modification.

DO $$
DECLARE
  lignes bigint;
BEGIN
  SELECT count(*) INTO lignes FROM azimut.parking;

  IF lignes > 0 THEN
    RAISE EXCEPTION
      'azimut.parking porte % ligne(s). Leur équivalent est une zone de nature `parking` déclarant ses empreintes, plus deux faits ciblés, et cette migration ne les construit pas : une emprise de parking n''est pas une liste d''empreintes tant que personne ne les a tracées (A2.2, point 7).',
      lignes;
  END IF;
END;
$$;

DROP TABLE azimut.parking;
