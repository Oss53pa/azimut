# Complément au cahier des charges de développement
## Azimut, partie K. Registre consolidé des points ouverts

Éditeur : Atlas Studio

Cette partie consolide les huit listes de points ouverts dispersées dans les documents précédents (chapitre C5 du cahier des charges principal, puis D18, E19, F19, G10, H14, I7 et J10). Elle les remplace : à compter de cette version, le registre ci-dessous est la seule liste à tenir.

---

## K0. Ce que la consolidation révèle

Les huit listes comptent 47 entrées pour 31 sujets distincts.

Les essais sur usagers apparaissent quatre fois, le chiffrage trois fois, le corpus réglementaire trois fois, les licences de polices deux fois. Les documents se répétaient au lieu de s'accumuler, ce qui donnait l'impression d'un nombre de points ouverts supérieur à la réalité.

Par ailleurs, neuf entrées avaient déjà été résolues par un document postérieur sans que la liste d'origine soit mise à jour. Elles figuraient donc comme ouvertes alors qu'elles ne l'étaient plus.

Classement des 31 sujets par nature :

| Nature | Nombre | Ce qui les ferme |
| --- | --- | --- |
| Déjà résolus, liste non mise à jour | 9 | Rien, ils sont clos |
| Décidables maintenant | 7 | Ce document |
| Mesurables, demandent un essai technique | 5 | Une expérimentation bornée |
| Juridiques ou documentaires | 5 | Un tiers qualifié |
| Demandent des usagers réels | 3 | Des sessions d'essai |
| Commerciaux | 2 | Des rendez-vous de vente |

---

## K1. Points déjà résolus, et par quoi

Ces neuf sujets sont clos. Ils ne doivent plus figurer dans aucune liste.

| Sujet | Source | Résolu par |
| --- | --- | --- |
| Format d'échange des bornes | D18 | Profil de conformité matérielle, qui inverse la dépendance au fournisseur |
| Tolérance d'accrochage à la saisie | D18 | Tolérances par type de pointeur, partie G |
| Saisie tactile et stylet | E19 | Partie G, puis partie J pour l'encre |
| Édition simultanée | E19 | Exclue définitivement, présence et verrou consultatif à la place |
| Conversion colorimétrique exacte | E19 | Chaîne colorimétrique, partie G, référence faisant foi |
| Reprise des fichiers graphiques clients | E19 | Import en référence de fond, non-promesse assumée |
| Question de l'offre | H14 | Droits par module, qui laisse les deux options ouvertes |
| Diffusion sur écrans numériques | H14 | Exclue, contrat d'interface avec un système tiers spécifié |
| Relevé mobile des tournées | H14 | Application web installable hors ligne, pas d'application native |

---

## K2. Points résolus par ce document

Sept décisions, prises ici, qui ferment sept sujets.

### K2.1 Occultations sur empreintes recoupées

Source : D18. La limite reste réelle, mais elle cesse d'être subie.

**Décision.** L'algorithme de tri par profondeur est conservé tel quel. Un attribut `render_order` est ajouté à la table des volumes, saisissable par l'utilisateur, nul par défaut. Quand il est renseigné, il prime sur le tri calculé.

L'anomalie d'empreintes superposées passe d'information à avertissement, et propose la saisie d'un ordre manuel. Le cas cesse ainsi de produire un rendu faux sans recours, sans imposer un découpage de volumes hors périmètre.

### K2.2 Méthode de reconnaissance de forme

Source : J10.

**Décision.** Reconnaissance géométrique exclusivement. Aucune méthode par apprentissage.

Motif : l'invariant 4 impose un résultat déterministe et explicable. Un modèle appris change de comportement d'une version à l'autre, ne s'explique pas ligne à ligne et rendrait les empreintes de non-régression instables. La reconnaissance géométrique couvre la totalité des gestes du tableau de la partie J.

### K2.3 Reconnaissance d'écriture manuscrite

Source : J10.

**Décision.** Retenue uniquement si une solution fonctionnant entièrement hors ligne existe, cantonnée à l'annotation de révision. À défaut, la fonction est abandonnée, sans recherche d'un substitut en ligne.

Motif : la contrainte de connectivité irrégulière prime, et l'annotation reste utilisable en saisie clavier. Une fonction qui ne marche qu'avec du réseau sur un marché où le réseau manque n'a pas de valeur.

### K2.4 Volume des bibliothèques fournies

Source : J10.

**Décision.** Minimum par secteur à la première mise en marché : 40 pictogrammes d'orientation et 25 symboles d'habillage, pour les cinq secteurs annoncés.

Ce travail est un lot de conception graphique, chiffré et commandé séparément du développement. Il ne consomme pas de temps d'ingénierie et peut être mené en parallèle.

### K2.5 Facteur de lisibilité de l'exemple de règle

Source : D18. Ce n'était pas un point ouvert mais une règle permanente mal classée.

**Clarification.** Toute valeur numérique figurant dans un exemple de format de ce cahier des charges est un exemple de forme. Aucune ne doit être reprise comme valeur normative. La règle est permanente et sort du registre.

### K2.6 Largeur minimale de poste

Source : F19.

**Décision.** La valeur de 1366 pixels est conservée, étant déduite de la règle de proportion de la zone de travail. Sa confrontation au terrain se fait lors des sessions d'essai sur usagers, par simple relevé du matériel des participants. Aucune collecte automatisée, aucune donnée personnelle.

Le sujet cesse d'être un point ouvert et devient une observation à faire.

### K2.7 Écrans des modules ajoutés

Source : F19.

**Décision.** Ils sont inventoriés et rattachés à trois familles de mise en page. Chacun sera spécifié au moment d'entrer dans son incrément, jamais avant.

C'est une règle de méthode, pas une dette. Spécifier aujourd'hui un écran qui sera construit dans deux ans produit un texte réécrit avant d'être lu.

---

## K3. Registre des points qui ne se ferment pas par écrit

Quinze sujets. Chacun porte un responsable, un déclencheur et un niveau de blocage.

Niveaux de blocage : **P** bloque avant la première ligne de code, **V** bloque avant la première vente, **L** bloque avant la première livraison, **S** surveillé, sans blocage.

### K3.1 Études et documentation

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Corpus réglementaire ERP par pays | Expert normatif externe | Avant tout paquet de règles | P |
| Millésimes des normes citées | Expert normatif externe | Avec l'étude ci-dessus | P |
| Corpus réglementaire publicitaire | Expert normatif externe | Avant le module de régie | L |
| Standard de transcription braille | Expert normatif externe | Avant la chaîne tactile | L |
| État de l'offre concurrente | Atlas Studio | Avant tout engagement | P |

Le mécanisme d'accueil de ces corpus est prêt et testé. En leur absence, le produit refuse de composer plutôt que d'inventer, ce qui est le comportement correct. Le blocage porte sur la mise en marché, pas sur le développement du socle.

### K3.2 Questions juridiques

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Licences des polices incorporées | Conseil juridique | Avant incorporation dans un livrable distribué | L |
| Licence des données de nuanciers | Position arrêtée, aucune table fournie | Permanent | S |
| Disponibilité du nom Azimut | Conseil en propriété industrielle | Avant toute communication publique | V |
| Origine du code et des données réutilisés | Conseil juridique | Avant la première ligne de code | P |
| Obligations légales de la régie | Conseil juridique par pays | Avant le module de régie | L |

Le sujet le plus sous-estimé de cette liste est la disponibilité du nom. Un nom déjà déposé rend inutilisable tout ce qui aura été construit autour, y compris le signe, le site et les documents commerciaux.

### K3.3 Expérimentations techniques

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Déterminisme de la sortie PDF | Développement | Tâche T-0.9, avant l'incrément 2 | P |
| Cloisonnement sur agrégats et jointures profondes | Développement | Incrément 0, test empirique | P |
| Support réel du format d'échange de graphe | Développement | Avant de le promettre | S |
| Budget de rendu et tolérances de pointeur | Développement | Premier site réel modélisé | S |
| Seuils de reconnaissance de forme | Développement puis usagers | Avec les sessions d'essai | S |

Ces cinq sujets se ferment par une expérimentation bornée dans le temps, dont le livrable est une note, pas du code. Deux d'entre eux bloquent avant le développement parce qu'ils peuvent remettre en cause un choix de socle.

### K3.4 Essais sur usagers

Un seul sujet, qui figurait sous quatre formes différentes.

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Sessions d'essai sur usagers réels | Atlas Studio | Fin de chaque incrément | L |

Le protocole est établi en partie I : cinq participants minimum par session, dont deux extérieurs et un utilisant une technologie d'assistance, tâches réelles chronométrées, toute tâche échouée par plus de deux participants sur cinq ouvrant une anomalie de conception.

Ce qui s'y joue, et qui n'est pas un détail : la densité d'interface retenue, l'exclusion du tracé libre au doigt, les seuils de reconnaissance et le temps de mise en service d'un site. Ce sont quatre décisions déjà prises que ces sessions peuvent invalider.

### K3.5 Essais de compréhensibilité des pictogrammes

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Organisation des essais de compréhension | Client, non Atlas Studio | Avant fabrication d'un pictogramme maison | S |

Position confirmée : le produit enregistre le résultat et le rend opposable en audit, il n'organise pas les essais. La responsabilité reste au maître d'ouvrage.

### K3.6 Sujets commerciaux

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Seuils de viabilité, prix, volume, cycle de vente | Atlas Studio | Avant tout engagement de construction | P |
| Validation de la méthode d'exposition | Professionnel de la commercialisation | Avant de vendre un audit chiffré | V |

Ces deux sujets ne se ferment ni par une étude ni par du code. Ils se ferment en allant vendre.

### K3.7 Chiffrage

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Durées et charge | Atlas Studio | Après calibrage sur quatre lots réels | S |
| Découpage des lots de taille XL | Atlas Studio | Avant leur entrée en développement | S |

Rappel de la règle, qui n'a jamais changé : aucune durée ne doit être citée avant le calibrage, et aucun lot de taille XL n'entre en développement avant d'être découpé. Les deux lots concernés sont les assistances de tracé et la régie publicitaire.

---

## K4. Les préalables absolus

Extraits du registre, par jalon. C'est la seule liste à tenir sous les yeux.

### Avant la première ligne de code, sept préalables

1. Seuils de viabilité commerciale confrontés au terrain.
2. Étude concurrentielle documentée.
3. Corpus réglementaire ERP établi, au moins pour une juridiction.
4. Millésimes des normes confirmés.
5. Origine du code et des données réutilisés réglée par écrit.
6. Déterminisme de la sortie PDF démontré.
7. Cloisonnement sur agrégats et jointures profondes validé empiriquement.

Les deux derniers peuvent être menés comme premières tâches de l'incrément 0, les cinq premiers non.

### Avant la première vente

1. Disponibilité du nom vérifiée.
2. Méthode d'exposition validée par un professionnel de la commercialisation, si un audit chiffré est vendu.

### Avant la première livraison

1. Licences des polices incorporées vérifiées.
2. Standard de transcription braille établi, si la chaîne tactile est livrée.
3. Corpus publicitaire établi, si le module de régie est livré.
4. Une session d'essai sur usagers menée.

---

## K5. Tenue du registre

- Ce registre remplace les huit listes antérieures. Les sections C5, D18, E19, F19, G10, H14, I7 et J10 ne sont plus tenues à jour et ne font plus foi.
- Un point ouvert nouveau s'ajoute ici, avec sa nature, son responsable, son déclencheur et son niveau de blocage. Un point sans responsable n'est pas un point ouvert, c'est un souhait.
- Un point se ferme par une décision écrite ou par un livrable, jamais par oubli.
- Le registre est relu à chaque fin d'incrément. Un point ouvert depuis plus de deux incréments sans mouvement est soit requalifié en décision, soit abandonné explicitement.

---

## K6. Ce qui reste, après tout

Deux choses, et elles ne sont pas de même nature.

**La première est mesurable.** Quinze sujets, tous avec un responsable et un déclencheur. Aucun n'est mystérieux, aucun ne demande une percée technique. Ils demandent des études, des avis et des essais, c'est-à-dire du temps et un peu d'argent.

**La seconde ne figure dans aucun registre.** Ce produit repose aujourd'hui sur une seule personne, qui en détient la méthode et qui exerce par ailleurs des fonctions de direction à temps plein. Aucune partie de ce cahier des charges ne corrige cela, et les quinze sujets ci-dessus se ferment d'autant plus lentement.

C'est le seul point ouvert qui ne se résout ni par une étude, ni par du code, ni par une décision écrite.
