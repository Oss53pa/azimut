# Complément au cahier des charges de développement
## Azimut, partie N. Cahier des charges détaillé par module

Éditeur : Atlas Studio

Cette partie spécifie les douze modules. Elle s'appuie sur la partie L pour la propriété des données et l'intégration, et sur la partie M pour les règles d'écran. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## N0. Profondeur et méthode

La profondeur suit l'ordre de construction.

| Modules | Profondeur | Motif |
| --- | --- | --- |
| 01, 02, 04 | Champ et règle | Se construisent maintenant, tout en dépend |
| 03, 12 | Règle et contrôle | Incrément suivant |
| 05 à 11 | Règle et frontière | Deux ans ou plus, seraient réécrits |

Chaque fiche suit la même structure : rôle et frontière, entités, règles métier numérotées, contrôles, écrans, intégration, critères d'acceptation, points ouverts.

Une règle numérotée est opposable. Elle se cite dans une revue de code et dans un test.

---

# Module 01. Socle du site

## N1.1 Rôle et frontière

Porter la réalité physique et locative du site.

**Dans le périmètre.** Sites, bâtiments, niveaux, zones, plans de fond et calage, empreintes, volumes, ouvertures, graphe de circulation, annuaire des occupants, couche d'habillage, composition de page.

**Hors périmètre.** Toute interprétation. Le socle décrit ce qui existe, il ne dit ni ce qu'il faut afficher, ni où poser un support, ni comment un visiteur circule. Ces trois questions appartiennent aux modules 02 et 03.

## N1.2 Entités et champs non encore spécifiés

Les tables figurent en partie A. Les champs ci-dessous complètent ou précisent.

**`site`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `origin_x`, `origin_y` | numérique | Point de référence du repère site, fixé au premier calage, jamais modifié ensuite |
| `active_langs` | tableau | Au moins une, `fr` et `en` seules valeurs admises en V1 |
| `reference_elevation_m` | numérique | Altitude du niveau de référence, à laquelle Z vaut 0 |

**`building`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `independent_access` | booléen | Faux par défaut |
| `opening_hours` | structure | Par jour, plusieurs plages possibles, fuseau du site |
| `default_edge_width_m` | numérique | Largeur héritée par les arêtes du bâtiment |

**`level`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `ordinal` | entier | Unique par bâtiment, négatif admis pour les sous-sols |
| `elevation_m` | numérique | Relative à `reference_elevation_m` |

**`footprint`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `kind` | énuméré | `cell`, `circulation`, `technical`, `vertical_core`, `outdoor` |
| `unit_code` | texte | Requis si `kind = cell`, unique par niveau |
| `geometry` | polygone | Simple, fermé, non auto-intersectant, au moins 3 sommets, surface au-dessus de la tolérance |

**`destination`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `occupancy_status` | énuméré | `occupied`, `vacant`, `reserved`, `under_fit_out` |
| `display_priority` | entier | 1 à 9, 1 le plus fort, sert au module 02 pour arbitrer une face trop chargée |
| `valid_from`, `valid_to` | date | Historique conservé, une cellule peut avoir plusieurs occupants successifs |

## N1.3 Règles métier

**S1.** Le repère site est fixé au premier calage et n'est jamais modifié. Le modifier invaliderait toute géométrie déjà saisie.

**S2.** Aucune coordonnée en pixels n'est stockée. La conversion se fait à l'affichage, jamais en base.

**S3.** Une empreinte de nature `cell` porte obligatoirement un code de cellule. Les autres natures ne l'exigent pas.

**S4.** Une destination est rattachée à une empreinte et à un nœud d'accès. Sans nœud d'accès, elle est inatteignable et le module 02 le signalera.

**S5.** L'historique d'occupation est conservé. Une cellule qui change d'occupant ne perd pas la trace du précédent, ce qui alimente les modules 03 et 09.

**S6.** La longueur d'une arête est calculée, jamais saisie, et recalculée à toute modification de position.

**S7.** La couche d'habillage ne participe à aucun calcul. Elle n'apparaît dans aucun quantitatif, aucune zone cliquable, aucun parcours.

**S8.** La légende et la rose des vents ne sont pas dessinées. Elles sont générées depuis les catégories présentes et depuis l'orientation. Seule leur position est composée.

**S9.** Un plan de fond remplacé sans recalage conserve son calage uniquement si les dimensions concordent. Sinon, avertissement et proposition de recaler.

## N1.4 Contrôles

Ceux de `validateGraph` en partie A, plus les contrôles géométriques de la partie M.

Ajouts propres au module :

| Situation | Code | Gravité |
| --- | --- | --- |
| Cellule sans code | `DATA.UNIT_CODE_REQUIRED` | bloquant |
| Deux cellules de même code sur un niveau | `DATA.CODE_DUPLICATE` | bloquant |
| Niveau sans plan calé | `CALIB.LEVEL_NOT_CALIBRATED` | bloquant |
| Destination sans dénomination dans une langue active | `LAYOUT.LANG_VARIANT_MISSING` | avertissement |
| Bâtiment sans accès ni liaison | `GRAPH.BUILDING_ISOLATED` | avertissement |

## N1.5 Écrans

Spécifiés en partie M pour l'import, le calage, le tracé et le graphe. Restent à spécifier, selon les règles de M7 : annuaire des occupants, habillage, composition de page, fiche de site.

## N1.6 Intégration

Lit : rien. Produit : graphe validé, annuaire, scène géométrique. Consommé par : tous. Non optionnel.

## N1.7 Critères d'acceptation

1. Un site modélisé se recharge à l'identique, géométrie et graphe compris.
2. Aucune coordonnée en pixels en base, vérifié par analyse du schéma.
3. `validateGraph` détecte chacun de ses cas sur un site de référence dédié, et ne le détecte pas sur le site voisin.
4. L'historique d'occupation survit à trois changements successifs sur une même cellule.

## N1.8 Ouvert

Le format d'échange du graphe vers l'extérieur, reporté faute de vérification du support réel par les outils des clients.

---

# Module 02. Wayfinding

## N2.1 Rôle et frontière

Décider ce que l'on dit, où, et dans quel ordre.

**Dans le périmètre.** Zonage d'orientation, nomenclature, hiérarchie de l'information, plan de jalonnement, tableau des messages, implantation des supports, audit de couverture.

**Hors périmètre.** L'apparence des supports, leurs cotes de fabrication, leur substrat. Module 04.

**Frontière avec le socle.** Une zone d'orientation n'est pas une zone technique. Un même espace peut relever de deux zones d'orientation différentes selon le parcours, ce qu'une zone du socle ne permet pas.

## N2.2 Entités et champs

**`orientation_zone`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `code` | texte | Unique par site, 1 à 8 caractères |
| `name_fr`, `name_en` | texte | Requis dans chaque langue active |
| `kind` | énuméré | `mall`, `entrance`, `core`, `service`, `outdoor` |
| `footprint_ids` | tableau | Empreintes couvertes, recouvrement admis |

**`naming_rule`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `target` | énuméré | `level`, `zone`, `door`, `core`, `parking` |
| `pattern` | texte | Modèle de nommage, avec jetons |
| `max_length` | entier | Longueur maximale compatible avec les supports |
| `uniqueness_scope` | énuméré | `site`, `building`, `level` |

**`information_level`**

Rattache une typologie de support à un ou plusieurs des quatre niveaux : identification, orientation, direction, confirmation.

**`wayfinding_sequence`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `profile_id` | référence | Profil du module 03 |
| `ordinal` | entier | Ordre de rencontre le long du parcours |
| `node_id` | référence | Point de décision |
| `expected_level` | entier | Niveau d'information attendu à ce point |

**`message_schedule`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `version` | entier | Incrémenté à chaque génération |
| `state` | énuméré | `draft`, `in_review`, `approved`, `superseded` |
| `inputs_hash` | texte | Empreinte du graphe et de l'annuaire ayant servi |
| `generated_at` | horodatage | |

**`message_line`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `support_id`, `face_index`, `block_index` | références | Localisent la ligne |
| `content` | structure | Une valeur par langue active |
| `pictogram_id` | référence | Facultatif |
| `direction` | énuméré | `left`, `right`, `ahead`, `up`, `down`, `back`, aucune |
| `information_level` | entier | 1 à 4 |
| `decision_point_id` | référence | **Requis.** La ligne qui la justifie |
| `stale` | booléen | Dérivé, recalculé, jamais saisi |

**`support`, attributs d'implantation** (propriété module 02 selon la partie L)

| Champ | Type | Contrainte |
| --- | --- | --- |
| `node_id` | référence | Requis |
| `azimuth_deg` | numérique | 0 à 360 exclus, convention compas |
| `typology_id` | référence | Requis |
| `reading_distance_m` | numérique | Supérieur à 0 |
| `information_levels` | tableau | Au moins un |

## N2.3 Règles métier

**W1.** Le nommage est une donnée, jamais une saisie libre au moment de composer un panneau.

**W2.** Une règle de nommage déclarée est vérifiée à toute création. Une collision lève une anomalie bloquante, y compris entre bâtiments.

**W3.** Tout support porte au moins un niveau d'information. Un support qui n'en porte aucun existe sans raison.

**W4.** Toute ligne du tableau des messages référence le point de décision qui la justifie. Une ligne sans justification est une anomalie bloquante. C'est cette règle qui empêche un panneau de dire quelque chose que rien ne motive.

**W5.** Continuité du message. Une destination annoncée à un point de décision doit être reprise ou confirmée au point suivant du même parcours, jusqu'à ce qu'elle soit atteinte. La rupture est l'erreur de wayfinding la plus fréquente et la moins visible.

**W6.** Le tableau des messages est généré depuis le graphe, le jalonnement et l'annuaire. Il n'est jamais saisi à la main. Un bloc explicitement typé libre est la seule exception.

**W7.** Le tableau des messages est versionné et validé selon le même circuit que les bons à tirer. C'est lui que valide la maîtrise d'ouvrage, avant tout dessin.

**W8.** Toute modification du graphe ou de l'annuaire marque périmées les seules lignes concernées. Ni plus, ni moins.

**W9.** Le nombre de destinations affichables sur une face est plafonné par le paquet de règles. Au-delà, l'arbitrage se fait par `display_priority`, et l'écartement est tracé, jamais silencieux.

**W10.** Aucun taux de couverture n'est publié tant que la validation de complétude du graphe échoue.

## N2.4 Contrôles

| Situation | Code | Gravité |
| --- | --- | --- |
| Collision de nommage | `WAYFIND.NAMING_COLLISION` | bloquant |
| Continuité rompue | `WAYFIND.CONTINUITY_BROKEN` | bloquant |
| Support sans niveau d'information | `WAYFIND.NO_INFORMATION_LEVEL` | bloquant |
| Ligne sans point de décision | `WAYFIND.LINE_UNJUSTIFIED` | bloquant |
| Tableau périmé | `WAYFIND.SCHEDULE_STALE` | avertissement |
| Trop de destinations sur une face | `WAYFIND.TOO_MANY_DESTINATIONS` | bloquant |
| Point de décision non couvert | `GRAPH.DECISION_POINT_UNCOVERED` | bloquant |
| Support ne servant aucun parcours | `GRAPH.SUPPORT_UNUSED` | avertissement |

`WAYFIND.LINE_UNJUSTIFIED` et `GRAPH.DECISION_POINT_UNCOVERED` sont à ajouter au catalogue.

## N2.5 Écrans

| Écran | Famille | Note |
| --- | --- | --- |
| Zonage et nomenclature | Atelier | Tracé de zones, règles de nommage, détection de collisions |
| Hiérarchie de l'information | Registre | Rattachement typologies et niveaux |
| Plan de jalonnement | Atelier | Séquence par profil, points de décision ordonnés |
| Implantation des supports | Atelier | Pose, azimut, typologie, proposition automatique |
| **Tableau des messages** | Registre | Écran central, spécification propre à produire |
| Audit de couverture | Document | Anomalies groupées, liens vers entités |

Le tableau des messages mérite une spécification au champ près, au même titre que la tranche de la partie M. C'est l'écran que la maîtrise d'ouvrage regardera le plus longtemps, et celui qui débloque la composition.

## N2.6 Intégration

Lit : socle, plus profils et points de décision du module 03. Produit : tableau des messages, jalonnement, audit de couverture, implantation. Consommé par : 04, 09.

Dégradation : sans module 03, un profil par défaut unique, non paramétrable, signalé à l'écran.

Non optionnel. Sans tableau des messages, la signalétique n'a aucun producteur de contenu.

## N2.7 Critères d'acceptation

1. Sur un site de référence, le tableau des messages généré est exactement celui attendu, ligne pour ligne.
2. Une destination modifiée marque périmées les seules lignes qui la citent. Le test échoue si une ligne non concernée est marquée.
3. Une continuité rompue est détectée sur un site conçu pour la produire, et non détectée sur le site voisin.
4. Une ligne sans point de décision ne peut pas être créée.
5. Le tableau s'exporte en tableur et en document, avec un identifiant stable par ligne, deux exports identiques donnant des fichiers identiques.

## N2.8 Ouvert

Les valeurs plafonds du paquet de règles, qui dépendent du corpus normatif non établi. En leur absence, le contrôle de W9 ne s'exécute pas et le signale.

---

# Module 03. Parcours clients

## N3.1 Rôle et frontière

Analyser les flux et l'exposition. Acteur : direction commerciale.

**Frontière ferme.** Le module produit des indices relatifs entre cellules d'un même site. Il ne produit jamais un nombre de visiteurs, ni une prévision de chiffre d'affaires pour une enseigne non installée.

## N3.2 Règles métier

**P1.** Les pondérations sont déclarées, jamais devinées par l'outil : part de fréquentation par accès, pouvoir d'attraction par destination motrice, cône de visibilité par typologie de circulation.

**P2.** L'exposition d'une cellule est le nombre de parcours calculés passant devant elle, pondérés par ces trois facteurs.

**P3.** Le résultat est un indice relatif et un rang, jamais une valeur absolue.

**P4.** Un résultat de flux ne s'exporte jamais sans les hypothèses qui l'ont produit. Anomalie bloquante.

**P5.** Les montants ne sont calculés que si la corrélation entre exposition et performance réelle atteint le seuil déclaré. En dessous, seuls les écarts d'exposition sont produits, et l'interface le dit.

**P6.** Les données réelles importées, comptage, télémétrie, chiffre d'affaires déclaré, ne sont jamais produites par Azimut. Leur origine et leur date sont conservées.

**P7.** Une comparaison de scénarios porte toujours sur deux états du même site, jamais sur une référence externe.

## N3.3 Contrôles

| Situation | Code | Gravité |
| --- | --- | --- |
| Export sans hypothèses | `FLOW.HYPOTHESIS_MISSING` | bloquant |
| Pondérations non déclarées | `FLOW.WEIGHTS_UNDECLARED` | bloquant |
| Somme des parts différente de 100 % | `FLOW.WEIGHTS_NOT_NORMALIZED` | bloquant |
| Corrélation insuffisante pour un montant | `FLOW.CORRELATION_TOO_LOW` | bloquant |

Les deux derniers sont à ajouter au catalogue.

## N3.4 Écrans

Profils, hypothèses, carte d'exposition, comparaison de scénarios, rapport de flux.

## N3.5 Intégration

Lit : socle, plus surfaces et loyers du module 09 si souscrit. Produit : parcours, points de décision, exposition. Consommé par : 02, 05, 09.

## N3.6 Critères d'acceptation

1. Deux calculs sur les mêmes hypothèses donnent le même résultat.
2. Modifier une pondération change l'indice, et le rapport le mentionne.
3. Un export tenté sans hypothèses échoue avec son code.
4. Un montant est refusé tant que la corrélation est sous le seuil.

## N3.7 Ouvert

La méthode de pondération est défendable, non validée par un professionnel de la commercialisation. C'est un préalable à la vente d'un audit chiffré.

---

# Module 04. Signalétique

## N4.1 Rôle et frontière

Produire les supports fabricables à partir du tableau des messages.

**Frontière avec le module 02.** Il reçoit le contenu et l'implantation. Il ne les décide pas et ne peut pas les modifier.

## N4.2 Entités et champs

**`support_typology`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `key` | texte | Unique par organisation |
| `face_count` | entier | 1 à 4 |
| `template_key` | référence | Gabarit par défaut |
| `default_substrate` | texte | |
| `registry` | énuméré | `wayfinding` ou `safety` |

**`support`, attributs de fabrication**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `width_mm`, `height_mm` | entier | Calculés par défaut |
| `dimensions_source` | énuméré | `computed` ou `overridden` |
| `substrate_key` | texte | |
| `mounting` | structure | Type de fixation, hauteur, dégagement |

**`content_block`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `kind` | énuméré | `resolved`, `free`, `pictogram`, `map`, `legend` |
| `binding` | structure | Pour `resolved` : référence à `message_line` |
| `free_text` | structure | Pour `free` uniquement, une valeur par langue |

## N4.3 Règles métier

**G1.** Un bloc `resolved` référence une `message_line`. Il ne résout jamais depuis le graphe directement.

**G2.** Un bloc `free` est le seul dont le texte est saisi.

**G3.** Le format est calculé depuis le contenu, la distance de lecture et la variante linguistique la plus longue. `overridden` est un choix explicite qui déclenche un contrôle bloquant si le résultat n'est pas conforme.

**G4.** Aucune valeur normative dans le code. Hauteur de caractère, contraste, dimensions de pictogramme viennent du paquet de règles.

**G5.** Le registre de sécurité est verrouillé. Aucune charte ne peut en modifier une couleur, une géométrie, un pictogramme ou une proportion. Le moteur refuse, il n'avertit pas.

**G6.** Un plan mural n'est pas un fichier mais une famille de fichiers, un par implantation, orienté selon l'azimut du support.

**G7.** Une version approuvée est immuable. Une correction crée une nouvelle version.

**G8.** Un contrôle bloquant empêche l'émission d'une épreuve. Il ne peut être ni ignoré, ni accepté, ni reporté.

**G9.** Le rendu est déterministe. Deux compilations du même état produisent des fichiers identiques.

**G10.** Les plans d'évacuation sont un livrable nommé, avec leurs propres règles d'orientation, de légende et de contenu.

## N4.4 Contrôles

Ceux du domaine `LAYOUT` en partie D, plus `SECURITY.REGISTRY_WRITE_DENIED` et `SECURITY.CHARTER_OVERRIDE_DENIED`.

## N4.5 Écrans

Implantation en lecture, composition de face, contrôle de face, plans muraux, plans d'évacuation, bons à tirer, quantitatif.

L'écran de contrôle de face n'autorise aucune édition libre. Sa spécification figure en partie F.

## N4.6 Intégration

Lit : `message_line` du module 02, scène et annuaire du socle, charte, paquet de règles. Produit : exécutions, quantitatif, bons à tirer. Consommé par : 07, 08, 09.

Dégradation : sans module 02, ne fonctionne pas. Sans paquet de règles, refuse de composer et le dit.

## N4.7 Critères d'acceptation

1. Un carnet complet est accepté par un fabricant réel.
2. Deux compilations du même état produisent des fichiers identiques, octet pour octet.
3. Toute tentative de modification du registre de sécurité échoue, un test par voie de contournement.
4. Deux supports d'azimut différent produisent deux plans différents, la destination physiquement devant le support apparaissant dans la moitié supérieure.
5. Une version approuvée résiste à toute tentative de modification, y compris avec le rôle d'administration.

## N4.8 Ouvert

Le déterminisme de la sortie PDF, non acquis, tranché par la tâche T-0.9.
