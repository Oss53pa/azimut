# Complément au cahier des charges de développement
## Azimut, partie J. Saisie au stylet, esquisse, pictogrammes et bibliothèques

Éditeur : Atlas Studio

Cette partie ajoute la saisie à l'encre, l'esquisse, l'annotation en révision, l'éditeur de pictogrammes et l'organisation des bibliothèques. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## J0. Le principe qui rend tout cela possible

**L'encre est une méthode de saisie, pas une donnée.**

Ce qui est enregistré n'est jamais le trait tel qu'il a été tracé. C'est la forme reconnue, quantifiée au millimètre, identique à ce qu'aurait produit un glisser à la souris. Le tracé disparaît une fois la forme acceptée.

Cette règle unique préserve l'invariant 4 sur le déterminisme, tout en ouvrant l'ensemble des gestes demandés. Un polygone de cellule tracé au stylet et le même polygone tracé à la souris produisent des données strictement identiques, donc des rendus identiques.

Deux exceptions, où l'encre reste de l'encre parce que c'est justement son intérêt : la couche d'esquisse (J3) et l'annotation en révision (J4). Ces deux couches ne participent à aucun calcul et ne sortent jamais dans un livrable de fabrication.

### J0.1 Correction d'une décision antérieure

La partie G écartait la pression et l'inclinaison du stylet, au motif qu'elles introduiraient une variabilité contraire au déterminisme.

**Cette exclusion est levée pour la seule couche d'esquisse.** La pression y module l'épaisseur et l'opacité d'un trait qui n'est jamais converti en donnée métier, jamais mesuré et jamais fabriqué. Le déterminisme n'est donc pas en cause.

Elle est maintenue partout ailleurs : la pression n'a aucun effet sur un tracé destiné à devenir une empreinte, une arête ou un pictogramme.

L'exclusion du tracé libre au doigt, elle, est maintenue intégralement. La précision requise ne s'obtient pas au doigt, et proposer une fonction imprécise vaut moins que ne pas la proposer.

---

## J1. Saisie à l'encre et reconnaissance de forme

### J1.1 Cycle d'une saisie

Quatre temps, toujours les mêmes :

1. **Tracé.** Le trait apparaît tel quel, sans correction pendant le geste. Corriger en cours de tracé rend le geste imprévisible et donne le sentiment de lutter contre l'outil.
2. **Reconnaissance.** À la levée du stylet, la forme est analysée et une ou plusieurs candidates sont proposées.
3. **Arbitrage.** La candidate la plus probable est appliquée, les autres sont accessibles en un geste. Le tracé d'origine reste visible en filigrane tant que l'arbitrage n'est pas clos.
4. **Quantification.** La forme retenue est quantifiée au millimètre et devient une donnée ordinaire.

Le refus d'une candidate n'est jamais redemandé pour le même geste.

### J1.2 Formes reconnues

| Geste | Résultat |
| --- | --- |
| Trait presque droit | Segment droit |
| Trait presque horizontal ou vertical | Segment contraint sur l'axe |
| Trait proche d'un angle remarquable | Segment aligné sur l'angle |
| Suite de traits fermée | Polygone, sommets redressés |
| Rectangle approximatif | Rectangle, angles droits |
| Cercle ou ovale approximatif | Ellipse, cercle si proche |
| Trait rejoignant deux formes | Arête du graphe entre deux nœuds |
| Point appuyé | Nœud, du type actif dans la barre d'outils |
| Trait barrant une forme | Suppression de la forme |
| Boucle autour de plusieurs formes | Sélection de ces formes |

### J1.3 Redressement

Le redressement s'applique à la forme entière, pas segment par segment. Un contour de cellule tracé d'un geste continu produit un polygone dont tous les sommets sont redressés ensemble, et dont les angles proches de l'angle droit le deviennent.

Seuils de tolérance déclarés en constantes nommées, réglables : écart angulaire admis pour redresser sur un axe, écart admis pour fermer un contour, écart admis pour aligner deux sommets. Ces seuils sont des paramètres d'ergonomie, jamais des valeurs normatives.

L'intensité du redressement est réglable sur trois niveaux, du plus strict au plus permissif, et le niveau retenu est mémorisé par utilisateur. La donnée produite ne dépend jamais du niveau choisi une fois la forme acceptée : elle est toujours quantifiée au millimètre.

### J1.4 Calque et décalque

Le plan de référence calé sert de fond de décalque. Trois réglages : opacité du fond, affichage ou masquage des formes déjà tracées, verrouillage du fond pour éviter de le déplacer par mégarde.

Combiné à l'assistance de détection de contours déjà spécifiée, le décalque au stylet est le mode de travail le plus rapide sur un plan de qualité moyenne, qui est le cas courant.

### J1.5 Gestes de service

Deux doigts pour déplacer et zoomer pendant que le stylet dessine, sans changer d'outil. Appui long pour le menu contextuel. Rejet de la paume actif dès qu'un stylet est détecté, tout contact tactile étant alors ignoré.

Bouton latéral du stylet, s'il existe : gomme. Retournement du stylet, si le matériel le signale : gomme également.

---

## J2. Ce que la reconnaissance ne fait pas

À dire clairement, parce que c'est ce qui déçoit dans les outils de ce genre.

- Elle ne devine pas la nature métier d'une forme. Un contour tracé devient une empreinte parce que l'outil actif est celui des empreintes, jamais parce que le système a compris l'intention.
- Elle ne reconstruit pas un plan entier à partir d'un gribouillage.
- Elle ne reconnaît pas l'écriture manuscrite pour en faire du texte de support. La reconnaissance d'écriture est admise dans la seule couche d'annotation, où l'exactitude n'engage rien.
- Elle ne corrige pas rétroactivement une forme déjà acceptée. Une correction est une nouvelle commande, tracée dans l'historique.

---

## J3. Couche d'esquisse

### J3.1 Objet

Réfléchir sur le plan avant de modéliser. Repérer une zone, esquisser une implantation, annoter une intention, comparer deux idées.

C'est la seule couche où le trait est conservé tel quel.

### J3.2 Outils

Crayon, feutre, marqueur translucide, gomme. Palette de couleurs propre à l'esquisse, sans aucun rapport avec les jetons d'interface ni avec les chartes clients, précisément pour qu'une esquisse ne puisse jamais être confondue avec un contenu validé.

La pression module l'épaisseur et l'opacité. L'inclinaison, si le matériel la signale, module la largeur du marqueur.

### J3.3 Règles

- Une esquisse n'est jamais quantifiée, jamais convertie automatiquement, jamais mesurée.
- Elle ne participe à aucun calcul : ni parcours, ni couverture, ni quantitatif, ni zone cliquable.
- Elle n'apparaît dans aucun livrable de fabrication, dans aucun paquet de borne, dans aucun export destiné à un tiers. Contrôle automatisé sur les exports.
- Elle peut être promue : entourer une esquisse et demander sa conversion produit une forme reconnue, arbitrée et quantifiée comme n'importe quelle saisie. La promotion est explicite, jamais automatique.
- Une esquisse porte son auteur et sa date, et peut être masquée par calque.

### J3.4 Modèle de données

```sql
sketch_layer   (id, org_id, site_id, level_id, name, owner_id,
                visible boolean, locked boolean, created_at)
sketch_stroke  (id, org_id, layer_id, tool, color, width_base,
                points jsonb, created_at)
```

`points` conserve le tracé échantillonné avec sa pression. C'est la seule donnée non quantifiée du produit, et elle est cantonnée à cette table.

---

## J4. Annotation en révision

Distincte de l'esquisse, et distincte de l'annotation d'habillage qui, elle, est imprimée.

Objet : porter une remarque de relecture sur une face, un support ou une zone du plan, dans le circuit de validation des bons à tirer et du tableau des messages.

- Annotation ancrée sur l'entité concernée, jamais flottante.
- Rédigée au clavier ou tracée au stylet, avec reconnaissance d'écriture proposée et corrigeable.
- États : ouverte, traitée, refusée. Une annotation ouverte bloque la clôture d'une revue.
- Auteur, date, fil de réponses.
- N'apparaît jamais dans un livrable.

Ce mécanisme remplace la circulation des remarques par courriel, hors du fichier, qui est aujourd'hui une source d'erreur quotidienne.

---

## J5. Éditeur de pictogrammes

### J5.1 La frontière

Deux registres, déjà posés en partie A, appliqués ici sans exception.

**Registre de sécurité.** En lecture seule absolue. Les pictogrammes proviennent du paquet de règles, versionnés et référencés. Aucune création, aucune modification, aucune recoloration, aucune déformation, aucun recadrage. Le moteur refuse l'opération et lève une erreur.

Motif à porter en argument commercial plutôt qu'en contrainte : un pictogramme de sécurité redessiné, même mieux dessiné, n'est plus conforme. Un outil qui l'interdit protège son utilisateur.

**Registre d'orientation.** Création et modification libres. C'est ici que l'éditeur travaille.

### J5.2 Éditeur

Tracé au stylet ou à la souris, avec la reconnaissance de forme de J1. Outils : formes, courbes, opérations booléennes, alignement, miroir, grille de construction.

Contraintes appliquées automatiquement :

- Grille de construction et zone de sécurité déclarées, pour que les pictogrammes d'une même famille soient optiquement cohérents.
- Épaisseur de trait unique par famille, ou aplat plein, jamais les deux mélangés.
- Vectoriel exclusivement. Aucune image en mode point acceptée, le contrôle existe déjà.
- Une seule couleur par défaut, la couleur étant appliquée à l'usage par le rôle de charte, jamais figée dans le pictogramme.
- Prévisualisation à la taille réelle et à la distance de lecture déclarée, ce qu'aucun éditeur graphique généraliste ne propose et qui est le vrai apport ici.
- Contrôle de lisibilité en négatif et en niveaux de gris.

### J5.3 Compréhensibilité

Un pictogramme créé n'a aucune garantie d'être compris. La norme d'essai de compréhensibilité déjà citée au cahier des charges principal s'applique.

Le produit porte donc, pour chaque pictogramme du registre d'orientation, un état de validation : non testé, testé, taux de compréhension mesuré, date. Un pictogramme non testé peut être utilisé, mais l'état est visible et figure dans le rapport d'audit.

Le produit n'organise pas les essais. Il enregistre leur résultat et le rend opposable.

### J5.4 Modèle de données

```sql
pictogram_family (id, org_id, name, grid jsonb, stroke_width numeric,
                  safe_area jsonb, style)
pictogram        (id, org_id, family_id, registry, code, svg_path,
                  source, rules_pack_id, comprehension_state,
                  comprehension_rate numeric, tested_at, created_by)
                 registry in ('safety','wayfinding')
                 source in ('rules_pack','library','custom')
                 comprehension_state in ('untested','tested','failed')
```

Contrainte en base : toute ligne de `registry = 'safety'` a `source = 'rules_pack'` et est en lecture seule pour toute organisation.

---

## J6. Bibliothèques

### J6.1 Trois étages, jamais mélangés

**Étage 1, registre de sécurité.** Fourni par le paquet de règles, versionné, verrouillé, non duplicable en tant que tel. Un site en hérite par son rattachement à un paquet.

**Étage 2, bibliothèques fournies.** Pictogrammes d'orientation et symboles d'habillage livrés avec le produit, organisés par secteur : commerce, santé, transport, enseignement, tertiaire. Non modifiables directement. Une modification passe par duplication dans l'étage 3, ce qui préserve la référence d'origine et permet de mesurer l'écart.

**Étage 3, bibliothèques d'organisation.** Créations propres, duplications modifiées, actifs importés. Partageables sur le portefeuille multi-sites, avec héritage et dérogation par site.

La règle de non-mélange est structurante : à tout instant, l'origine d'un symbole est connue, et un audit peut dire lesquels sont normalisés, lesquels sont fournis, lesquels sont maison.

### J6.2 Contenu des bibliothèques

- Pictogrammes d'orientation, par famille.
- Symboles d'habillage : végétation, mobilier, véhicules, silhouettes, éléments de voirie.
- Gabarits de faces.
- Actifs importés : logos d'enseignes, images de marque, assainis selon les règles déjà posées.
- Palettes et rôles de charte.

### J6.3 Fonctions attendues

Recherche par nom, par catégorie et par mot-clé dans les deux langues. Étiquetage libre. Prévisualisation à taille réelle. Détection de doublons à l'import. Remplacement global d'un symbole par un autre sur un site, avec compte des occurrences avant application. Versionnage d'un symbole, avec régénération des supports qui l'emploient.

### J6.4 Ce qui n'est pas fourni

Aucune image photographique, aucune illustration décorative, aucun contenu sous licence tierce. Le produit fournit des symboles fonctionnels, pas une banque d'images. Fournir des visuels sous licence exposerait Atlas Studio à une responsabilité qu'il ne maîtrise pas, et ce n'est pas le métier.

---

## J7. Effet sur les parties antérieures

| Décision antérieure | Effet |
| --- | --- |
| Pression et inclinaison du stylet écartées | Levée pour la seule couche d'esquisse, maintenue ailleurs |
| Tracé libre au doigt exclu | Maintenu intégralement |
| Aucune donnée non quantifiée | Une exception, cantonnée à la table des tracés d'esquisse |
| Bibliothèque de symboles d'habillage | Étendue et réorganisée en trois étages |
| Registre de sécurité verrouillé | Inchangé, renforcé par l'éditeur |
| Annotation d'habillage | Distinguée de l'annotation de révision, qui est nouvelle |

---

## J8. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `INK.SHAPE_NOT_RECOGNIZED` | information | Aucune forme candidate, tracé conservé en esquisse |
| `SKETCH.IN_DELIVERABLE` | bloquant | Couche d'esquisse présente dans un export destiné à un tiers |
| `REVIEW.ANNOTATION_OPEN` | bloquant | Annotation de révision non traitée à la clôture |
| `PICTO.SAFETY_EDIT_DENIED` | bloquant | Modification d'un pictogramme du registre de sécurité |
| `PICTO.UNTESTED` | information | Pictogramme d'orientation non soumis à essai de compréhension |
| `PICTO.RASTER_CONTENT` | bloquant | Image en mode point dans un pictogramme |
| `PICTO.FAMILY_INCONSISTENT` | avertissement | Épaisseur ou grille incohérente avec la famille |
| `LIBRARY.DUPLICATE_ON_IMPORT` | avertissement | Symbole déjà présent dans la bibliothèque |

---

## J9. Rattachement aux tâches

| Élément | Rattachement |
| --- | --- |
| Saisie à l'encre et reconnaissance de forme | Incrément 1, extension de l'atelier |
| Décalque et réglages de fond | Incrément 1, avec l'import et le calage |
| Couche d'esquisse | Incrément 1 |
| Annotation de révision | Incrément 2, avec le circuit des bons à tirer |
| Éditeur de pictogrammes | Incrément 2 |
| Trois étages de bibliothèque | Incrément 2, partage portefeuille en incrément 5 |
| État de compréhensibilité | Incrément 2, visible au rapport d'audit |

La reconnaissance de forme est un lot de taille L, à découper. Elle n'est pas un préalable au produit : l'atelier fonctionne à la souris sans elle, et elle s'ajoute comme méthode de saisie supplémentaire. Cet ordre protège le calendrier.

---

## J10. Ce qui reste ouvert

1. **Les seuils de reconnaissance.** Écart angulaire, tolérance de fermeture, tolérance d'alignement. Valeurs de départ à établir, puis à régler sur usagers réels. C'est le paramètre qui décide si la fonction est agréable ou exaspérante, et il ne se choisit pas au bureau.
2. **La méthode de reconnaissance.** Plusieurs approches existent, de la géométrie simple à l'apprentissage. Le choix relève de la procédure d'arrêt et de demande, avec une contrainte ferme : la sortie doit être déterministe et explicable, ce qui écarte toute méthode dont le résultat varierait d'une version à l'autre.
3. **La reconnaissance d'écriture.** Admise dans la seule annotation. La solution technique n'est pas choisie, et une solution fonctionnant hors ligne est préférable, conformément aux contraintes de marché.
4. **Le volume des bibliothèques fournies.** Cinq secteurs annoncés, contenu non défini. C'est un travail de conception graphique, pas de développement, et il doit être chiffré séparément.
5. **Les essais de compréhensibilité.** Le produit enregistre leur résultat, il ne les organise pas. Qui les mène et à quelle fréquence reste à décider.
