# Matrice de traçabilité — tranche 1

Périmètre : module 01 et les cinq écrans de la partie M. Confrontée au cahier
des charges consolidé, et à lui seul.

Règle de lecture : **une exigence sans preuve par un essai est absente**, même
si du code paraît la couvrir. Un état « tenu » porte donc toujours le fichier
d'essai qui le prouve.

Établie le 22 septembre 2026. Révisée le 23 septembre 2026.

---

## 1. Module 01, règles M01.S1 à M01.S9 (N1.3)

| Règle | État | Preuve |
| --- | --- | --- |
| **M01.S1** Le repère site est fixé au premier calage et jamais modifié | tenu | `state/__tests__/plan-calibration-commands.test.ts` — le second calage ne réécrit pas l'origine ; `db/__tests__/site-origin-check.test.ts` — la contrainte tient les deux colonnes ensemble |
| **M01.S2** Aucune coordonnée en pixels stockée | **tenu avec une infraction déclarée** | `db/__tests__/n1-3-no-pixels-in-schema.test.ts` — analyse du schéma entier, comme N1.7 critère 2 l'exige. Deux colonnes en infraction, voir §5 |
| **M01.S3** Une empreinte `cell` porte un code | tenu | `engine-graph/__tests__/unit-code.test.ts`, `core-model/__tests__/partie-n-codes.test.ts` |
| **M01.S4** Une destination est rattachée à une empreinte et à un nœud d'accès | tenu | `engine-graph/__tests__/validate-directory.test.ts` — `GRAPH.DESTINATION_UNLINKED` |
| **M01.S5** L'historique d'occupation est conservé | tenu | `core-model/__tests__/occupancy.test.ts` — quatre occupants successifs sur une cellule, l'occupant en vigueur à une date, le recouvrement rendu plutôt que tranché. Les colonnes existent depuis la migration `0020` ; c'est la lecture qui manquait |
| **M01.S6** `edge.length_m` calculée, jamais saisie | tenu | `state/__tests__/graph-input.test.ts` — recalcul à chaque déplacement, dénivelée comprise |
| **M01.S7** La couche d'habillage ne participe à aucun calcul | tenu | `tests/s7-habillage-hors-calcul.test.ts` — `SiteData` ne porte aucune table d'habillage, et aucun des cinq moteurs ne la nomme ni n'importe l'atelier |
| **M01.S8** Légende et rose des vents générées, jamais dessinées | tenu | `core-model/__tests__/plan-legend.test.ts` — la légende tombe dès que sa dernière destination s'en va ; la rose suit la rotation de la carte (D6.3) |
| **M01.S9** Fond remplacé : calage conservé si les dimensions concordent | tenu | `state/__tests__/plan-import.test.ts` — les deux branches, et la conséquence nommée |

**Les neuf règles sont tenues.** M01.S2 porte une dette nommée, arbitrage au §5.

Au 23 septembre, plus aucun critère numéroté de la partie M n'est porté
absent. Ce qui reste est au §5 : deux contradictions du document en attente
d'arbitrage, une infraction héritée dont le retrait serait une migration
destructrice, et trois réserves de périmètre nommées à leur place.

Correction du 22 septembre : une première rédaction de cette matrice déclarait
M01.S5 absente au motif que `destination` ne portait ni `valid_from` ni `valid_to`.
C'était faux — la migration `0020` les ajoute par `ALTER TABLE`, avec sa
contrainte. Le manque était la lecture de l'historique, pas son stockage.

## 1bis. Module 01, critères d'acceptation (N1.7)

| Critère | État | Preuve |
| --- | --- | --- |
| 1. Un site modélisé se recharge à l'identique | tenu | `db/__tests__/n1-7-1-rechargement.db.test.ts` — écriture par le chemin d'écriture, relecture par `loadSiteData`, cinq essais, contre une base réelle |
| 2. Aucune coordonnée en pixels en base, par analyse du schéma | tenu | `db/__tests__/n1-3-no-pixels-in-schema.test.ts`, une infraction déclarée au §5 |
| 3. Chaque cas de `validateGraph` a son site et son contre-exemple | tenu | `engine-graph/__tests__/n1-7-3-cas-et-contre-exemple.test.ts` — 18 essais. A révélé que `GRAPH.DESTINATION_UNLINKED` n'était levé par rien |
| 4. L'historique survit à trois changements successifs | tenu | `core-model/__tests__/occupancy.test.ts` — quatre occupants, donc trois changements |

## 2. Écrans de la partie M, critères d'acceptation

### M2, import et calage — 5 critères

| Critère | État | Preuve |
| --- | --- | --- |
| 1. Distance restituée à moins de 1 % | tenu | `domain/__tests__/plan-calibration.test.ts` — une distance tierce, droite, oblique, et au calage le plus serré |
| 2. Calage rejoué donne le même résultat | tenu | même fichier — « rend deux fois le même résultat pour la même saisie » |
| 3. Aucune coordonnée en pixels en base | tenu | `plan-calibration-commands.test.ts`, complété par le garde de schéma de §1 |
| 4. Parcours réalisable au clavier seul | tenu | `tests/e2e/m8-tranche.spec.ts`, critère 2 |
| 5. Remplacement de fond : confirmation nommant la conséquence | tenu | `plan-import.test.ts` + `tests/e2e/m7-screen-rules.spec.ts` M7.9 |

### M3, tracé des empreintes — 4 critères

| Critère | État | Preuve |
| --- | --- | --- |
| 1. Polygone auto-intersectant refusé, tracé conservé | tenu | `state/__tests__/footprint-input.test.ts` ; M7.5 en bout en bout |
| 2. Coordonnées en mètres, quantifiées au millimètre | tenu | `core-model/__tests__/quantize-d1-4.test.ts` — arrondi au plus loin de zéro, jamais de zéro négatif ; `state/__tests__/footprint-input.test.ts` — « quantifie les sommets à la fermeture » |
| 3. Souris et clavier produisent des données identiques | tenu | `footprint-input.test.ts` |
| 4. Duplication en série de 20 cellules, une commande annulable | tenu | `state/__tests__/footprint-series.test.ts` — le jugement de la série, 8 essais ; `tests/e2e/m3-serie.spec.ts` — vingt copies, un `Ctrl+Z`, l'original seul reste, et le contre-exemple du second appui qui refuse la série entière sans rien écrire |
| — Table des raccourcis opposable | tenu | `tests/e2e/m3-serie.spec.ts` — `Ctrl+D` déclenche la série. La table était affichée et liée à rien : `Entrée`, `Échap`, `Retour arrière` et `Ctrl+D` ne faisaient rien |

### M4, saisie du graphe — 4 critères

| Critère | État | Preuve |
| --- | --- | --- |
| 1. Un axe tracé en une passe produit nœuds et arêtes, sans doublon | tenu | `state/__tests__/graph-axis.test.ts` — 10 essais, dont le doublon de nœud, le doublon d'arête dans les deux sens, et leurs contre-exemples ; `tests/e2e/m4-axe.spec.ts` — la passe est un geste, donc une annulation, et l'écran rend compte de ce qu'il a repris |
| — Le type du nœud se choisit avant le geste | tenu | `tests/e2e/m8-tranche.spec.ts` — le sélecteur précède le bouton, et l'essai du critère 2 l'atteint au clavier. Il n'existait qu'au panneau de propriétés, donc après coup, et l'écran ne posait que des carrefours |
| 2. Longueur jamais saisissable, recalculée | tenu | `graph-input.test.ts` ; M7.3 en bout en bout |
| 3. Arête inter-niveaux sans liaison refusée, avec proposition | tenu | `graph-input.test.ts` — `GRAPH.VERTICAL_LINK_MISSING` et le remède |
| 4. Graphe saisissable au clavier seul | tenu | `m8-tranche.spec.ts`, critère 2 |

Réserve sur la table des outils : trois des quatre outils de M4 sont
construits — nœud, arête, axe de circulation. Le quatrième, la liaison
verticale, ne l'est pas : elle relie deux nœuds de niveaux différents, et la
session de la tranche porte un niveau. `GRAPH.VERTICAL_LINK_MISSING` est levé
avec son remède, mais l'appliquer ne fait rien. La liaison entre avec le
module 02.

### M1 et M5

M1 et M5 ne portent pas de critères numérotés. Leurs règles d'écran sont
couvertes par M7 ci-dessous. Une réserve subsiste : le formulaire de création
de M1 reste **bloqué** par la contradiction du §5 sur les champs requis ; il
est monté et éprouvé, et lit le référentiel des pays de Q9.

L'écran M5 fait tourner `validateGraph`. Il portait auparavant, dans l'écran,
une reprise à la main de deux des quatorze contrôles du moteur, et affichait
« aucune anomalie » sur n'importe quel graphe. Le moteur ne demandait le site
entier que par sa signature : il n'en lit que six champs, que `GraphScope`
nomme désormais, et `graphScopeFromSession` les assemble depuis la session
sans rien compléter. Preuve : `state/__tests__/session-scope.test.ts`,
`engine-graph/__tests__/graph-scope.test.ts`, et le contre-exemple de bout en
bout — quatre carrefours, aucune entrée, `GRAPH.NO_ENTRANCE` nommé à l'écran.

`runChecks` reste hors tranche : il porte les contrôles sémantiques — annuaire,
lexique de charte, faits de site — dont aucun n'a de donnée à lire avant le
module 02.

## 3. M7, les onze règles d'écran

Toutes tenues, et opposables par un essai nommé dans
`tests/e2e/m7-screen-rules.spec.ts` : un bloc `describe` par règle, de M7.1 à
M7.11, 21 essais.


**M7.6** est désormais vérifiée dans les deux sens : le parcours sans anomalie,
et le graphe sans entrée que l'écran refuse en nommant le code.

## 4. M8, les six critères de la tranche

| Critère | État | Preuve |
| --- | --- | --- |
| 1. La chaîne fonctionne, site vide → graphe validé | tenu | `m8-tranche.spec.ts` |
| 2. Le même parcours au clavier seul | tenu | même fichier, sans un seul clic |
| 3. Le même parcours hors ligne, synchronisation au retour | tenu | même fichier, trois essais : file hors ligne, reprise proposée, abandon sans fusion |
| 4. Le temps du parcours mesuré et consigné | tenu | `docs/releve-m8-parcours.json` — quatre étapes. Le parcours a coûté environ 200 ms de plus depuis que le type du nœud se choisit et que le moteur tourne réellement |
| 5. Absence de violation détectable automatiquement sur les cinq écrans | tenu | `tests/e2e/a11y-axe.spec.ts` — 22 essais, axe-core borné aux niveaux A et AA de WCAG 2.0, 2.1 et 2.2, dans les deux langues. Zéro violation, zéro incomplet. La conformité AA elle-même relève de l'audit externe du lot 4.7 |
| 6. Aucune couleur en dur, aucun espacement hors échelle, aucune chaîne dans un composant | tenu | `design-tokens/__tests__/no-hardcoded-colors.test.ts`, `spacing-scale.test.ts`, contrôle du dictionnaire i18n |

Le critère 4 est un parcours automatisé. K3.4 place la mesure sur opérateur
réel dans les sessions d'essai sur usagers, qui n'ont pas eu lieu.

## 5. Ce qui bloque, et sur quoi

| Sujet | Nature | Ce qu'il faut |
| --- | --- | --- |
| Rôle `marketing` | Contradiction du document : A5.1 énumère sept valeurs, sa phrase suivante en annonce six, A6.2 en définit six | Arbitrage. Ni ajouté, ni retiré |
| Champs requis à la création d'un site | Contradiction du document : M1 donne quatre champs, Q5.2 et O4 en rendent deux autres obligatoires à la création, avec codes bloquants | Arbitrage. L'écran reste conforme à M1 |
| `control_point.source_x_px`, `source_y_px` | Infraction à M01.S2, héritée d'une migration écrite d'après le complément « atelier » | Arbitrage : le retrait est une migration destructrice, A2.2 point 7 |
| `loadSiteData` sans identité | Sous `FORCE ROW LEVEL SECURITY`, il ne lit rien ; son unique appelant de production, `apps/compiler/src/kiosk-package-job.ts`, ne pose ni rôle ni identité | À traiter dans la tranche qui touche le service de compilation |
| Fiabilité du relevé du critère 4 | Sept mesures du même parcours sur la machine de développement : 1651, 1868, 1990, 2075, 2206, 2340, 2804 ms, un rapport de 1 à 1,7. L'écart entre deux états du code est plus petit que celui de la machine à elle-même | Une mesure isolée ne vaut pas comme base de révision. K3.4 place la mesure sur opérateur réel dans les sessions d'essai sur usagers ; en attendant, ne rien conclure d'un relevé unique |
| Panneau de propriétés de M4 | `selection` reste `null` : aucun geste ne le remplit. Libellé, position, largeur, pente, sens et cheminement d'évacuation sont spécifiés par M4 et inatteignables | Décision de périmètre : la sélection suppose la zone de travail, qui n'est pas construite |

## 6. Divergences hors tranche, relevées à la consolidation

Sans effet sur la tranche 1, à traiter avant les tranches qui les touchent :
signature de `resolveFaceContent`, colonnes absentes de `pictogram` et de
`charter_color`, domaines d'anomalie `CHARTER`, `PARK` et `DOC` hors de la
liste autorisée de D2.1, douze modules au lieu de treize plus la plateforme
dans `module-ownership.ts`, `delivery_package` divergente de O16, et trois
codes `EDIT.*` absents du catalogue.

Ajouts de la version du 22 septembre, décisions 82 à 90 de l'annexe Z :
`support.code` absent du schéma, `message_line.excluded` et
`exclusion_reason` absents du type comme de la base, règle M02.W11 sans code, et
`FileNameParts.reference` qui nomme désormais autre chose que ce que D11
décrit. Les migrations se font dans la tranche où leur table est concernée.
