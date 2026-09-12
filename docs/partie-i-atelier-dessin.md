# Complément au cahier des charges de développement
## Azimut, partie I. Atelier de dessin, transformation des plans, et résolution des points ouverts

Éditeur : Atlas Studio

Cette partie ajoute le module absent de la carte, décrit la chaîne de transformation d'un plan d'architecte en document fini, et traite les sept points laissés ouverts en fin de partie H. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## I0. Deux corrections

**Première correction.** Les capacités d'édition sont spécifiées en partie E, mais comme capacité transverse. Elles n'apparaissent donc dans aucune carte de modules et dans aucun inventaire d'écrans. Un lecteur de la carte conclut légitimement que le produit ne dessine pas. Elles deviennent le module 12.

**Seconde correction.** Aucun document ne décrit la chaîne complète qui va d'un plan d'architecte à un document fini. Les étapes existent, dispersées entre l'import, le tracé, la couche d'habillage et la composition de page. Personne ne peut les reconstituer. La chaîne est décrite en I2.

---

## I1. Module 12, atelier de dessin

### I1.1 Position dans la carte

L'atelier n'est pas un module métier de plus. C'est **la surface de travail commune** des modules 1, 2, 4, 5 et de la couche d'habillage. Il ne se vend pas séparément, il conditionne tous les autres.

Il est régi par la partie E, qui reste la référence pour les trois contextes d'édition, la quantification, le modèle de commande et la sélection accessible. Cette section ajoute ce qui manquait : les écrans, la chaîne de transformation, et le degré d'assistance.

### I1.2 Écrans

| Écran | Famille de mise en page | Objet |
| --- | --- | --- |
| Import et calage | Atelier | Poser le plan source et l'échelle |
| Qualification de fichier | Document | Rapport sur un fichier de CAO avant import |
| Tracé des empreintes | Atelier | Cellules, circulations, noyaux |
| Saisie du graphe | Atelier | Nœuds, arêtes, liaisons |
| Habillage | Atelier | Végétation, voies, mobilier, annotations |
| Composition de page | Atelier | Titre, légende, rose des vents, marges |
| Éditeur de gabarit | Atelier | Grille, zones, liaisons de blocs |
| Bibliothèques | Registre | Symboles, pictogrammes, gabarits, actifs |

---

## I2. La chaîne de transformation

Ce que personne ne pouvait reconstituer jusqu'ici : comment un plan d'architecte devient un document d'orientation fini.

### I2.1 Les sept étapes

**Étape 1, qualification de la source.** Le fichier reçu est analysé avant tout import : proportion de polylignes fermées, calques exploitables, cohérence des unités, références manquantes, doublons superposés, nombre de niveaux dans le fichier. Le rapport annonce un taux d'extraction attendu et recommande, en dessous d'un seuil, le calage manuel plutôt que l'import. Automatique.

**Étape 2, calage.** Le plan devient une référence de fond, calée sur deux points de distance connue, avec son orientation. À partir de cet instant, tout est en mètres dans le repère site. Manuel, quelques minutes.

**Étape 3, extraction ou tracé.** Sur un fichier propre, les empreintes de cellules sont extraites et proposées, puis validées ou corrigées une à une. Sur un fichier ordinaire, elles sont tracées par-dessus la référence de fond. C'est l'étape la plus longue, et c'est elle que l'assistance de I3 vise à raccourcir.

Point à ne pas oublier : un plan d'architecte contient des murs, pas des cellules. Un mur mitoyen est un seul objet là où il faut deux empreintes. Même avec une extraction parfaite, les cellules se reconstruisent.

**Étape 4, graphe.** Tracé des axes de circulation, qui produisent directement nœuds et arêtes, placement des nœuds typés, liaisons verticales, liaisons entre bâtiments. Rien de tout cela n'existe dans un plan d'architecte, puisque personne ne dessine les cheminements.

**Étape 5, rattachement métier.** L'état locatif est importé et rattaché aux empreintes par code de cellule. Les catégories, les occupants et les dénominations dans les deux langues arrivent d'un coup. C'est la charnière : à partir d'ici, le document se régénère au lieu de se redessiner.

**Étape 6, habillage.** Végétation, jardins nommés, voies et voies ferrées hors périmètre, passerelles, bâtiments voisins, logos des enseignes majeures, annotations à filet de rappel. Manuel, une fois, rarement retouché ensuite.

**Étape 7, composition.** Bloc de titre, marges, format de page. La légende et la rose des vents ne sont pas dessinées : elles sont générées depuis les catégories réellement présentes et depuis l'orientation. Seule leur position est composée.

### I2.2 Ce que produit la chaîne

À l'issue, le même modèle sort en plan de niveau coloré par catégorie, en vue isométrique cliquable, en plan mural orienté par implantation, en plan d'évacuation, en fond de borne, en carte d'exposition commerciale, en support de vente publicitaire.

Le gain n'est pas sur la première production, où le temps est comparable à un travail classique. Il est sur les suivantes, et sur l'impossibilité d'afficher une enseigne partie depuis six mois.

### I2.3 Ce qui reste manuel, définitivement

Les étapes 4, 6 et 7 relèvent du jugement, pas du calcul. Aucune automatisation n'est promise dessus, et il ne faut pas en promettre en avant-vente.

---

## I3. Assistance et automatisation

Cinq assistances, classées par ce qu'elles font réellement gagner. Aucune ne décide à la place de l'utilisateur : chacune propose, l'utilisateur valide.

**A1. Détection de contours sur référence de fond.** Sur un plan calé, détection des contours fermés et proposition d'empreintes candidates. L'utilisateur accepte, corrige ou refuse, par lot. Gain principal sur l'étape 3.

**A2. Reconnaissance de trame.** Détection d'une répétition régulière de cellules et proposition d'une duplication en série. Fréquent sur les galeries à trame constante.

**A3. Report d'un niveau à l'autre.** Copie des circulations, noyaux verticaux et éléments récurrents d'un niveau vers un autre, avec ajustement. C'est le geste le plus fréquent sur un bâtiment à plusieurs étages, et le plus fastidieux sans assistance.

**A4. Proposition d'implantation des supports.** Depuis les points de décision calculés et la hiérarchie de l'information, le système propose une implantation et une typologie par point. L'utilisateur arbitre. C'est l'assistance qui a le plus de valeur métier, parce qu'elle transforme une intuition en proposition argumentée.

**A5. Déclinaison d'une face vers une autre typologie.** Reprendre le contenu d'une face et le recomposer dans le gabarit d'une autre typologie, avec recalcul du format et des contrôles. Un totem devient un directionnel sans ressaisie.

Règle commune : toute proposition est présentée comme telle, jamais appliquée silencieusement, et son refus n'est pas redemandé.

---

## I4. Les trois références, et ce qu'on en prend

La demande porte sur les capacités de trois familles d'outils, en plus facile. Elles ne servent pas le même besoin, et prendre tout de chacune produirait un outil inutilisable.

### I4.1 De l'éditeur vectoriel de précision

| Capacité | Décision |
| --- | --- |
| Tracé de courbes, sommets, poignées | Retenu |
| Opérations booléennes | Retenu |
| Décalage parallèle | Retenu, avec sens métier |
| Alignement, répartition, groupement | Retenu |
| Calques, ordre de superposition | Retenu |
| Magnétisme, guides, grille | Retenu |
| Cotation et mesure | Retenu |
| Effets, filtres, dégradés, transparences | Écarté |
| Modes de fusion | Écarté |
| Tracé libre à main levée | Écarté |

Motif des trois écarts : un support fabriqué en découpe, en impression ou en gravure ne reproduit ni un dégradé de fusion, ni un effet. Les proposer produirait des fichiers refusés par les fabricants.

### I4.2 De l'outil de conception d'interface

C'est la famille la plus utile, et la moins évidente.

| Capacité | Traduction dans Azimut |
| --- | --- |
| Composants et variantes | Typologies et gabarits |
| Bibliothèques partagées | Bibliothèques de site et de portefeuille |
| Styles nommés | Rôles de charte, jamais de couleur directe |
| Contraintes de redimensionnement | Grille de gabarit et comportement des blocs |
| Disposition automatique des blocs | Flux de blocs et calcul de format |
| Commentaires contextuels | Revue des bons à tirer, ancrée sur la face |
| Historique de versions | Versions de support et tableau des messages |

Le commentaire ancré mérite d'être souligné : aujourd'hui, une remarque de maîtrise d'ouvrage sur un bon à tirer circule par courriel, hors du fichier. L'ancrer sur la face concernée supprime une source d'erreur quotidienne.

### I4.3 De l'outil de composition grand public

C'est de cette famille que vient la facilité d'usage, et elle est trop souvent négligée par les outils professionnels.

| Capacité | Traduction dans Azimut |
| --- | --- |
| Jamais de page blanche | Un gabarit par défaut pour chaque typologie |
| Bibliothèque de symboles prête | Symboles d'habillage et pictogrammes sectoriels |
| Guidage pas à pas | Progression explicite dans la chaîne de I2 |
| Redimensionnement vers un autre format | Déclinaison d'une face, assistance A5 |
| Aperçu permanent du résultat | Prévisualisation en situation sur le plan |

### I4.4 En quoi c'est réellement plus facile

Six mécanismes concrets, tous vérifiables, plutôt qu'une intention.

1. **On ne part jamais d'une page blanche.** Chaque typologie a son gabarit par défaut.
2. **On ne saisit pas de dimensions.** Le format se calcule depuis le contenu et la distance de lecture.
3. **On ne retape jamais un nom d'enseigne.** Le contenu est résolu depuis l'annuaire.
4. **On ne relit pas à la fin.** Les contrôles sont permanents et bloquants, au lieu d'une relecture finale qui laisse toujours passer quelque chose.
5. **On agit en série.** Une commande sur une sélection de soixante cellules, pas soixante gestes.
6. **On ne redessine pas à chaque mutation.** Un changement d'occupant régénère les supports concernés et eux seuls.

Aucun de ces six points n'existe dans les trois familles de référence, parce qu'aucune ne connaît le métier. C'est là, et pas dans la richesse de l'outillage de dessin, que se situe l'avantage défendable.

---

## I5. Résolution des points ouverts de la partie H

### I5.1 Chiffrage

La méthode de la partie G reste valable, la décomposition est à compléter. Tailles relatives des modules ajoutés, sur la même échelle.

| Module | Taille | Inconnue principale |
| --- | --- | --- |
| Wayfinding, zonage et nomenclature | M | règles de nommage par site |
| Plan de jalonnement et continuité | L | justesse métier à confronter au terrain |
| Tableau des messages | L | s'intercale dans le moteur de composition |
| Assistances A1 à A5 | XL | à découper, A1 et A4 sont des sujets à part entière |
| Chantier et pose | M | aucune |
| Exploitation, tournées et incidents | L | relevé hors ligne |
| Budget et estimation | M | multi-devises |
| Parcours clients | L | méthode d'exposition à établir |
| Régie publicitaire | XL | à découper, la facturation est un lot à part |
| Enseignes locataires | M | aucune |
| Portefeuille multi-sites | M | héritage des bibliothèques |
| Fonctions transverses | L | notifications et recherche |

Deux lots XL, donc deux lots qui n'entrent pas en développement avant d'être découpés, conformément à la règle de la partie G. Aucune durée n'est citée, et aucune ne doit l'être avant le calibrage sur quatre lots réels.

### I5.2 Question de l'offre

La décision commerciale n'est pas tranchée, mais elle peut cesser d'être bloquante. Le produit implémente un **modèle de droits par module**, qui rend les deux options possibles sans reprise ultérieure.

```sql
module_entitlement (id, org_id, site_id, module_key, state,
                    from_date, to_date, granted_by)
                   state in ('active','trial','suspended','expired')
```

Règles : un module non souscrit est absent de la navigation, jamais grisé. Les données d'un module suspendu restent lisibles en export, jamais supprimées. Les moteurs ne consultent pas les droits, seule la couche applicative le fait, afin que le cloisonnement commercial ne contamine pas le calcul.

Les deux options restent ouvertes : produit unique avec modules activables, ou offres séparées. La décision peut être prise après les premiers clients, ce qui est le bon moment.

### I5.3 Règles de calcul d'exposition

Le principe était posé sans méthode. Méthode retenue pour la première version, à valider avec un professionnel de la commercialisation.

L'exposition d'une cellule est le nombre de parcours calculés qui passent devant elle, chaque parcours étant pondéré par trois facteurs déclarés :

1. **Poids d'entrée.** Part de fréquentation attribuée à chaque accès. Déclarée, jamais devinée.
2. **Poids d'attraction.** Part de fréquentation attribuée à chaque destination motrice.
3. **Cône de visibilité.** Une cellule n'est exposée que si elle est visible depuis le cheminement, angle et distance déclarés par typologie de circulation.

Le résultat est un indice relatif entre cellules d'un même site, jamais un nombre de visiteurs. L'interface l'affiche comme un rang et un indice, avec les trois pondérations retenues visibles à côté.

Règle bloquante déjà posée, rappelée ici : un rapport de flux ne peut pas être exporté sans ses hypothèses.

### I5.4 Obligations légales de la régie

Le corpus n'est pas établi, mais le mécanisme d'accueil l'est. Les règles applicables à la publicité, mentions obligatoires, contraintes d'affichage des tarifs, catégories de produits interdites, sont portées par une **extension du paquet de règles**, avec les mêmes propriétés : enfichable, versionnée, datée, refusée si la référence documentaire manque, sans valeur de repli.

Le module de régie interroge ce paquet pour ses contrôles déclaratifs. En l'absence de paquet, il produit une anomalie et n'invente aucune règle. C'est la même position que pour le corpus des ERP.

### I5.5 Écrans numériques

Position confirmée : inventaire et planning dans Azimut, diffusion confiée à un système tiers. Ce qui manquait est le contrat d'interface, spécifié ici.

Azimut exporte, pour un emplacement numérique et une période : la liste ordonnée des visuels validés, leurs durées, leurs dates de début et de fin, et leurs empreintes. L'export est un fichier structuré déposé ou récupéré par le système tiers.

Azimut ne diffuse pas, ne pilote pas d'écran, ne mesure pas de diffusion. Il peut importer en retour un compte rendu de diffusion s'il lui est fourni, et le rapprocher du contrat.

### I5.6 Relevé mobile des tournées

Décision : **aucune application mobile native.** Le relevé se fait par une application web installable, hors ligne, réutilisant le mécanisme déjà spécifié pour le paquet de borne.

Motif : une application native ajoute deux plateformes, deux cycles de publication et deux magasins d'applications, pour un usage interne à quelques opérateurs. La contrainte réelle est le fonctionnement hors ligne, déjà résolue ailleurs dans le produit.

Périmètre du relevé : parcourir une tournée planifiée, constater l'état d'un support, photographier, signaler un incident, sans réseau, avec synchronisation différée.

### I5.7 Essais sur usagers

Aucun essai n'a été mené, et cela ne se corrige pas par de l'écriture. Ce qui se corrige est l'absence de protocole.

- **Quand.** Une session à la fin de chaque incrément, jamais à la fin du projet.
- **Qui.** Au minimum cinq participants par session, dont au moins deux extérieurs à Atlas Studio, et au moins un utilisant une technologie d'assistance.
- **Quoi.** Des tâches réelles chronométrées, pas une démonstration : modéliser un niveau depuis un plan fourni, corriger une anomalie bloquante, valider un tableau des messages, retrouver une destination sur borne.
- **Mesure.** Taux de réussite, temps par tâche, points de blocage, verbalisation.
- **Effet.** Toute tâche échouée par plus de deux participants sur cinq ouvre une anomalie de conception, traitée avant l'incrément suivant.
- **Cible prioritaire.** Le temps de mise en service d'un site, indicateur économique central du produit.

---

## I6. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `ASSIST.PROPOSAL_REJECTED` | information | Proposition d'assistance refusée, non redemandée |
| `ASSIST.EXTRACTION_BELOW_THRESHOLD` | avertissement | Taux d'extraction insuffisant, calage manuel recommandé |
| `MODULE.NOT_ENTITLED` | bloquant | Module non souscrit |
| `FLOW.WEIGHTS_UNDECLARED` | bloquant | Calcul d'exposition sans pondérations déclarées |
| `AD.RULES_PACK_MISSING` | bloquant | Aucun paquet de règles publicitaires rattaché |
| `SURVEY.SYNC_PENDING` | information | Relevé de tournée non synchronisé |

---

## I7. Ce qui reste ouvert

Court, et chaque point est désormais contenu plutôt que béant.

1. **Les durées.** Méthode établie, décomposition complétée, calibrage non fait. Aucune durée ne doit être citée.
2. **Le découpage des deux lots XL.** Assistances et régie publicitaire. À faire avant leur entrée en développement.
3. **La validation de la méthode d'exposition.** Défendable, non validée par un professionnel de la commercialisation.
4. **Le corpus réglementaire publicitaire.** Mécanisme prêt, contenu absent, comme pour les ERP.
5. **Les essais sur usagers.** Protocole établi, essais non menés. C'est le seul point de cette liste qui puisse invalider des décisions de conception déjà prises.
