-- A5.2 — une zone porte ses empreintes.
--
-- « footprint_ids : empreintes couvertes par la zone, appartenance déclarée et
-- non calculée, comme pour la zone d'orientation de la partie H. »
--
-- La table `zone` n'avait ni géométrie ni liste d'empreintes. L'appartenance
-- d'une empreinte à une zone n'était donc pas exprimable, et
-- `DATA.PARKING_SPACE_WITHOUT_ZONE` — « place de stationnement hors de toute
-- zone de nature `parking` » — n'était pas calculable. Cette colonne la rend
-- calculable.
--
-- **Déclarée, non calculée**, et la section le dit deux fois. C'est le choix
-- inverse de celui de la règle M02.W12, où l'appartenance d'un support à une
-- zone d'orientation se calcule depuis la position de son nœud. Les deux
-- coexistent sans se contredire : un support est un point, une empreinte est
-- une surface, et deux surfaces qui se recouvrent partiellement n'ont pas de
-- réponse évidente. La déclarer évite d'inventer un seuil de recouvrement
-- qu'aucune section ne donne.
--
-- La forme suit celle d'`orientation_zone.footprint_ids` d'H11, qui porte déjà
-- la même liste pour les zones d'orientation. Deux formes différentes pour la
-- même chose auraient fini par diverger.
--
-- **Aucune clé étrangère**, pour la raison qu'une liste en `jsonb` ne peut pas
-- en porter. La contrainte vérifie la forme — un tableau d'identifiants — non
-- l'existence des empreintes citées. Une empreinte supprimée laisse donc un
-- identifiant orphelin dans la liste, et c'est aux contrôles de le voir.
--
-- Additive : colonne nouvelle, valeur par défaut au tableau vide, aucune ligne
-- existante transformée. Une zone sans empreinte déclarée est un état
-- légitime, celui de toutes les zones existantes.

ALTER TABLE azimut.zone
  ADD COLUMN footprint_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Un tableau, et rien de plus au niveau de la base.
--
-- La forme des éléments n'est pas vérifiée ici, et l'écrire une première fois
-- l'a montré : une contrainte de vérification ne peut pas porter de
-- sous-requête, et parcourir un tableau `jsonb` en exige une. La contourner par
-- une fonction déclarée immuable mettrait la validation hors de vue, dans un
-- objet que rien ne rattache à la table.
--
-- Le dépôt a déjà tranché ce partage pour `footprint.geometry`, qui est un
-- `jsonb` sans contrainte de structure en base : la forme se valide à la
-- frontière, par `zod`, et la base garantit le type du contenant. Deux
-- politiques différentes pour deux colonnes `jsonb` de la même partie
-- auraient fini par se contredire.
ALTER TABLE azimut.zone
  ADD CONSTRAINT zone_footprint_ids_is_array
  CHECK (jsonb_typeof(footprint_ids) = 'array');
