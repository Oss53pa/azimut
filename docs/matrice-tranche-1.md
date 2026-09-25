# Matrice de traçabilité — tranche 1

Périmètre : module 01 et les cinq écrans de la partie M. Confrontée au cahier
des charges consolidé, et à lui seul.

Règle de lecture : **une exigence sans preuve par un essai est absente**, même
si du code paraît la couvrir. Un état « tenu » porte donc toujours le fichier
d'essai qui le prouve.

Établie le 22 septembre 2026. Révisée le 23 septembre 2026, puis le même jour
après la remise de la version en cours du cahier des charges consolidé.

---

## 1. Module 01, règles M01.S1 à M01.S10 (N1.3)

| Règle | État | Preuve |
| --- | --- | --- |
| **M01.S1** Le repère site est fixé au premier calage et jamais modifié | tenu | `state/__tests__/plan-calibration-commands.test.ts` — le second calage ne réécrit pas l'origine ; `db/__tests__/site-origin-check.test.ts` — la contrainte tient les deux colonnes ensemble |
| **M01.S10** Toute arête entre deux bâtiments porte sa ligne `building_link` | **tenu** | `engine-graph/__tests__/checks-structure.test.ts` — `GRAPH.BUILDING_LINK_MISSING`, son contre-exemple, et la remontée jusqu'à `validateGraph` ; `state/__tests__/graph-vertical-link.test.ts` — l'outil de liaison écrit l'arête et sa ligne en un geste. Le cas et son contre-exemple sont désormais portés par des sites de référence : `ref-broken` porte l'arête entre bâtiments sans sa ligne, `ref-retail` les deux passages avec la leur, une couverte et une non couverte (C1). La table existait en base depuis la migration 0004 sans que rien ne la lise. Limite déclarée par la règle : aucun calcul ne lit encore l'attribut de passage couvert |
| **M01.S2** Aucune coordonnée en pixels stockée | **tenu** | `db/__tests__/n1-3-no-pixels-in-schema.test.ts` — analyse du schéma entier, comme N1.7 critère 2 l'exige. Plus aucune infraction déclarée : la migration 0043 a supprimé `control_point`, et `plan_calibration_point` reste la seule table de points de calage |
| **M01.S3** Une empreinte `cell` porte un code | tenu | `engine-graph/__tests__/unit-code.test.ts`, `core-model/__tests__/partie-n-codes.test.ts` |
| **M01.S4** Une destination est rattachée à une empreinte et à un nœud d'accès | tenu | `engine-graph/__tests__/validate-directory.test.ts` — `GRAPH.DESTINATION_UNLINKED` |
| **M01.S5** L'historique d'occupation est conservé | tenu | `core-model/__tests__/occupancy.test.ts` — quatre occupants successifs sur une cellule, l'occupant en vigueur à une date, le recouvrement rendu plutôt que tranché. Les colonnes existent depuis la migration `0020` ; c'est la lecture qui manquait |
| **M01.S6** `edge.length_m` calculée, jamais saisie | tenu | `state/__tests__/graph-input.test.ts` — recalcul à chaque déplacement, dénivelée comprise |
| **M01.S7** La couche d'habillage ne participe à aucun calcul | tenu | `tests/s7-habillage-hors-calcul.test.ts` — `SiteData` ne porte aucune table d'habillage, et aucun des cinq moteurs ne la nomme ni n'importe l'atelier |
| **M01.S8** Légende et rose des vents générées, jamais dessinées | tenu | `core-model/__tests__/plan-legend.test.ts` — la légende tombe dès que sa dernière destination s'en va ; la rose suit la rotation de la carte (D6.3) |
| **M01.S9** Fond remplacé : calage conservé si les dimensions concordent | tenu | `state/__tests__/plan-import.test.ts` — les deux branches, et la conséquence nommée |

**Les dix règles sont tenues**, sans dette déclarée.

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
| 3. Chaque cas de `validateGraph` a son site et son contre-exemple | tenu | `engine-graph/__tests__/n1-7-3-cas-et-contre-exemple.test.ts` — 18 essais. A révélé que `GRAPH.DESTINATION_UNLINKED` n'était levé par rien. `GRAPH.BUILDING_LINK_MISSING` a rejoint la liste avec `ref-broken` pour cas et `ref-retail` pour contre-exemple |
| 4. L'historique survit à trois changements successifs | tenu | `core-model/__tests__/occupancy.test.ts` — quatre occupants, donc trois changements |

## 2. Écrans de la partie M, critères d'acceptation

### M2, import et calage — 5 critères

| Critère | État | Preuve |
| --- | --- | --- |
| 1. Distance restituée à moins de 1 % | tenu | `domain/__tests__/plan-calibration.test.ts` — une distance tierce, droite, oblique, et au calage le plus serré |
| 2. Calage rejoué donne le même résultat | tenu | même fichier — « rend deux fois le même résultat pour la même saisie » |
| 3. Aucune coordonnée en pixels en base | tenu | `plan-calibration-commands.test.ts`, complété par le garde de schéma de §1 |
| 4. Parcours réalisable au clavier seul | tenu | `tests/e2e/m8-tranche.spec.ts`, critère 2. Le critère était porté tenu à tort : les deux points de calage n'étaient saisissables nulle part, et l'adaptateur en posait deux d'office à la validation |
| 5. Remplacement de fond : confirmation nommant la conséquence | tenu | `plan-import.test.ts` + `tests/e2e/m7-screen-rules.spec.ts` M7.9 |
| — État « Partiel » : l'écran dit pourquoi le tracé reste inaccessible | tenu | `tests/e2e/m7-screen-rules.spec.ts` M7.1 — le motif suit la saisie, et le nord franc n'est pas une absence d'orientation. `blockingReason` le calculait depuis toujours, affiché nulle part |

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
| — Propriétés d'un nœud et d'une arête, atteignables et écrites | tenu | `tests/e2e/m4-proprietes.spec.ts` — la zone de travail rend le graphe, la sélection remplit le panneau au pointeur comme au clavier, et déplacer un nœud recalcule la longueur de ses arêtes. Les deux panneaux étaient construits et inatteignables |
| — Affichage : forme, trait interrompu, liseré | tenu | `viewport/GraphView.tsx` branche `graph-encoding`, qui portait l'encodage en donnée sans qu'aucun écran l'appelle ; `tests/e2e/greyscale.spec.ts` |
| — Outil « Arête », tenu au niveau courant | tenu | `tests/e2e/m4-arete-niveau.spec.ts` — tracer au rez-de-chaussée ne pose aucune arête à l'étage. L'outil relisait le magasin entier au lieu des nœuds du niveau : il appariait des nœuds d'étages différents en les écrivant comme s'ils étaient sur le niveau courant. Sur `ref-multilevel`, l'étage passait de trois arêtes à six. Le défaut était hors d'atteinte tant que l'atelier ne connaissait qu'un niveau |
| — Le type du nœud se choisit avant le geste | tenu | `tests/e2e/m8-tranche.spec.ts` — le sélecteur précède le bouton, et l'essai du critère 2 l'atteint au clavier. Il n'existait qu'au panneau de propriétés, donc après coup, et l'écran ne posait que des carrefours |
| 2. Longueur jamais saisissable, recalculée | tenu | `graph-input.test.ts` ; M7.3 en bout en bout |
| 3. Arête inter-niveaux sans liaison refusée, avec proposition | tenu | `graph-input.test.ts` — `GRAPH.VERTICAL_LINK_MISSING` et le remède ; `tests/e2e/t-1-5-liaison-verticale.spec.ts` — la proposition ouvre l'outil qui crée la liaison |
| — Outil « Liaison verticale », touche `L` | tenu | `state/__tests__/graph-vertical-link.test.ts` — 7 essais ; `tests/e2e/t-1-5-liaison-verticale.spec.ts` — la touche, le passage d'un niveau à l'autre, l'arête et la liaison en un geste annulable |
| — Largeur utile héritée du bâtiment, `building.default_edge_width_m` | tenu | `state/__tests__/edge-width.test.ts` — le chemin arête → niveau → bâtiment, et ce qu'il fait d'un bâtiment qui ne déclare rien ; `tests/e2e/m4-largeur-heritee.spec.ts` — sur `ref-retail`, une arête tracée dans la galerie reçoit 2,4 m et la même dans l'annexe 1,1 m. L'écran posait une valeur unique, écrite dans son code, pour toutes les arêtes de tous les sites |
| 4. Graphe saisissable au clavier seul | tenu | `m8-tranche.spec.ts`, critère 2 |

Les quatre outils de M4 sont construits, et leurs quatre touches sont liées.
La liaison verticale l'est par la tâche T-1.5 : la session porte désormais
tous les niveaux du site, la barre de niveaux passe de l'un à l'autre, l'écran
est tenu au sien, et l'outil écrit l'arête inter-niveaux et sa liaison en un
seul geste annulable. `GRAPH.VERTICAL_LINK_MISSING` est levé avec son remède,
et l'appliquer ouvre l'outil qui le corrige au lieu de ne rien faire.

Ce qui reste hors de l'atelier : la **création** d'un niveau. M1 en crée un à
la création du site, et aucun des cinq écrans de la tranche n'en ajoute. N1.5
range la fiche de site parmi les écrans qui « restent à spécifier », et c'est
là que la gestion des bâtiments et des niveaux appartient. Les niveaux d'un
site viennent donc du dépôt. Voir §5.

### M1bis, fiche de site — 5 critères

| Critère | État | Preuve |
| --- | --- | --- |
| 1. Deux bâtiments et quatre niveaux se créent par l'écran seul | tenu | `tests/e2e/m1bis-fiche-site.spec.ts` — sans intervention en base. C'est ce critère qui débloque T-1.5 : sans second niveau, l'outil de liaison verticale n'a rien à relier |
| 2. Deux niveaux de même rang refusés | tenu | `state/__tests__/site-structure.test.ts` et l'essai de bout en bout — `DATA.LEVEL_ORDINAL_DUPLICATE` |
| 3. Un niveau portant des empreintes ou des nœuds ne se supprime pas | tenu | même paire d'essais — `DATA.LEVEL_NOT_EMPTY`, et l'écran dit ce que le niveau porte au lieu de laisser presser puis refuser |
| 4. L'altitude saisie est celle que lit la géométrie | tenu | essai de bout en bout, relu au magasin ; l'outil de liaison verticale en tire la longueur de l'arête |
| 5. Parcours complet au clavier seul | tenu | essai de bout en bout, sans un clic |

Rang et altitude sont requis sans code d'anomalie : M1bis en donne un au nom
et au rang en double, aucun à leur absence. Le refus est donc préventif —
l'action reste inactive tant que les trois champs ne sont pas saisis — plutôt
que d'ajouter au catalogue que la version 11 vient de compléter.

### M1 et M5

M1 et M5 ne portent pas de critères numérotés. Leurs règles d'écran sont
couvertes par M7 ci-dessous.

Le formulaire de création de M1 n'est plus bloqué. La version en cours du
cahier des charges lui donne six champs : nom, pays, fuseau requis, paquet de
règles facultatif, langues actives, et entité juridique facultative affichée
sous condition. C'est ce que l'écran porte, et ce que `site-creation.ts`
contrôle. La contradiction sur les champs requis n'existe plus.

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
| 4. Le temps du parcours mesuré et consigné | tenu | `docs/releve-m8-parcours.json` — protocole D13 : cinq exécutions, la première écartée, médiane retenue, machine et condition déclarées. **Le relevé fait foi, et ce tableau n'en recopie aucun chiffre** : chaque passage de la suite le réécrit, la médiane bouge d'un passage à l'autre de l'ordre de dix pour cent sur cette machine, et un chiffre recopié ici vieillirait en silence. C'est ce qui venait d'arriver : la ligne annonçait une médiane que le relevé ne portait plus |
| 5. Absence de violation détectable automatiquement sur les cinq écrans | tenu | `tests/e2e/a11y-axe.spec.ts` — 22 essais, axe-core borné aux niveaux A et AA de WCAG 2.0, 2.1 et 2.2, dans les deux langues. Zéro violation, zéro incomplet. La conformité AA elle-même relève de l'audit externe du lot 4.7 |
| 6. Aucune couleur en dur, aucun espacement hors échelle, aucune chaîne dans un composant | tenu | `design-tokens/__tests__/no-hardcoded-colors.test.ts`, `spacing-scale.test.ts`, contrôle du dictionnaire i18n |

Le critère 4 est un parcours automatisé. K3.4 place la mesure sur opérateur
réel dans les sessions d'essai sur usagers, qui n'ont pas eu lieu.

## 5. Ce qui bloque, et sur quoi

| Sujet | Nature | Ce qu'il faut |
| --- | --- | --- |
| Secrets du banc d'essai | Résolu. Le secret de signature des jetons et le mot de passe du rôle `authenticator` étaient écrits en clair, au motif qu'ils étaient jetables — le même motif pour les deux, et A6.3 ne distingue pas les secrets selon leur portée. Ils passent par `AZIMUT_TEST_JWT_SECRET` et `AZIMUT_TEST_POSTGREST_DB_URI`, sans valeur de repli ; la chaîne d'intégration tire le secret à chaque exécution et le masque du journal | Rien. `tests/a6-3-no-secret-in-repo.test.ts` balaie le dépôt et refuse qu'un secret y revienne, en tolérant une valeur nommée et motivée plutôt qu'un fichier entier |
| Intermittence de `tests/e2e/keyboard-traversal.spec.ts` | Essai vert. La cause est **probable et non prouvée** : l'attente du rendu ajoutée avant la tabulation corrige une course réelle — `page.goto` rend la main avant que React 18 n'ait rendu — mais l'échec n'a jamais été reproduit, ni par vingt-quatre sondes dédiées ni par six exécutions complètes. Rien ne prouve que c'était cette course-là | Rien tant que l'essai reste vert. Une garde bornée fait désormais échouer l'essai sur « l'application n'a rien rendu », avec le corps du document, pour qu'une régression se présente comme une erreur et non comme une intermittence. Si l'intermittence revient, le point se rouvre et la cause est à chercher ailleurs |
| Fiabilité du relevé du critère 4 | Résolu par le protocole D13 : cinq exécutions, la première écartée, médiane retenue, machine déclarée. Les quatre exécutions retenues tiennent dans 5,6 %, contre un rapport de 1 à 1,7 en relevés isolés | Rien. Conservé ici pour mémoire jusqu'à la prochaine relecture du registre |
| `loadSiteData` sans identité | Sous `FORCE ROW LEVEL SECURITY`, il ne lit rien ; son unique appelant de production, `apps/compiler/src/kiosk-package-job.ts`, ne pose ni rôle ni identité | À traiter dans la tranche qui touche le service de compilation |
| Liaisons entre bâtiments et `inputs_hash`, D7.1 | Décision retenue et écrite, avec sa réserve. Les liaisons entre bâtiments n'entrent pas dans `inputs_hash`, parce qu'aucun calcul de parcours ne lit aujourd'hui leur attribut de passage couvert : une empreinte d'invalidation ne porte que ce dont un résultat dépend. **Réserve :** le jour où un profil préférera les cheminements couverts, elles devront y entrer, faute de quoi un changement de passage laisserait des parcours faux en cache | Rien à construire. `engine-graph/__tests__/compute-hashes.test.ts` garde la réserve visible : deux essais, l'un montrant que retourner les deux `sheltered` ne bouge pas l'empreinte, l'autre que l'arête qui les porte, elle, la bouge. Le jour venu, c'est le premier qu'il faudra retourner, et `compute-hashes.ts` est le premier fichier à reprendre |
| Desserte des entrées | **Clos.** Avertissement et non refus, et portée limitée aux entrées empruntées par au moins un profil de visiteur. La version 13 l'inscrit au catalogue sous cette forme. Le renvoi tombe à `null` : aucune règle numérotée ne porte ce contrôle, et un renvoi inventé vaudrait moins que pas de renvoi | Rien. Conséquence déclarée : un site sans profil ne lève rien, ce qui est le cas de la session d'atelier de la tranche 1 |
| Alignement des liaisons verticales | **Clos.** Le contrôle exempte l'escalier mécanique et la rampe, qui gagnent leur hauteur en avançant : leurs deux têtes ne peuvent pas coïncider en plan. La version 13 l'inscrit au catalogue sous cette forme — « ascenseurs et escaliers droits seulement, tolérance de la section D1.5 » — et le renvoi de l'anomalie va désormais à D1.5 | Rien. Le contrôle est retenu tel quel par l'éditeur |
| Codes du dépôt hors du catalogue du consolidé | **Clos par la version 13.** Les 93 codes du relevé sont inscrits au catalogue du consolidé, avec leur gravité et leur sens ; les libellés du dépôt sont alignés sur les leurs. Trois codes sont retirés et réservés — deux d'annulation et celui du vocabulaire illisible — parce que ce sont des états d'écran de F7 et non des anomalies de moteur ; leurs points d'appel ont disparu avec eux. `PARK` et `DOC` sont admis en D2.1 et fondés par la règle M01.S11 ; `CHARTER`, déclaré et vide, est retiré des domaines du dépôt | Rien à arbitrer. `tests/catalogue-consolide.test.ts` lit le consolidé lui-même et recoupe les deux catalogues dans les deux sens : gravités, libellés, codes, domaines, codes réservés. Vingt-trois codes du consolidé restent hors du dépôt, tous de modules non construits, nommés un par un avec leur section. `docs/inventaire-codes.md` garde le relevé qui a servi à l'arbitrage |
| Report de niveau, E7.2 | Copier les circulations et les noyaux verticaux d'un niveau à l'autre. Le registre de la partie K le range en « T-1.5, étendue » | Non construit. Il vient après l'outil de liaison, et demande le magnétisme et la duplication de E7.2, qui relèvent de T-1.2c et T-1.2d |

## 6. Divergences hors tranche, relevées à la consolidation

Sans effet sur la tranche 1, à traiter avant les tranches qui les touchent :
signature de `resolveFaceContent`, colonnes absentes de `pictogram` et de
`charter_color`, douze modules au lieu de treize plus la plateforme dans
`module-ownership.ts`, et `delivery_package` divergente de O16.

**Clos par la version 14.** Les deux divergences ouvertes par la version 13 sont
traitées :

- `site_fact` est alignée sur A5.11 par la migration 0044 — `status` avec ses
  trois valeurs, `value` en `jsonb`, `source` renommée `source_ref` et
  `recorded_on` renommée `declared_at`, `declared_by` ajoutée. Deux écarts
  restent, déclarés : `declared_by` est un ajout et non un renommage, la table
  n'ayant aucune colonne d'auteur, et `declared_at` garde le type `date`,
  qu'A5.11 ne type pas. Les deux contrôles que D2.2 définit au niveau du fait,
  `PARK.SOURCE_MISSING` et `PARK.PROPOSAL_AS_EXISTING`, se lèvent désormais sur
  le fait et non plus sur les objets de stationnement ;
- `LAYOUT.FORBIDDEN_CHARACTER` et `LAYOUT.SENTENCE_TOO_LONG` lisent
  `charter_rule`. `FORBIDDEN_CHARACTERS` et `MAX_WORDS_PER_SENTENCE` sont
  supprimées, la charte entre dans la signature des deux contrôles et dans
  celle de leurs appelants, et l'absence de règle laisse le contrôle non exercé
  sans valeur par défaut, comme A5.8 l'exige depuis la version 14.

**Clos par la version 15.** Les deux écarts ouverts par la version 14 sont
tranchés par l'éditeur :

- une règle de charte déclarée dont les paramètres ne se lisent pas lève
  `CHARTER.RULE_MALFORMED`, bloquant. Le domaine `CHARTER` est rétabli en D2.1,
  et le catalogue écrit la distinction : une règle absente ne s'exécute pas et
  le signale, une règle déclarée et cassée bloque, parce qu'elle a été voulue.
  Le contrôle sort des non exercés : il a lu la charte et l'a refusée, ce qui
  n'est pas la même chose que n'avoir rien à opposer ;
- le statut d'un fait et celui d'un objet restent distincts, et A5.11 le dit
  désormais en toutes lettres. Pas de seconde migration. Le statut des objets
  de stationnement garde ses quatre valeurs, dont `retire`, qu'A5.11 ne donne
  pas et n'a pas à donner.

Défaut trouvé en appliquant le premier point, et corrigé par la migration
0045 : la contrainte de `charter_rule.kind` n'admettait que cinq des sept
natures d'A5.8, celles de la migration 0006. Les deux natures que les contrôles
de rédaction lisent — `forbidden_character` et `max_sentence_words` — n'étaient
pas stockables. Le chemin existait sans que rien puisse l'emprunter.

Les cinq natures de règle de charte qu'aucun contrôle ne consomme restent sans
forme de paramètres déclarée, volontairement : chacune sera définie quand un
contrôle la lira. Le compte est celui d'A5.8 : sept natures, deux consommées,
cinq en attente. L'éditeur l'a confirmé en version 16.

**Clos par la version 16.** L'objet `parking` cesse d'être hors du cahier des
charges, et la façon dont il y entre défait ce que le dépôt en avait fait :

- la migration 0045 est ratifiée. Elle était nécessaire à la version 15, mais
  elle n'avait pas été demandée : l'éditeur la retient comme une extension de
  périmètre, à soumettre avant et non après ;
- la section S8 tranche le modèle du stationnement, sans table nouvelle. Une
  place est une empreinte de nature `parking_space`, ajoutée à l'énumération
  d'A5.2 et à la contrainte de base par la migration 0046 ; un parking est une
  zone de nature `parking`, que la migration 0029 admettait déjà sans que rien
  s'en serve ; la capacité annoncée reste un fait du site ;
- l'exclusion définitive de l'édition simultanée, en G4.1, est levée par S6.
  Aucun artefact vivant du dépôt ne la citait — les deux mentions qui
  subsistent sont dans les documents antérieurs, conservés pour l'historique —
  donc il n'y avait rien à retirer, seulement à le vérifier.

**Ouvert par la version 16, et bloquant pour le rattachement des contrôles
`PARK` aux objets du socle.** Trois questions, les deux premières au titre
d'A2.2, point 2, la troisième au titre du point 7 :

1. **Comment un fait de capacité désigne son parking.** S-36 dit que les
   contrôles « comparent le compte des empreintes de nature `parking_space` à
   ce fait déclaré », au singulier. Mais `site_fact.key` est unique par site et
   A5.11 ne donne au fait aucune référence d'objet. Un site à deux parkings
   exige donc soit une convention de clé qui nomme la zone, soit une colonne de
   référence. Ni l'une ni l'autre n'est écrite, et les inventer serait un choix
   de modèle non prévu en A5.
2. **Comment une empreinte appartient à une zone.** Le code
   `DATA.PARKING_SPACE_WITHOUT_ZONE` demande de voir une place « hors de toute
   zone de nature `parking` ». A5.2 ne donne à `zone` ni géométrie ni liste
   d'empreintes ; la zone d'orientation d'H11, qui porte `footprint_ids`, est
   une autre table, avec ses propres natures, et M02.W12 ne parle que d'elle.
   L'appartenance n'est donc pas calculable en l'état. Le code est inscrit aux
   non construits avec ce motif.
3. **Le sort des quatre tables du dépôt** — `parking`, `parking_space`,
   `parking_uncovered_area`, `vehicle_gate` — que S-35 rend redondantes. Les
   supprimer est une migration destructrice. Et `parking_uncovered_area` n'est
   pas qu'une redondance : la zone non couverte est ce qui distingue un parking
   à demi numérisé d'un parking en écart, et `PARK.CAPACITY_UNEXPLAINED` s'y
   appuie. S8 ne lui donne aucun équivalent parmi les objets du socle.

**Construit pour la tranche, sur les trois éléments de la partie S qui la
concernent.** Les calques thématiques (S-10 à S-12) et la coloration de travail
(S-8, S-9) entrent au modèle : dix clés de calque fermées, deux visibilités
distinctes dont celle d'impression que l'esquisse ne peut pas porter — le refus
emprunte `SKETCH.IN_DELIVERABLE`, que D2.2 portait déjà — et une coloration
dont la lecture exige un identifiant d'utilisateur, ce qu'aucun moteur n'a à
donner. La persistance attend les tables `view_layer` et `work_color` de S9.

Reste non construit de la partie S, et inscrit comme tel : les quatre codes
`EXPORT.*` et `ASSIST.*` du tableau S10, rattachés aux incréments 2 et 5 par
S11. L'assistant et l'édition simultanée sont de taille XL, à découper avant
tout développement.

Les domaines d'anomalie et les codes hors catalogue sont clos par la version 13
du consolidé : `PARK` et `DOC` y sont admis, `CHARTER` est retiré du dépôt, et
les codes `EDIT.*` qui manquaient sont inscrits ou retirés. Voir le §5.

Ajouts de la version du 22 septembre, décisions 82 à 90 de l'annexe Z :
`support.code` absent du schéma, `message_line.excluded` et
`exclusion_reason` absents du type comme de la base, règle M02.W11 sans code, et
`FileNameParts.reference` qui nomme désormais autre chose que ce que D11
décrit. Les migrations se font dans la tranche où leur table est concernée.
