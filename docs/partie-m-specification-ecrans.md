# Complément au cahier des charges de développement
## Azimut, partie M. Spécification d'écran, première tranche verticale

Éditeur : Atlas Studio

Cette partie spécifie cinq écrans, qui forment une chaîne complète : ouvrir un site, importer et caler un plan, tracer des empreintes, saisir le graphe, obtenir la validation de complétude.

Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## M0. Pourquoi une tranche, et pas les douze modules

Les documents précédents donnent les jetons, la typographie, trois familles de mise en page et un inventaire d'écrans à une ligne chacun. Aucun écran n'est spécifié. L'agent de développement ne pouvait donc produire que la navigation, et il a eu raison de ne pas inventer le reste.

Spécifier les soixante écrans maintenant produirait un texte réécrit avant d'être lu. Spécifier une chaîne complète produit deux choses immédiatement utiles.

D'abord un apprentissage réel : une tranche qui fonctionne dit en deux semaines si la saisie est rapide, si la densité tient, et si le temps de mise en service d'un site est tenable. C'est l'indicateur économique central du produit, et aucun document ne peut y répondre.

Ensuite un modèle. Les écrans de cette partie deviennent la référence. Les suivants s'y conforment au lieu d'être spécifiés un par un, selon les règles du chapitre M7.

---

## M1. Écran, liste des sites

**Chemin.** `/sites`
**Famille.** Registre.
**Rôles.** Tous. Création réservée à `admin` et `designer`.

### Structure

```
+---------------------------------------------------------------+
| Sites                                    [ Nouveau site ]      |
+---------------------------------------------------------------+
| Recherche                                                      |
+---------------------------------------------------------------+
| Nom            Pays   Niveaux  Cellules  Anomalies  Modifie le |
| ...                                                            |
+---------------------------------------------------------------+
```

### Colonnes

| Colonne | Source | Format |
| --- | --- | --- |
| Nom | `site.name` | texte |
| Pays | `site.country_code` | code sur deux lettres |
| Niveaux | compte | entier |
| Cellules | compte des empreintes de type cellule | entier |
| Anomalies | compte des bloquantes | entier, pastille `state-blocking` si supérieur à 0 |
| Modifié le | `site.updated_at` | date courte |

### Formulaire de création

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Nom du site | texte | requis, 2 à 120 caractères, unique dans l'organisation | `DATA.NAME_REQUIRED`, `DATA.NAME_DUPLICATE` |
| Pays | sélecteur | requis | `DATA.COUNTRY_REQUIRED` |
| Paquet de règles | sélecteur | facultatif à la création | avertissement `RULES.PACK_NOT_BOUND` |
| Langues actives | choix multiple | au moins une, français et anglais proposés | `DATA.LANG_REQUIRED` |

Créer un site crée aussi un premier bâtiment et un premier niveau, nommés par défaut et renommables. Un site sans niveau est un état inutile que l'utilisateur devrait corriger lui-même.

### États

| État | Traitement |
| --- | --- |
| Vide | Titre court, une phrase expliquant qu'un site contient les plans et le graphe, bouton de création en évidence |
| Chargement | Structure d'attente calquée sur les lignes du tableau |
| Erreur | Cause et action de reprise |
| Hors ligne | Bandeau, sites déjà ouverts localement accessibles, création indisponible et dite telle |
| Droit refusé | Liste visible, bouton de création absent, non grisé |

---

## M2. Écran, import et calage de plan

C'est l'écran d'entrée réel du produit, et le plus important de la tranche. Tout le reste en dépend.

**Chemin.** `/sites/:siteId/levels/:levelId/plan`
**Famille.** Atelier.
**Rôles.** `designer`, `admin`.

### Structure

```
+---------------------------------------------------------------+
| Azimut | Site | Niveau R+1                      [ Valider ]    |
+--------+------------------------------------------+-----------+
| Etapes |                                          | Calage    |
| 1 Fond |                                          |           |
| 2 Echel|         zone de travail                  | Point A   |
| 3 Nord |         plan affiche                     | Point B   |
|        |                                          | Distance  |
|        |                                          | Nord      |
|        |                                          |           |
|        |                                          | Echelle   |
+--------+------------------------------------------+-----------+
| Echelle 1:200  |  x 12,340 m  y 8,221 m  |  Hors ligne         |
+---------------------------------------------------------------+
```

### Étape 1, fond de plan

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Fichier | dépôt ou sélection | PDF, PNG, JPG, DWG. 60 Mo maximum | `IMPORT.FILE_TOO_LARGE`, `IMPORT.FORMAT_UNSUPPORTED` |
| Page | sélecteur | si PDF multipage, requis | `IMPORT.PAGE_REQUIRED` |

Pour un fichier de CAO, la qualification décrite en partie D s'exécute avant tout import et affiche son rapport : proportion de polylignes fermées, calques exploitables, cohérence des unités, références manquantes, doublons, nombre de niveaux. En dessous du seuil, l'écran recommande explicitement le calage manuel et propose les deux voies sans en imposer une.

### Étape 2, échelle

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Point A | clic dans la zone de travail | requis | `CALIB.POINT_REQUIRED` |
| Point B | clic dans la zone de travail | requis, distinct de A d'au moins 40 pixels | `CALIB.POINTS_TOO_CLOSE` |
| Distance réelle | numérique, mètres | requis, supérieur à 0, 3 décimales | `CALIB.DISTANCE_INVALID` |

Calculé et affiché en lecture seule : échelle en pixels par mètre, et son équivalent en échelle de plan arrondie à la valeur courante la plus proche, 1:100, 1:200, 1:500.

Contrôle d'invraisemblance : une échelle hors de la plage 0,05 à 500 pixels par mètre lève `CALIB.SCALE_IMPLAUSIBLE` en avertissement. L'utilisateur peut passer outre, la valeur étant parfois légitime sur un extrait.

### Étape 3, orientation

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Azimut du nord | numérique, degrés | 0 à 360 exclus, convention compas | `CALIB.AZIMUTH_INVALID` |
| ou Tracé de la flèche nord | geste dans la zone de travail | alternative au champ | |

Les deux voies écrivent la même donnée. La saisie numérique est le moyen le plus précis et le seul accessible au clavier, elle n'est donc jamais secondaire.

### Actions

| Action | Effet |
| --- | --- |
| Valider le calage | Écrit `plan_calibration`, débloque le tracé |
| Recaler | Reprend à l'étape 2, conserve le fond |
| Remplacer le fond | Conserve le calage si les dimensions concordent, sinon avertit et propose de recaler |

Remplacer un fond sans recaler est le geste qui décale silencieusement toute une modélisation. Il demande donc une confirmation nommant la conséquence.

### Raccourcis

| Touche | Action |
| --- | --- |
| Espace maintenu | Déplacement de la vue |
| Molette | Zoom |
| `0` | Ajuster à la fenêtre |
| `Entrée` | Étape suivante |
| `Échap` | Annuler le point en cours |

### États

| État | Traitement |
| --- | --- |
| Vide | Zone de dépôt centrée, formats acceptés énoncés, mention du calage manuel possible sans fichier de CAO |
| Chargement | Progression réelle du téléversement, annulable |
| Partiel | Fond chargé, calage incomplet : le tracé reste inaccessible et l'écran dit pourquoi |
| Erreur | Cause et reprise, le fichier déjà téléversé n'est jamais perdu |
| Hors ligne | Import local possible, téléversement différé, état visible dans la barre |
| Droit refusé | Plan en lecture, outils absents |

### Critères d'acceptation

1. Un plan calé restitue une distance connue à moins de 1 % d'erreur.
2. Le calage rejoué sur les mêmes points donne exactement le même résultat.
3. Aucune coordonnée en pixels n'est écrite en base.
4. Le parcours complet est réalisable au clavier seul.
5. Un remplacement de fond sans recalage demande une confirmation nommant la conséquence.

---

## M3. Écran, tracé des empreintes

**Chemin.** `/sites/:siteId/levels/:levelId/footprints`
**Famille.** Atelier.

### Structure

```
+---------------------------------------------------------------+
| Azimut | Site | Niveau R+1            3 empreintes             |
+--------+-----+------------------------------------+-----------+
| Calques| out |                                    | Proprietes|
| Fond   | ils |        zone de travail             |           |
| Cellul |     |                                    | Code      |
| Circul |     |                                    | Categorie |
|        |     |                                    | Surface   |
|        |     |                                    |           |
+--------+-----+------------------------------------+-----------+
| Echelle | x y | Magnetisme actif | 0 anomalie                  |
+---------------------------------------------------------------+
```

### Outils

| Outil | Touche | Comportement |
| --- | --- | --- |
| Sélection | `V` | Sélection simple, additive, par rectangle |
| Cellule | `C` | Polygone contraint aux angles droits, libérable par `Alt` |
| Polygone libre | `P` | Sans contrainte d'angle |
| Rectangle | `R` | Deux points opposés |
| Sommet | `A` | Édition de sommet |

### Propriétés d'une empreinte

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Code de cellule | texte | requis, unique par niveau, 1 à 20 caractères | `DATA.CODE_DUPLICATE` |
| Nature | sélecteur | cellule, circulation, technique, noyau vertical | requis |
| Catégorie | sélecteur | facultative à ce stade | |
| Surface | calculé | lecture seule, m2, 1 décimale | |
| Coordonnées des sommets | numérique | saisissables individuellement, mètres, 3 décimales | |

La saisie numérique des sommets est le moyen le plus précis et le seul accessible au clavier. Elle figure dans le panneau, pas dans un menu secondaire.

### Contrôles à la saisie

| Situation | Code | Effet |
| --- | --- | --- |
| Polygone auto-intersectant | `GEOM.POLYGON_SELF_INTERSECTING` | Refus, le tracé reste en cours |
| Moins de 3 sommets | `GEOM.POLYGON_TOO_FEW_VERTICES` | Refus |
| Surface sous tolérance | `GEOM.POLYGON_DEGENERATE` | Refus |
| Empreintes superposées | `GEOM.FOOTPRINTS_OVERLAP` | Avertissement, tracé accepté |

Un refus n'efface jamais le travail en cours. Il empêche la validation et dit pourquoi.

### Actions en série

Alignement, répartition, duplication en série le long d'un axe, suppression groupée. La duplication en série est l'action qui fait gagner le plus de temps sur une galerie à trame régulière, elle est en évidence et non enfouie.

### Raccourcis

| Touche | Action |
| --- | --- |
| `Entrée` | Fermer le polygone en cours |
| `Échap` | Abandonner le tracé en cours |
| `Retour arrière` | Supprimer le dernier sommet |
| Flèches | Déplacer la sélection de 0,01 m |
| Maj + flèches | Déplacer de 0,10 m |
| `Ctrl+Z` | Annuler |
| `Ctrl+D` | Dupliquer |

### États

| État | Traitement |
| --- | --- |
| Vide | Plan calé visible, invitation à tracer la première cellule, outil cellule déjà actif |
| Partiel | Empreintes sans code signalées, non bloquant à ce stade |
| Hors ligne | Tracé possible, indicateur de synchronisation en attente |
| Droit refusé | Empreintes visibles, outils absents |

### Critères d'acceptation

1. Un polygone auto-intersectant est refusé avec son code, et le tracé en cours est conservé.
2. Les coordonnées stockées sont en mètres, quantifiées au millimètre.
3. Une empreinte tracée à la souris et la même saisie au clavier produisent des données identiques.
4. La duplication en série de 20 cellules se fait en une commande annulable d'un seul geste.

---

## M4. Écran, saisie du graphe

**Chemin.** `/sites/:siteId/levels/:levelId/graph`
**Famille.** Atelier.

### Outils

| Outil | Touche | Comportement |
| --- | --- | --- |
| Nœud | `N` | Le type se choisit avant le geste, jamais après |
| Arête | `E` | Relie deux nœuds, ou crée les nœuds manquants aux extrémités |
| Axe de circulation | `X` | Tracé continu produisant nœuds et arêtes en une passe |
| Liaison verticale | `L` | Relie deux nœuds de niveaux différents |

### Propriétés d'un nœud

| Champ | Type | Contrainte |
| --- | --- | --- |
| Type | sélecteur | requis, parmi la liste fermée de la partie A |
| Libellé | texte | facultatif |
| Position | numérique, mètres | saisissable |

### Propriétés d'une arête

| Champ | Type | Contrainte | Défaut |
| --- | --- | --- | --- |
| Largeur utile | numérique, mètres | supérieure à 0 | hérité du niveau |
| Pente | numérique, pourcentage | -20 à +20 | 0 |
| Accessible | booléen | | vrai |
| Sens | sélecteur | les deux, aller, retour | les deux |
| Cheminement d'évacuation | booléen | | faux |
| Disponibilité horaire | plage | facultative | héritée du bâtiment |
| Longueur | calculé | lecture seule, jamais saisissable | |

La longueur est recalculée à toute modification de position. Un champ de longueur saisissable serait une source permanente d'incohérence.

### Contrôles à la saisie

| Situation | Code | Effet |
| --- | --- | --- |
| Arête reliant un nœud à lui-même | `GRAPH.EDGE_SELF_LOOP` | Refus |
| Longueur sous tolérance | `GRAPH.EDGE_ZERO_LENGTH` | Refus |
| Arête entre niveaux sans liaison verticale | `GRAPH.VERTICAL_LINK_MISSING` | Refus, avec proposition de créer la liaison |

### Affichage

Les nœuds sont différenciés par leur forme, jamais par la seule couleur. Les arêtes non accessibles sont tracées en trait interrompu. Les cheminements d'évacuation portent un liseré distinct. Aucune de ces distinctions ne repose sur la couleur seule, contrôle vérifié en niveaux de gris.

### Critères d'acceptation

1. Un axe tracé en une passe produit les nœuds et arêtes attendus, sans doublon.
2. La longueur n'est jamais saisissable et se recalcule à chaque déplacement.
3. Une arête inter-niveaux sans liaison verticale est refusée avec proposition de correction.
4. Le graphe complet est saisissable au clavier seul.

---

## M5. Écran, validation de complétude

**Chemin.** `/sites/:siteId/validation`
**Famille.** Document.

### Structure

```
+---------------------------------------------------------------+
| Validation du graphe                      [ Relancer ]         |
+---------------------------------------------------------------+
| 3 bloquantes   2 avertissements   1 information                |
+---------------------------------------------------------------+
| Bloquantes                                                     |
|   Noeud N-12  Relie a aucune arete                Ouvrir       |
|   ...                                                          |
+---------------------------------------------------------------+
```

### Contenu

Anomalies groupées par entité, ordonnées par gravité décroissante. Chaque ligne porte le libellé issu du dictionnaire, l'entité concernée, et un lien qui ouvre la zone de travail centrée sur elle avec la sélection déjà faite.

Une anomalie d'origine normative affiche sa référence documentaire. Une anomalie normative sans référence visible est un défaut, pas un détail de présentation.

### Règle

Aucun taux de couverture n'est affiché tant que la validation de complétude échoue. Le compteur correspondant indique que le calcul est conditionné, il n'affiche jamais zéro ni un tiret.

### Actions

| Action | Effet |
| --- | --- |
| Relancer | Recalcule, affiche la durée réelle |
| Ouvrir | Va à l'entité, sélection faite |
| Exporter | Document ou tableur, avec l'horodatage et la version du paquet de règles |

### États

| État | Traitement |
| --- | --- |
| Vide, aucune anomalie | Constat net, et la mention que la complétude n'est pas la justesse : le graphe est cohérent, pas nécessairement conforme au terrain |
| Chargement | Progression, annulable |
| Jamais lancé | Invitation à lancer, jamais un résultat vide présenté comme un succès |

Ce dernier point importe : un écran vide qui ressemble à une réussite alors que rien n'a été calculé est le pire des états possibles.

---

## M6. Composants employés

Tous figurent dans la liste fermée de la partie F. Cette tranche n'en introduit aucun nouveau.

Champ texte, champ numérique avec unité, champ d'angle, sélecteur, choix multiple, interrupteur, arborescence, tableau de données, barre d'outils, barre d'état, panneau, section repliable, pastille d'état, ligne d'anomalie, bandeau, indicateur de progression, bouton principal, secondaire, discret, d'icône, menu contextuel, boîte de dialogue, vue, cadre de sélection, poignées, guides, règles.

Si un écran de cette tranche semble exiger un composant absent de la liste, c'est l'écran qu'il faut revoir, pas la liste qu'il faut étendre.

---

## M7. Règles que les écrans suivants reprennent

Ces onze règles sont extraites de la tranche. Tout écran construit ensuite s'y conforme, sans qu'il soit nécessaire de le spécifier en entier.

1. Les six états sont traités. Un écran qui ne traite que le cas nominal est incomplet.
2. Toute valeur saisissable au pointeur l'est aussi au clavier, en numérique, dans le panneau et non dans un menu secondaire.
3. Toute valeur calculée est en lecture seule, et son caractère calculé est visible.
4. Tout champ dimensionnel affiche son unité.
5. Un refus de saisie n'efface jamais le travail en cours.
6. Une anomalie porte son entité, un lien vers elle, et sa référence normative le cas échéant.
7. Aucune information n'est portée par la seule couleur.
8. L'indicateur de focus est distinct de l'indicateur de sélection.
9. Une action irréversible ou à conséquence lointaine demande une confirmation qui nomme la conséquence.
10. L'accent ne signale que ce que le logiciel a calculé.
11. Aucun résultat vide n'est présenté comme un succès si le calcul n'a pas eu lieu.

---

## M8. Critères d'acceptation de la tranche entière

Ce qui compte n'est pas que chaque écran existe, mais que la chaîne fonctionne.

1. Un opérateur part d'un site vide, importe un plan, le cale, trace trois cellules, pose quatre nœuds, trace les arêtes, lance la validation, et obtient un résultat cohérent. Sans aide, sans documentation.
2. Le même parcours est réalisable au clavier seul.
3. Le même parcours est réalisable hors ligne, avec synchronisation au retour du réseau.
4. **Le temps du parcours est mesuré et consigné.** C'est le premier relevé de l'indicateur économique central du produit, et il sert de base à toutes les révisions ultérieures.
5. Conformité AA vérifiée automatiquement sur les cinq écrans.
6. Aucune couleur en dur, aucune valeur d'espacement hors échelle, aucune chaîne de texte écrite dans un composant.

---

## M9. Ce que cette partie ne couvre pas

1. **Les écrans des autres modules.** Ils s'appuieront sur M7, et seront spécifiés en entrant dans leur incrément.
2. **Le tableau des messages.** C'est l'autre écran qui mérite une spécification propre, puisque c'est celui que la maîtrise d'ouvrage regardera le plus longtemps. Il vient ensuite.
3. **Les libellés exacts.** Les codes d'anomalie sont stables, leurs libellés dans les deux langues restent à rédiger.
4. **Les seuils d'ergonomie.** Tolérances de magnétisme, pas de déplacement au clavier, durée avant confirmation. Valeurs de départ données, à régler sur usagers réels.
