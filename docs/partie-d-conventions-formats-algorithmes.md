# Complément au cahier des charges de développement
## Azimut, partie D. Conventions, formats et algorithmes

Éditeur : Atlas Studio

Ce document complète le cahier des charges principal. Il se lit après les parties A, B et C, et prend le même rang que la partie A dans l'ordre de préséance : ce qui est écrit ici prime sur toute décision d'implémentation.

Il existe parce que le cahier des charges principal disait quoi construire et comment vérifier, mais laissait dix-huit points à l'appréciation de celui qui code. Chacun de ces points est une source d'incohérence silencieuse.

---

## D0. Pourquoi ces points sont bloquants

Les sections qui suivent ne sont pas des précisions de confort. Trois d'entre elles conditionnent des invariants déjà posés :

- Sans D1, l'invariant 4 sur le déterminisme n'a pas de mécanisme. Deux développeurs arrondiront différemment et les empreintes de non-régression diffèreront sans raison apparente.
- Sans D3, l'invariant 5 sur l'absence de valeur normative en dur n'a pas de contenant. Les valeurs finiront dans le code faute de savoir où les mettre.
- Sans D2, les codes d'anomalie seront inventés au fil de l'eau, deviendront incohérents entre moteurs, et la couche d'interface ne pourra pas les traduire.

---

## D1. Système de coordonnées, unités et arrondis

### D1.1 Repère métier

Repère unique pour tout le produit, appelé repère site.

- Origine : point de référence du site, stocké sur la ligne `site`. Fixé au premier calage et jamais modifié ensuite.
- Axe X : vers l'est, en mètres.
- Axe Y : vers le nord, en mètres.
- Axe Z : vers le haut, en mètres. Z = 0 au niveau de référence du site, pas du bâtiment.
- Toutes les géométries de la base sont dans ce repère. Aucune coordonnée en pixels n'est jamais stockée.

Conséquence : le repère métier est direct et orienté nord, alors que le repère d'affichage SVG a son axe vertical dirigé vers le bas. **L'inversion de l'axe vertical se fait au tout dernier moment, dans la fonction de sérialisation SVG, et nulle part ailleurs.** Un moteur qui manipule des coordonnées déjà inversées est un bug.

### D1.2 Unités

| Grandeur | Unité de stockage | Suffixe de nom |
| --- | --- | --- |
| Distance sur plan | mètre | `_m` |
| Dimension de support | millimètre entier | `_mm` |
| Hauteur de caractère | millimètre | `_mm` |
| Angle | degré | `_deg` |
| Pente | pourcentage | `_pct` |
| Surface | mètre carré | `_m2` |
| Coût | unité monétaire mineure, entier | `_minor` |

Aucune conversion implicite. Une fonction qui reçoit des mètres et retourne des millimètres le dit dans son nom.

### D1.3 Convention d'angle

Convention unique, dite convention compas :

- 0 degré = nord.
- Sens croissant = horaire. 90 = est, 180 = sud, 270 = ouest.
- Domaine de stockage : [0, 360[. La normalisation est faite à l'écriture, jamais à la lecture.

Cette convention est contraire à la convention mathématique usuelle. Elle est retenue parce qu'elle correspond à ce que lit un géomètre et à ce que porte une rose des vents. Toute fonction trigonométrique interne qui a besoin de la convention mathématique fait la conversion localement et ne la propage pas.

### D1.4 Arrondis

Source principale d'indéterminisme. Règles strictes :

- Fonction d'arrondi unique, exportée par `core-model`, jamais réimplémentée : arrondi au plus proche, cas d'égalité résolu en s'éloignant de zéro.
- Toute coordonnée écrite dans un SVG est arrondie à 3 décimales. Sur des mètres, cela vaut le millimètre.
- Toute dimension de support est arrondie à l'entier millimétrique, vers le haut si le calcul est une contrainte minimale, vers le plus proche sinon. La distinction est portée par le nom de la fonction.
- Le zéro négatif est interdit en sortie. La sérialisation le convertit en zéro.
- Aucun calcul intermédiaire n'est arrondi. L'arrondi n'a lieu qu'à la sérialisation ou au franchissement d'un seuil normatif.

Test obligatoire : sérialiser une géométrie dont les coordonnées valent exactement 0,0005, -0,0005, -0 et vérifier la sortie attendue.

### D1.5 Tolérances géométriques

| Objet | Tolérance | Emploi |
| --- | --- | --- |
| Deux points confondus | 0,001 m | Fermeture de polygone, accrochage |
| Deux angles égaux | 0,01 degré | Colinéarité |
| Arête de longueur nulle | < 0,01 m | Refus à la saisie |
| Surface de polygone dégénéré | < 0,0001 m2 | Refus à la saisie |

Ces tolérances sont des constantes techniques, pas des valeurs normatives. Elles vivent dans `core-model` et non dans un paquet de règles.

---

## D2. Catalogue des codes d'anomalie

### D2.1 Convention de nommage

Format : `DOMAINE.SUJET_CONDITION`, en majuscules, un point de séparation, souligné dans les segments.

Domaines autorisés, et eux seuls : `GRAPH`, `GEOM`, `LAYOUT`, `RULES`, `CHARTER`, `IMPORT`, `PACKAGE`, `SECURITY`, `DATA`.

Un code est stable à vie. Il n'est jamais renommé, jamais traduit, jamais réutilisé pour un autre sens. Un code retiré est marqué obsolète et sa valeur reste réservée.

### D2.2 Catalogue initial

Toute anomalie produite par un moteur figure dans ce catalogue. Ajouter un code demande une entrée ici dans le même commit.

**Graphe**

| Code | Gravité | Sens |
| --- | --- | --- |
| `GRAPH.NODE_ORPHAN` | bloquant | Nœud relié à aucune arête |
| `GRAPH.ZONE_UNREACHABLE` | bloquant | Zone non atteignable depuis une entrée |
| `GRAPH.DESTINATION_UNLINKED` | bloquant | Destination sans nœud d'accès |
| `GRAPH.LEVEL_NO_VERTICAL_LINK` | bloquant | Niveau sans liaison verticale |
| `GRAPH.LEVEL_NO_ACCESSIBLE_LINK` | bloquant | Niveau sans liaison verticale accessible |
| `GRAPH.EDGE_ZERO_LENGTH` | bloquant | Arête de longueur inférieure à la tolérance |
| `GRAPH.EDGE_SELF_LOOP` | bloquant | Arête reliant un nœud à lui-même |
| `GRAPH.DISCONNECTED` | bloquant | Graphe non connexe |
| `GRAPH.DEAD_END_UNJUSTIFIED` | avertissement | Impasse sans destination ni justification |
| `GRAPH.VERTICAL_LINK_MISSING` | bloquant | Arête entre niveaux sans liaison verticale |
| `GRAPH.BUILDING_ISOLATED` | avertissement | Bâtiment sans liaison ni accès indépendant |
| `GRAPH.NOT_VALIDATED` | bloquant | Audit demandé avant validation de complétude |

**Géométrie**

| Code | Gravité | Sens |
| --- | --- | --- |
| `GEOM.POLYGON_SELF_INTERSECTING` | bloquant | Polygone auto-intersectant |
| `GEOM.POLYGON_NOT_CLOSED` | bloquant | Polygone non fermé |
| `GEOM.POLYGON_TOO_FEW_VERTICES` | bloquant | Moins de 3 sommets |
| `GEOM.POLYGON_DEGENERATE` | bloquant | Surface sous tolérance |
| `GEOM.VOLUME_NO_HEIGHT` | bloquant | Volume sans hauteur |
| `GEOM.FOOTPRINTS_OVERLAP` | avertissement | Empreintes superposées sur un même niveau |

**Composition**

| Code | Gravité | Sens |
| --- | --- | --- |
| `LAYOUT.CHAR_HEIGHT_BELOW_MIN` | bloquant | Hauteur de caractère sous le minimum normatif |
| `LAYOUT.CONTRAST_BELOW_MIN` | bloquant | Contraste de luminance insuffisant |
| `LAYOUT.CONTENT_OVERFLOW` | bloquant | Contenu ne tenant pas dans le format |
| `LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM` | bloquant | Format saisi manuellement et non conforme |
| `LAYOUT.DESTINATION_NOT_FOUND` | bloquant | Destination affichée inexistante |
| `LAYOUT.DESTINATION_UNREACHABLE` | bloquant | Destination affichée non atteignable |
| `LAYOUT.LANG_VARIANT_MISSING` | avertissement | Dénomination absente dans une langue active |
| `LAYOUT.LANG_VARIANT_LONGER` | information | La variante non primaire est plus longue |
| `LAYOUT.LEXICON_FORBIDDEN_TERM` | bloquant | Terme interdit par la charte |
| `LAYOUT.LEXICON_DISCOURAGED_TERM` | avertissement | Terme déconseillé par la charte |
| `LAYOUT.CHROMATIC_ADJACENCY` | bloquant | Adjacence chromatique interdite |
| `LAYOUT.LOGO_BELOW_MIN_WIDTH` | bloquant | Logo sous la largeur minimale |

**Règles et sécurité**

| Code | Gravité | Sens |
| --- | --- | --- |
| `RULES.PACK_NOT_BOUND` | bloquant | Aucun paquet de règles rattaché au site |
| `RULES.RULE_NOT_FOUND` | bloquant | Règle attendue absente du paquet |
| `RULES.SOURCE_REF_MISSING` | bloquant | Règle sans référence documentaire |
| `RULES.PACK_CHECKSUM_MISMATCH` | bloquant | Paquet altéré |
| `SECURITY.REGISTRY_WRITE_DENIED` | bloquant | Tentative de modification du registre de sécurité |
| `SECURITY.CHARTER_OVERRIDE_DENIED` | bloquant | Tentative d'application d'une charte au registre de sécurité |

**Import et paquet**

| Code | Gravité | Sens |
| --- | --- | --- |
| `IMPORT.COLUMN_MISSING` | bloquant | Colonne obligatoire absente |
| `IMPORT.ROW_INVALID` | avertissement | Ligne rejetée, import poursuivi |
| `IMPORT.NODE_NOT_FOUND` | avertissement | Nœud référencé inexistant |
| `IMPORT.DUPLICATE_KEY` | avertissement | Clé en double |
| `IMPORT.UNIT_AMBIGUOUS` | bloquant | Unité du fichier source indéterminable |
| `IMPORT.ENCODING_UNSUPPORTED` | bloquant | Encodage non reconnu |
| `PACKAGE.NETWORK_DEPENDENCY` | bloquant | Le paquet de borne émet une requête sortante |
| `PACKAGE.CHECKSUM_MISMATCH` | bloquant | Intégrité du paquet non vérifiée |
| `PACKAGE.NON_DETERMINISTIC` | bloquant | Deux compilations divergent |

### D2.3 Règle de traduction

Un moteur ne produit jamais de texte destiné à l'affichage. La couche d'interface possède un dictionnaire par code et par langue. Un code sans entrée de dictionnaire fait échouer un test dédié.

---

## D3. Format des paquets de règles

### D3.1 Structure de fichier

Un paquet est un répertoire sous `rules-packs/`, nommé `<juridiction>-<version>`. Il contient un manifeste et un ou plusieurs fichiers de règles au format JSON.

```
rules-packs/
  international-2026.1/
    manifest.json
    legibility.json
    contrast.json
    safety-registry.json
    accessibility.json
    tactile.json
```

### D3.2 Manifeste

```json
{
  "key": "international",
  "version": "2026.1",
  "jurisdiction": "INTL",
  "effectiveFrom": "2026-01-01",
  "supersedes": "international-2025.2",
  "files": ["legibility.json", "contrast.json", "safety-registry.json"],
  "checksum": "sha256:..."
}
```

### D3.3 Règle

```json
{
  "code": "LEGIBILITY.MIN_CHAR_HEIGHT",
  "scope": { "supportRegistry": "wayfinding", "context": "interior" },
  "kind": "formula",
  "params": {
    "expression": "readingDistance_m * factor",
    "factor": 5,
    "unit": "mm",
    "minimum_mm": 20
  },
  "sourceRef": "à renseigner par l'expert normatif",
  "notes": ""
}
```

### D3.4 Règles de chargement

1. Une règle sans `sourceRef` non vide est rejetée. Le paquet entier est refusé, pas seulement la règle.
2. Le contrôle d'intégrité du manifeste est vérifié au chargement.
3. Aucune valeur de repli. Une règle absente lève `RULES.RULE_NOT_FOUND`, elle ne retourne pas une valeur raisonnable.
4. Un paquet vide est valide. Il produit un système qui refuse de composer, ce qui est le comportement correct en l'absence de corpus établi. Voir C4.1 du cahier des charges principal.
5. Les paquets sont en lecture seule pour l'application. Ils sont modifiés par dépôt de fichier et migration, jamais par l'interface.

### D3.5 Résolution de portée

Quand plusieurs règles portent le même code, la plus spécifique gagne. Ordre de spécificité, du plus fort au plus faible : `supportRegistry`, puis `context`, puis `sectorKey`, puis règle sans portée. En cas d'égalité stricte de spécificité, le chargement échoue avec `RULES.PACK_CHECKSUM_MISMATCH` remplacé par un code dédié `RULES.SCOPE_AMBIGUOUS`, à ajouter au catalogue D2.2.

### D3.6 Surcouche pays

Un site peut être rattaché à un paquet international et à un paquet pays. La règle pays prime, mais **uniquement si elle est plus contraignante**. Une règle pays moins contraignante que le socle est rejetée au chargement avec un code dédié. C'est l'application du principe : la surcouche durcit, jamais l'inverse.

---

## D4. Formats d'import

### D4.1 Carnet de supports existant

Fichier tableur ou CSV. Encodage UTF-8, séparateur détecté parmi virgule, point-virgule, tabulation. Séparateur décimal accepté en point ou en virgule, choix déclaré en entête d'import.

| Colonne | Obligatoire | Type | Notes |
| --- | --- | --- | --- |
| `reference` | oui | texte | Identifiant du support dans le carnet source |
| `typology` | oui | texte | Doit correspondre à une clé de typologie |
| `building` | oui | texte | Nom de bâtiment |
| `level` | oui | texte | Nom de niveau |
| `node_ref` | non | texte | Nœud de rattachement si connu |
| `x_m`, `y_m` | non | nombre | Position si le nœud n'est pas connu |
| `azimuth_deg` | non | nombre | Convention D1.3 |
| `width_mm`, `height_mm` | non | entier | Bascule `dimensions_source` en `overridden` |
| `reading_distance_m` | non | nombre | |
| `substrate` | non | texte | |
| `condition` | non | énuméré | `good`, `worn`, `damaged`, `missing` |
| `installed_at` | non | date | ISO 8601 |
| `content_fr`, `content_en` | non | texte | Contenu constaté, à titre de comparaison |

Comportement : les lignes valides sont importées, les autres rejetées, un rapport ligne à ligne est produit. Jamais d'import silencieusement tronqué. Une ligne sans `node_ref` ni couple de coordonnées est rejetée avec `IMPORT.ROW_INVALID`.

### D4.2 État locatif

| Colonne | Obligatoire | Type |
| --- | --- | --- |
| `unit_code` | oui | texte |
| `building`, `level` | oui | texte |
| `occupant_name` | non | texte |
| `category_key` | non | texte |
| `occupancy_status` | oui | énuméré |
| `name_fr`, `name_en` | non | texte |
| `effective_from` | non | date |

Un `unit_code` inconnu ne crée pas d'empreinte. Il produit `IMPORT.NODE_NOT_FOUND` et la ligne est mise en attente de rattachement manuel.

### D4.3 Qualification d'un fichier de CAO

Ajout par rapport au cahier des charges principal, qui annonçait un import sans étape de qualification.

Avant toute tentative d'import, le fichier est qualifié et un rapport est produit :

- Proportion de polylignes fermées sur l'ensemble des entités.
- Présence et nommage des calques, taux de calques exploitables.
- Cohérence et déclaration des unités.
- Présence de références externes manquantes.
- Détection d'entités superposées en double.
- Nombre de niveaux présents dans le même fichier.

Le rapport annonce un taux d'extraction attendu. En dessous d'un seuil paramétrable, l'outil recommande explicitement le calage manuel plutôt que l'import, et le dit à l'utilisateur.

Motif : un import qui réussit à moitié sans le dire coûte plus cher qu'un redessin, et dégrade l'indicateur économique central du produit, qui est le temps de mise en service d'un site.

---

## D5. Projection isométrique

### D5.1 Transformation

Projection isométrique classique, angle fixe de 30 degrés.

```
u = (x - y) * cos(30°)
v = (x + y) * sin(30°) - z
```

avec `cos(30°) = 0.8660254037844386` et `sin(30°) = 0.5`, écrits comme constantes nommées et non recalculées.

`u` et `v` sont en unités métier. La mise à l'échelle vers le repère d'affichage et l'inversion de l'axe vertical ont lieu à la sérialisation, conformément à D1.1.

### D5.2 Ordre de tracé

Algorithme du peintre, du plus lointain au plus proche.

Clé de tri, dans cet ordre, croissant :

1. `base_elevation_m` du volume.
2. `min(x) + min(y)` de l'empreinte, calculé sur les sommets.
3. Identifiant du volume, comparaison lexicographique par octets.

Le troisième critère existe uniquement pour garantir le déterminisme. Sans lui, deux volumes de même profondeur pourraient être tracés dans un ordre variable selon l'implémentation du tri.

**Limite documentée :** cet algorithme est correct pour des volumes dont les empreintes ne se recoupent pas. Des empreintes qui se recoupent produisent `GEOM.FOOTPRINTS_OVERLAP` en avertissement, et le rendu peut présenter une occultation incorrecte. Ce cas n'est pas traité dans le noyau. Le résoudre demanderait un découpage des volumes, hors périmètre.

### D5.3 Faces d'un volume

Trois faces sont tracées par volume : dessus, gauche, droite. Les faces arrière ne le sont jamais. Les teintes des trois faces dérivent d'une couleur de base par un facteur d'assombrissement fixe, déclaré dans `design-tokens` et non calculé dans le moteur.

### D5.4 Zones cliquables

Dérivées de la face supérieure projetée de chaque volume, jamais stockées. Une zone cliquable qui existerait en base est un bug.

Ordre de test des zones : inverse de l'ordre de tracé, du plus proche au plus lointain.

### D5.5 Multiniveau

Deux modes :

- `active_level` : niveau actif en pleine opacité, niveaux adjacents estompés par un facteur déclaré en jetons. Mode par défaut sur borne.
- `exploded` : niveaux décalés en escalier, décalage vertical déclaré en jetons. Mode des plans d'ensemble imprimés.

---

## D6. Orientation des plans muraux

### D6.1 Principe

Un plan mural n'est pas un fichier mais une famille de fichiers, un par implantation. Ce qui est devant l'usager est en haut du panneau.

### D6.2 Transformation

Le plan est tourné de `-azimuth_deg` autour du point de position du support, avec la convention d'angle de D1.3 et une rotation d'affichage positive dans le sens horaire.

Effet : un support d'azimut 90, donc regardant vers l'est, produit un plan où l'est est en haut.

### D6.3 Éléments non tournés

Trois éléments restent lisibles horizontalement quelle que soit la rotation, donc ne subissent pas la transformation :

- Les libellés de destinations et la légende.
- La rose des vents, qui tourne sur elle-même pour indiquer le nord réel.
- Le repère de position de l'usager.

### D6.4 Test décisif

Pour chaque support de type plan d'un site de référence, vérifier que la destination située physiquement devant le support apparaît dans la moitié supérieure du rendu. Ce test attrape l'inversion de signe, qui est l'erreur la plus probable et la plus difficile à voir à l'œil.

---

## D7. Empreintes de contenu et invalidation

### D7.1 Ce qui entre dans une empreinte

Deux empreintes distinctes, aux rôles différents.

`inputs_hash`, pour l'invalidation du cache de parcours : identifiants et attributs de tous les nœuds, arêtes et liaisons verticales du site, plus la définition du profil. Ni les destinations, ni les supports, ni les chartes.

`content_hash`, pour la détection de péremption d'une exécution : contenu résolu de la face, gabarit, charte et sa version, paquet de règles et sa version, langues actives, dimensions calculées. Ni l'identifiant du support, ni les horodatages, ni l'auteur.

### D7.2 Règles de calcul

- Sérialisation canonique avant hachage : clés triées, aucun espace superflu, nombres au format fixe défini en D1.4.
- Algorithme SHA-256, en hexadécimal minuscule.
- Aucun horodatage, aucun identifiant de session, aucune donnée d'utilisateur dans une empreinte.

### D7.3 Effet

Un changement de destination modifie le `content_hash` des seules faces qui la mentionnent. Le système sait alors exactement quels supports sont périmés. C'est le mécanisme qui rend possible la promesse d'exploitation, et il ne fonctionne que si la composition des empreintes est stricte.

Test obligatoire : modifier une destination et vérifier que le nombre de faces marquées périmées est exactement celui attendu, ni plus, ni moins.

---

## D8. Langage de gabarit

### D8.1 Principe

Un gabarit est une donnée, pas un composant. Ajouter un gabarit ne demande aucune modification de code.

### D8.2 Schéma

```json
{
  "key": "directional-suspended-2lines",
  "faceCount": 2,
  "grid": { "columns": 12, "margin_mm": 40, "gutter_mm": 20 },
  "blocks": [
    {
      "index": 0,
      "kind": "resolved",
      "binding": { "source": "route", "field": "nextDestinations", "limit": 4 },
      "area": { "col": 1, "colSpan": 9, "row": 1 },
      "style": { "role": "primary", "align": "left" }
    },
    {
      "index": 1,
      "kind": "pictogram",
      "binding": { "source": "destination", "field": "pictogram" },
      "area": { "col": 10, "colSpan": 3, "row": 1 }
    }
  ],
  "sizing": { "mode": "computed", "growAxis": "width" }
}
```

### D8.3 Contraintes

- `kind` est l'un de : `resolved`, `free`, `pictogram`, `map`, `legend`.
- Un bloc `free` est le seul dont le texte est saisi. Tous les autres sont résolus, conformément à l'invariant 2.
- `style.role` référence un rôle de la charte, jamais une couleur directe.
- `sizing.mode` vaut `computed` par défaut. Le format est déduit du contenu.
- Un gabarit dont un bloc déborde de la grille est refusé au chargement.

### D8.4 Preuve

Test obligatoire : ajouter un gabarit uniquement par fichier, sans toucher au code, et vérifier qu'il produit un rendu valide. Si ce test demande une modification de code, le gabarit n'est pas une donnée et l'exigence n'est pas tenue.

---

## D9. Machines à états

Les transitions non listées sont interdites et lèvent une erreur.

### D9.1 Version de support

| De | Vers | Déclencheur | Effet |
| --- | --- | --- | --- |
| `draft` | `in_review` | Émission d'une épreuve | Fige le contenu et l'empreinte |
| `in_review` | `draft` | Rejet | Motif obligatoire |
| `in_review` | `approved` | Approbation | Écrit une ligne d'approbation, insertion seule |
| `approved` | `superseded` | Nouvelle version approuvée | Automatique |
| `draft` | `draft` | Modification | Recalcule l'empreinte |

Une version `approved` n'est jamais modifiable. Une correction crée une nouvelle version.

### D9.2 Travail

| De | Vers | Condition |
| --- | --- | --- |
| `queued` | `running` | Prise en charge |
| `running` | `succeeded` | Fin normale |
| `running` | `failed` | Erreur, tentatives épuisées |
| `running` | `queued` | Erreur, tentatives restantes |
| `queued` | `cancelled` | Annulation utilisateur |

Politique de reprise : 3 tentatives, temporisation exponentielle de 5, 30 puis 120 secondes. Tout travail est idempotent : rejouer un travail réussi ne produit ni doublon, ni artefact supplémentaire. Un travail sans progression pendant 30 minutes est considéré échoué.

### D9.3 Divergence

`detected` vers `resolved` par constatation de pose conforme, ou vers `accepted` par décision explicite tracée. Une divergence ne disparaît jamais sans trace.

### D9.4 Ordre de travaux

`draft` vers `issued` vers `in_progress` vers `done`, ou `cancelled` depuis tout état sauf `done`.

---

## D10. Paquet de borne

### D10.1 Arborescence

```
package/
  manifest.json
  index.html
  assets/
    app.js
    app.css
  data/
    graph.json
    directory.json
    scene.json
  maps/
    level-<ordinal>.svg
```

Aucun chemin absolu. Aucune référence à un domaine externe. Aucune police chargée depuis le réseau, les polices sont incorporées.

### D10.2 Manifeste

```json
{
  "siteId": "...",
  "version": 42,
  "builtAt": "2026-09-01T00:00:00Z",
  "contentHash": "sha256:...",
  "files": [{ "path": "assets/app.js", "sha256": "..." }],
  "langs": ["fr", "en"],
  "minRuntime": "1.0.0"
}
```

`builtAt` est le seul champ non déterministe du paquet. Il est exclu du calcul de `contentHash`. C'est la seule exception à l'invariant 4, et elle est explicite.

### D10.3 Configuration locale de borne

Fichier séparé du paquet, jamais recompilé avec lui.

```json
{
  "kioskId": "...",
  "nodeId": "...",
  "azimuthDeg": 142,
  "defaultLang": "fr",
  "buildingId": "..."
}
```

Un seul paquet dessert toutes les bornes d'un site. La borne calcule son propre repère de position et oriente le plan selon D6.

### D10.4 Protocole de mise à jour

1. Au démarrage, la borne charge sa copie locale. Toujours. Le réseau n'intervient jamais dans l'affichage.
2. Si le réseau est disponible, elle demande un fichier de version léger, de quelques octets.
3. Si la version distante diffère, elle télécharge le paquet complet dans un emplacement temporaire.
4. Elle vérifie l'intégrité de chaque fichier contre le manifeste. Un seul écart annule la mise à jour.
5. Bascule atomique. La version précédente est conservée.
6. Si le premier démarrage sur la nouvelle version échoue, retour automatique à la précédente et signalement.

Test décisif : interrompre le téléchargement à mi-parcours, redémarrer la borne, vérifier qu'elle affiche l'ancienne version complète et non un état mixte.

### D10.5 Vérification d'autonomie

Test automatisé obligatoire : servir le paquet, couper tout accès réseau, exécuter le parcours utilisateur complet, et vérifier qu'aucune requête sortante n'a été tentée. Toute tentative lève `PACKAGE.NETWORK_DEPENDENCY`.

---

## D11. Nommage des fichiers produits

Le nommage est déterministe et lisible par un fabricant qui n'a pas accès au logiciel.

```
<code_site>_<batiment>_<niveau>_<typologie>_<reference>_v<version>_<face>.<ext>
```

Exemple : `CPL_A_R1_DIR_D-042_v3_F1.pdf`

Règles : segments en majuscules, sans accent, sans espace, translittération déterministe des caractères accentués, longueur totale limitée à 120 caractères, troncature par le milieu avec marqueur si dépassement.

Une archive de livraison porte le même schéma sans les segments de support, plus un fichier d'index reprenant le quantitatif.

---

## D12. Internationalisation

### D12.1 Mécanisme

- Deux langues actives : `fr`, `en`. La liste est une donnée de site, pas une constante.
- Aucun texte d'interface écrit dans un composant. Clés uniquement.
- Convention de clé : `domaine.écran.élément`, minuscules, points.
- Un code d'anomalie de D2 possède une entrée par langue. Une entrée manquante fait échouer un test.

### D12.2 Expansion des textes

Le français et l'anglais ne produisent pas des longueurs égales. Règles :

- Le calcul de dimension d'un support se fait sur la variante la plus longue parmi les langues actives, jamais sur la langue primaire.
- Les jeux de test contiennent des dénominations volontairement longues dans chaque langue.
- Un test de non-régression visuelle par langue active, pas un seul dans la langue par défaut.

### D12.3 Ce qui n'est pas préparé

L'écriture de droite à gauche est hors périmètre. Aucun contournement partiel n'est toléré : mieux vaut une absence nette qu'un support à moitié géré. Sa mise en œuvre demandera une reprise du moteur de composition et de tous les gabarits.

---

## D13. Protocole de mesure des performances

Les seuils du cahier des charges principal existent sans méthode de mesure, ce qui les rend invérifiables.

- Machine de référence déclarée, mêmes caractéristiques en local et en intégration continue.
- Chaque mesure porte sur un site de référence nommé, jamais sur un site improvisé.
- 5 exécutions, mesure retenue = médiane. La première exécution est écartée.
- Base amorcée, caches vidés entre chaque exécution, condition déclarée dans le résultat.
- Un dépassement de seuil fait échouer la chaîne d'intégration, il ne produit pas un simple avertissement.
- Les seuils actuels ne reposent sur aucune mesure. Ce sont des cibles, à réviser après le premier site réel modélisé, et la révision doit être tracée.

---

## D14. Tests d'accessibilité concrets

La référence à WCAG ne suffit pas à produire un test. Liste minimale automatisée :

- Contraste calculé sur chaque couple de jetons de texte et de fond, seuil AA, y compris les états de survol et de focus.
- Navigation complète au clavier sur `studio`, ordre de tabulation cohérent, aucun piège de focus.
- Indicateur de focus visible sur tout élément interactif.
- Aucune information portée par la seule couleur, vérifié sur les rendus en niveaux de gris.
- Respect du mode à animation réduite, avec équivalent statique de toute animation.
- Textes alternatifs présents sur tout rendu, décrivant le contenu et non le format.
- Vue en plan simplifié disponible partout où l'isométrie est proposée.

Exigences propres aux bornes, à traiter comme fonctionnelles et non comme du confort, chacune donnant lieu à un critère d'acceptation dans son lot : sortie audio avec prise casque, commandes tactiles physiques repérables au toucher, hauteur de zone d'interaction compatible avec un usage assis, cible tactile minimale, mode contraste renforcé accessible en un geste, temporisation d'inactivité allongée en mode accessible, alternative sonore à toute information portée par la seule couleur.

---

## D15. Sauvegarde, rétention et données personnelles

Absent du cahier des charges principal.

- Sauvegarde quotidienne de la base, conservation 30 jours, restauration testée mensuellement. Une sauvegarde non testée n'existe pas.
- Artefacts produits versionnés en stockage objet, conservation illimitée pour toute version approuvée, purge possible des brouillons après 90 jours.
- Données personnelles présentes dans le produit : comptes utilisateurs et journaux d'approbation. Rien d'autre. La télémétrie de borne n'en contient aucune, contrôle automatisé obligatoire.
- Suppression d'un compte : anonymisation dans le journal d'audit, jamais suppression de la ligne d'audit, qui est en insertion seule.
- Export complet des données d'une organisation en formats ouverts, exigence contractuelle de réversibilité. Testé, pas seulement déclaré.

---

## D16. Politique de dépendances

- Toute dépendance nouvelle passe par la procédure d'arrêt et de demande.
- Versions figées, fichier de verrouillage committé, installation en mode strict.
- Analyse de vulnérabilités à chaque intégration. Une vulnérabilité critique bloque la fusion.
- Aucune dépendance non maintenue depuis plus de 18 mois sans justification écrite.
- Toute dépendance touchant au rendu ou au calcul géométrique est examinée sous l'angle du déterminisme avant adoption.

---

## D17. Mise en route développeur

Le dépôt doit permettre à quelqu'un d'arriver et de travailler sans transmission orale.

Commandes attendues, dont l'existence est vérifiée par la chaîne d'intégration :

```
pnpm install
pnpm db:reset
pnpm seed:ref            charge les sites de référence
pnpm dev                 studio en développement
pnpm dev:kiosk           runtime de borne
pnpm worker              service de compilation
pnpm typecheck
pnpm lint
pnpm test
pnpm test:visual
pnpm test:rls
pnpm test:determinism
pnpm test:e2e
```

Un fichier d'exemple de variables d'environnement, sans aucune valeur réelle, accompagne le dépôt.

---

## D18. Ce que ce complément ne couvre toujours pas

Écrit pour que personne ne le découvre plus tard.

1. **Le contenu réel des paquets de règles.** D3 en donne le contenant, pas le contenu. Aucune valeur normative n'est écrite ici, et aucune ne doit l'être avant l'étude d'expert. Le champ `sourceRef` de l'exemple D3.3 porte volontairement une mention d'attente.
2. **Le facteur de lisibilité de l'exemple D3.3.** La valeur 5 est un exemple de forme, pas une valeur normative validée. Elle ne doit pas être reprise.
3. **Le comportement du tri des occultations sur empreintes recoupées.** Documenté comme limite en D5.2, non résolu.
4. **Le déterminisme strict de la sortie PDF.** Dépend de la bibliothèque, tranché en T-0.9, non acquis.
5. **La transcription braille.** Le transcripteur est enfichable, aucune table n'est écrite.
6. **Les seuils de performance.** Cibles sans mesure, voir D13.
7. **La tolérance d'accrochage à la saisie.** D1.5 donne des tolérances géométriques, pas l'ergonomie d'accrochage, qui demande un essai sur usagers réels.
8. **Le format d'échange des bornes.** Aucun matériel arrêté, le produit publie un profil de conformité au lieu de cibler un lecteur.
