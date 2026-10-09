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
| **M01.S2** Aucune coordonnée en pixels stockée | **tenu** | `db/__tests__/n1-3-no-pixels-in-schema.test.ts` — analyse du schéma entier, comme N1.7 critère 2 l'exige. Plus aucune infraction déclarée : la migration 0052 a supprimé `control_point`, et `plan_calibration_point` reste la seule table de points de calage |
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

- `site_fact` est alignée sur A5.11 par la migration 0053 — `status` avec ses
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
0054 : la contrainte de `charter_rule.kind` n'admettait que cinq des sept
natures d'A5.8, celles de la migration 0006. Les deux natures que les contrôles
de rédaction lisent — `forbidden_character` et `max_sentence_words` — n'étaient
pas stockables. Le chemin existait sans que rien puisse l'emprunter.

Les cinq natures de règle de charte qu'aucun contrôle ne consomme restent sans
forme de paramètres déclarée, volontairement : chacune sera définie quand un
contrôle la lira. Le compte est celui d'A5.8 : sept natures, deux consommées,
cinq en attente. L'éditeur l'a confirmé en version 16.

**Clos par la version 16.** L'objet `parking` cesse d'être hors du cahier des
charges, et la façon dont il y entre défait ce que le dépôt en avait fait :

- la migration 0054 est ratifiée. Elle était nécessaire à la version 15, mais
  elle n'avait pas été demandée : l'éditeur la retient comme une extension de
  périmètre, à soumettre avant et non après ;
- la section S8 tranche le modèle du stationnement, sans table nouvelle. Une
  place est une empreinte de nature `parking_space`, ajoutée à l'énumération
  d'A5.2 et à la contrainte de base par la migration 0055 ; un parking est une
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

**Clos par la version 17.** Les trois questions ouvertes par la version 16 sont
tranchées, et chacune l'est en corrigeant le modèle plutôt qu'en contournant :

1. **Un fait désigne son objet.** `site_fact` gagne `target_kind` et
   `target_id`, facultatifs, et l'unicité passe du couple site et clé au
   triplet site, clé et cible. Un site à deux parkings déclare donc deux
   capacités. Migration 0056, éprouvée aux deux sens.
2. **Une zone porte ses empreintes.** `zone.footprint_ids`, appartenance
   déclarée et non calculée, comme la zone d'orientation d'H11.
   `DATA.PARKING_SPACE_WITHOUT_ZONE` devient calculable, il est levé, et il
   sort des non construits. Migration 0057.
3. **La surface non numérisée est conservée**, et spécifiée en règle S-37.
   C'est elle qui explique un écart de capacité, et l'écart est admis à
   concurrence des places déclarées.

Deux précisions de la même version touchent du code écrit : M3 (partie M) offre
désormais cinq natures d'empreinte, la place de stationnement comprise, et S9
fixe la notation de `work_color.hex` sur celle des jetons de la partie F.

### Ce que portaient les trois tables de stationnement du dépôt

Relevé sur la base de développement et sur le code, non de mémoire. **Tranché à
la version 18, et fait** : voir « Le stationnement passé aux objets du socle »
plus bas. Ce relevé est conservé parce que c'est lui qui a servi à décider, et
que le retrait d'une table se juge sur ce qu'elle portait.

**`parking`** — 8 colonnes métier : `level_id`, `geometry` (polygone, mètres),
`name`, `free` (booléen, le parking est-il gratuit), `declared_capacity`
(entier positif ou nul), `status`, `source`. Contraintes : nom et source non
blancs, capacité non négative, statut parmi les quatre valeurs d'objet.

Ce que S8 remplace : `level_id`, `geometry` et `name` par `zone` ;
`declared_capacity` par un fait ciblé, puisque S-36 fait de la capacité annoncée
un fait du site. Ce qui n'a pas d'équivalent : **`free`**, qui n'est ni une
nature de zone ni un fait déclaré aujourd'hui — un parking gratuit est pourtant
ce qu'un plan d'accueil écrit, et `bound-text.ts` cite `parking.capacite` comme
exemple de liaison de document. Il deviendrait naturellement un fait ciblé,
mais aucune section ne le dit.

Lu par : `audit-parking`, `validate-geometry` (le polygone du parking est
validé comme les autres), `document-bindings` (qui compare capacité annoncée et
places numérisées pour les textes liés), `render-floor-plan` (qui dessine les
parkings d'un niveau).

**`parking_space`** — 6 colonnes métier : `parking_id`, `kind`
(`standard`, `pmr`, `livraison`), `row_label` (rangée ou travée du plan
source), `geometry` (facultative), `status`, `source`.

Ce que S8 remplace : `geometry` et l'appartenance par une empreinte de nature
`parking_space` et la liste de la zone. Ce qui n'a pas d'équivalent : **`kind`**
— une place PMR n'est pas une place ordinaire, et A5.2 ne donne à `footprint`
aucune colonne pour le dire — et **`row_label`**, le repère de travée qui fait
le lien avec le plan papier.

Lu par : `audit-parking`, `document-bindings`, `render-floor-plan`.

**`vehicle_gate`** — 6 colonnes métier : `level_id`, `code` (repère du plan
source, V1 à V5 sur le site qui a servi de relevé), `role`, `width_m`
(strictement positive), `position` (point), `status`, `source`.

**Rien de cette table n'est lu.** Elle se charge dans `SiteData.vehicle_gates`,
et aucun moteur, aucun rendu, aucun contrôle ne la consulte. Elle n'a pas non
plus d'équivalent au socle : un portail véhicule n'est ni une empreinte, ni une
zone, ni un nœud du graphe de circulation, qui porte des cheminements piétons.
C'est la seule des trois dont la suppression ne perdrait aucune fonction
existante — et la seule dont la donnée n'est reprise nulle part.

La quatrième, `parking_uncovered_area`, portait `parking_id`, `geometry`
facultative et `reason` non blanche. La version 18 a tranché autrement que ce
paragraphe ne le prévoyait : la marque d'une empreinte non numérisée est
l'existence du fait qui la cible, et la table part.

### Le stationnement passé aux objets du socle — version 18

L'éditeur a tranché les trois tables. Fait en six commits, un par migration,
les lectures migrées avant toute suppression, comme demandé.

**Ce que chaque chose est devenue.**

| Ce qui était porté | Où c'est passé |
| --- | --- |
| `parking.geometry`, `parking.level_id` | Les empreintes que la zone déclare, `zone.footprint_ids` |
| `parking.name` | `zone.name` |
| `parking.declared_capacity` | Fait `parking.capacity`, entier, ciblant la zone |
| `parking.free` | Fait `parking.free`, booléen, ciblant la zone |
| `parking_space.geometry` | L'empreinte de nature `parking_space` |
| `parking_space.parking_id` | La liste d'empreintes de la zone |
| `parking_space.kind`, `.row_label` | `parking_space.space_kind` et `.row_label`, extension de l'empreinte |
| `parking_uncovered_area` | Fait `parking.undigitized_spaces`, entier, ciblant l'empreinte |
| `vehicle_gate` | Rien. Le besoin est au registre, il revient avec les accès de livraison |
| `status` et `source` de tout objet | `site_fact.status` et `site_fact.source_ref` |

Les trois manques relevés à la version 17 sont tous comblés : `free` est
devenu un fait déclaré, `kind` et `row_label` sont ce qui reste de
`parking_space`.

**La géométrie d'un parking n'est pas passée à une colonne.** L'arbitrage dit
« géométrie et nom passent à la zone », et A5.2 donne à `zone` un nom, une
nature et `footprint_ids`, sans géométrie — « empreintes couvertes par la zone,
appartenance déclarée et non calculée ». L'emprise d'un parking est donc celle
de ses empreintes, place par place, et le sol lui-même une empreinte de nature
`outdoor` si le plan la montre. Ajouter un polygone à `zone` aurait été un choix
de modèle qu'A5.2 ne prévoit pas, donc un arrêt A2.2. La lecture retenue ne
demande rien de neuf et se tient : elle est déclarée ici parce qu'elle est une
lecture, non une évidence.

**L'écart de capacité est devenu quantitatif.** S-37 admet l'écart « à
concurrence des places déclarées ». Une empreinte marquée ne vaut donc pas une
place mais le nombre que son fait déclare, et `PARK.CAPACITY_UNEXPLAINED` porte
ce qui manque encore. L'ancienne zone non couverte excusait l'écart entier, quel
qu'il fût.

**Le statut d'objet a disparu avec les tables.** `parking` et l'ancienne
`parking_space` portaient chacune un statut parmi quatre et une source. Ni
`zone` ni `footprint` d'A5.2 n'en portent, et A5.11 pose le statut d'un objet
« là où le modèle le déclare ». Les quatre codes du domaine `PARK` survivent :
`CAPACITY_EXCEEDED` et `CAPACITY_UNEXPLAINED` comparent le compte au fait,
`SOURCE_MISSING` était déjà passé au fait à la version 16, et
`PROPOSAL_AS_EXISTING` se lève désormais sur un fait de statut non publiable,
en désignant l'objet que le livrable montre.

**Décision assumée, à confirmer : `parking_uncovered_area`.** Elle n'est pas
l'une des trois tables tranchées. Son retrait est entraîné — elle pend à
`parking` par une clé étrangère — et S-37 lui donne un remplaçant complet, sauf
`reason`, le motif textuel, que la règle ne nomme pas : elle nomme « le nombre
de places qu'elle est censée porter et sa source ». La source d'un fait porte
la seconde ; le motif libre n'a pas de place déclarée, et n'en a pas été créé.

**Constaté à la version 18, tranché à la version 19.** Les rendus
d'évacuation, de plan orienté et isométrique dessinaient les empreintes de
nature `parking_space` comme des empreintes de bâti, faute de distinguer les
natures, et aucune section ne disait ce qu'ils auraient dû en faire. S-39 le
dit désormais, et les quatre vues s'y conforment : voir « Le stationnement, ce
que la version 19 ferme » plus bas.

**Q2 gagne un propriétaire.** `parking_space` quitte les tables sans
propriétaire déclaré pour le module 01, comme la version 18 l'y range. Elle y
entre parce qu'elle a changé de nature : extension d'une empreinte, elle suit
l'empreinte.

### La convention de clé des faits — A5.11, version 18

Trois clés déclarées, chacune avec son type attendu et sa cible :
`parking.capacity` (entier, zone de nature `parking`), `parking.free` (booléen,
même cible), `parking.undigitized_spaces` (entier, empreinte de nature
`parking_space`).

Le refus — « une valeur qui ne correspond pas au type déclaré est refusée » —
s'applique à `buildCommand`, par `EDIT.COMMAND_SHAPE_INVALID` : une écriture de
fait mal typée est une commande mal formée, et le catalogue de D2.2 est clos.

**L'ensemble des clés n'est pas fermé, et c'est une lecture.** A5.11 refuse une
valeur mal typée, en toutes lettres ; elle ne refuse pas une clé inconnue. La
fermer bannirait `parking_gratuit`, `niveaux_parking` et les autres faits
déclarés avant que la convention existe, que le document n'a pas retirés. La
discipline d'inscription — « une clé nouvelle s'ajoute à cette table dans le
même commit que son premier usage » — porte sur l'auteur du commit, non sur
l'exécution.

Deux types déclarés, `integer` et `boolean`, parce que la table en déclare
deux. Un troisième s'ajoutera avec la première clé qui le demande.

### Le garde de câblage prend un ré-export pour un appelant

Mesuré, et porté ici à la demande de l'éditeur. `tests/check-wiring.test.ts`
tient qu'un contrôle est branché dès qu'un autre fichier le nomme. Un
`index.ts` de baril le nomme, donc tout contrôle ré-exporté passe.

Sur 86 contrôles exportés, le garde voyait 9 orphelins. Si le baril ne comptait
pas, et en comptant un appel fait dans le fichier déclarant, il en aurait vu
**31**. Les 22 de l'écart, vérifiés un par un — aucun n'était appelé dans son
propre fichier non plus :

| Contrôle | Fichier |
| --- | --- |
| `auditBoundText` | packages/engine-graph/src/audit-bound-text.ts |
| `auditColorReferences` | packages/core-model/src/color-chain.ts |
| `auditFontLicences` | packages/core-model/src/font-registry.ts |
| `auditPictogramComprehension` | packages/engine-graph/src/audit-pictograms.ts |
| `auditViewLayers` | packages/core-model/src/view-layers.ts |
| `checkMountingHeight` | packages/rules/src/rule-checks.ts |
| `checkStrokeToHeight` | packages/rules/src/rule-checks.ts |
| `guardExportExcludesSketch` | packages/core-model/src/sketch-export.ts |
| `guardFamilyConsistency` | packages/engine-graph/src/guard-family-consistency.ts |
| `guardFontEmbedding` | packages/core-model/src/font-embedding.ts |
| `guardFontGlyphCoverage` | packages/core-model/src/font-glyphs.ts |
| `guardFontMetrics` | packages/core-model/src/font-registry.ts |
| `guardLibraryImport` | packages/engine-graph/src/guard-library-import.ts |
| `guardPictogramsVector` | packages/engine-graph/src/detect-raster.ts |
| `guardReviewClosure` | packages/engine-graph/src/guard-review-closure.ts |
| `guardTextFit` | packages/core-model/src/typography-fit.ts |
| `textExpansionFindings` | packages/core-model/src/text-expansion.ts |
| `validateLibrary` | packages/engine-graph/src/validate-library.ts |
| `validateProofs` | packages/engine-graph/src/validate-proofs.ts |

Trois de cette liste en sont sortis à la version 18. `guardSafetyRegistry`,
`guardSafetyCreation` et `guardSafetyDeletion` gardent l'invariant 3 et rien ne
les appelait : l'invariant tenait sur le chemin de la charte, par
`guardCharterOnSafety`, et pas du tout sur celui de la bibliothèque. C'était le
défaut le plus coûteux de la liste, et celui qu'un baril comptant pour appelant
cachait. Ils sont désormais branchés à `buildCommand`, et la liste ci-dessus en
compte donc dix-neuf, non vingt-deux. Voir « L'invariant 3, à moitié appliqué »
plus bas.

`auditViewLayers` est de la même famille, et il vient d'être écrit : aucun écran
de calques ne le consomme encore. Il n'a pas pu être inscrit à
`DECLARED_NOT_WIRED`, parce que le garde ne le voit pas orphelin et refuse une
inscription qu'il croit périmée.

Non corrigé ici, à la demande de l'éditeur : le garde sera traité par une tâche
qui possède ce code.

### L'invariant 3, à moitié appliqué — corrigé à la version 18

**Ce qui manquait.** INV-3 cloisonne le registre de sécurité. Deux chemins y
mènent : celui de la charte, où une application de charte prétend modifier un
objet normalisé, et celui de la bibliothèque, où une écriture ordinaire crée,
modifie ou supprime un pictogramme. Le premier était gardé par
`guardCharterOnSafety`, appelé et éprouvé. Le second avait ses trois gardes,
écrits et éprouvés un par un, et **aucun appelant**. Le registre était donc
ouvert à toute écriture passant par la voie normale — la voie que l'atelier
emprunte.

**Où le brancher.** M12.A2 : « L'atelier n'écrit jamais directement en base. Il
appelle les commandes du module propriétaire. » Toute écriture passe donc par
`buildCommand`, en `packages/core-model/src/site-commands.ts`. C'est le seul
point où un garde ferme la voie une fois pour toutes, au lieu de la fermer
écran par écran.

**Pourquoi les gardes ont changé de paquet.** Ils vivaient dans
`engine-graph/src/validate-library.ts`, et A4.1 interdit à `core-model` de lire
un moteur. Un garde appelé depuis `buildCommand` doit donc vivre dans
`core-model`. Ils sont descendus dans `packages/core-model/src/safety-registry.ts`
et `validate-library.ts` les réexporte : aucun appelant existant ne change.

**Ce que la descente a resserré.** Ils prenaient un `SiteData` entier pour n'y
lire qu'un registre de pictogramme. Une commande ne porte pas de site, elle
porte une ligne. Leur premier paramètre est donc devenu
`readonly PictogramRegistryEntry[]`, soit `{ id, registry }` — la seule chose
qu'ils lisaient. `SiteData.pictograms` le satisfait sans conversion, ce qui
explique que les onze appels d'essai existants n'aient eu qu'à passer
`refMinimal.pictograms` au lieu de `refMinimal`.

**La règle de décision retenue.** `safetyRegistryFaults` refuse dès que l'un des
deux états — avant ou après — déclare `safety`. Lire le seul état antérieur
laisserait entrer un pictogramme d'orientation promu au registre de sécurité ;
lire le seul état postérieur laisserait déclasser un pictogramme normalisé pour
le modifier au coup suivant. Les deux voies se ferment ensemble.

Une commande sur `pictogram` qui ne déclare pas la colonne `registry`, ou qui y
met une valeur que le modèle ne connaît pas, est refusée avec
`fault: 'registry_undeclared'`. A7 le veut ainsi : un moteur qui reçoit une
entrée qu'il ne peut pas traiter refuse. Le contraire ouvrirait la voie la plus
simple de toutes — omettre la colonne.

**Ce qui l'éprouve.** `tests/inv3-registre-securite-cloisonne.test.ts`, huit
voies de contournement et deux contre-exemples, comme N4.7 critère 3 l'exige
(« un test par voie de contournement ») :

| Voie | Ce qu'elle tente |
| --- | --- |
| 1 | Créer un pictogramme dans le registre de sécurité |
| 2 | Modifier un pictogramme qui s'y trouve |
| 3 | Y faire entrer un pictogramme d'orientation |
| 4 | L'en faire sortir pour le modifier ensuite |
| 5 | Supprimer un pictogramme qui s'y trouve |
| 6 | Ne pas déclarer le registre du tout |
| 7 | Déclarer un registre que le modèle ne connaît pas |
| 8 | Passer par une charte, sur chacune des quatre natures d'INV-3 |

Les deux contre-exemples disent ce que le garde ne doit **pas** fermer : le
registre d'orientation, que J5.1 ouvre à l'éditeur, et les tables qu'INV-3 ne
protège pas — une colonne `registry` existe aussi sur `support` et
`support_typology`, et bloquer l'implantation d'un support de sécurité
n'interdirait rien que le cahier interdise.

Hors périmètre de la tranche, et assumé comme tel à la demande de l'éditeur :
« C'est l'invariant le plus important du produit, à moitié appliqué. Corrige-le
tout de suite. »

### Tranché à la version 18

**Où se stocke la déclaration de S-37.** La question posée à la version 17 —
la règle dit qu'une empreinte de place « peut être marquée non numérisée, avec
le nombre de places qu'elle est censée porter et sa source », et ni S9 ni A5.2
ne disaient où — est tranchée : la marque est l'existence du fait
`parking.undigitized_spaces` qui cible l'empreinte. La clé manquait, la
convention d'A5.11 la donne.

### Le stationnement, ce que la version 19 ferme

**Le comptage, S-38.** Le retrait de la table des surfaces non couvertes a
révélé que S-37 était incomplète : elle disait que l'écart était admis « à
concurrence des places déclarées », sans dire ce que valait l'empreinte
porteuse. S-38 le dit — elle vaut le nombre déclaré, et jamais ce nombre plus
un.

Le calcul du dépôt était déjà juste. Ce qui ne l'était pas, c'est ce que le
contrôle en disait : `space_count` comptait les empreintes sous un nom qui se
lisait comme un nombre de places, et le paramètre `digitised` des deux
anomalies portait le total, places non dessinées comprises. Les deux comptes
sont maintenant nommés et rendus séparément, `counted_spaces` et
`digitised_count`, et les anomalies portent les deux.

**Le rendu, S-39.** La question ouverte à la version 18 — ce que les trois
autres vues font d'une place — est tranchée, et faite.

| Vue | Ce que S-39 impose | État |
| --- | --- | --- |
| Plan de niveau | Contour léger, sans libellé | Fait |
| Plan orienté | Le même traitement | Fait, il ne distinguait pas les places |
| Vue isométrique | Au sol, sans volume | Fait, un volume rattaché à une place est écarté du rendu |
| Plan d'évacuation | Absente, sauf cheminement | Fait, sept polygones au RDC de référence, trois désormais |
| Place accessible | Pictogramme normalisé, jamais un symbole maison | Câblé, voir ci-dessous |

La lecture des données est commune aux quatre vues, en
`core-model/parking-view.ts`. C'est la cohérence des quatre qui fait la règle :
trois vues conformes et une quatrième qui dresse un parking en relief la
laisseraient violée sans qu'aucun essai de moteur ne le voie. L'essai est donc
au niveau du dépôt, `tests/s39-rendu-d-une-place.test.ts`.

**Le pictogramme d'une place accessible : câblé, non résolu.** Le moteur ne
choisit pas le pictogramme, et ne peut pas le choisir : désigner lequel du
registre de sécurité est celui de la place accessible est une valeur d'origine
normative, qu'INV-5 interdit d'écrire dans le code et qui doit venir d'un
paquet de règles. Il est passé en donnée, par `PlanContext`, le moteur le
dessine, et l'appelant répond de sa provenance.

Sans pictogramme, rien n'est dessiné. C'est le seul repli que S-39 laisse :
« jamais un symbole maison » interdit d'en inventer un, et un symbole
approchant serait une violation au même titre. Un pictogramme d'un autre
registre est refusé, INV-3.

Reste donc à dire **comment un paquet de règles désigne ce pictogramme**. Rien
dans le modèle ne relie un pictogramme à un usage : `pictogram` porte une
catégorie et une référence normative, pas une fonction. La question est posée
ci-dessous.

### Reste ouvert après la version 19

**Comment un paquet de règles désigne le pictogramme d'un usage.** S-39 exige
« le pictogramme normalisé du registre de sécurité » pour une place accessible.
Aucune table ne dit lequel : ni `pictogram`, qui porte une catégorie et une
référence normative, ni `rules_pack_rule`, dont la portée ne nomme pas
d'usage. Le câblage attend cette réponse, et ne dessine rien d'ici là, ce qui
est le comportement correct. A2.2, point 2.

**Le motif d'une surface non numérisée.** `parking_uncovered_area.reason`
disait pourquoi le plan s'arrête : bord de page, calque absent, zone illisible.
S-37 nomme le compte et la source, pas le motif. Rien ne le porte plus, et rien
ne dit qu'il doive l'être.

**La grille de construction d'un pictogramme.** Les tracés du dépôt sont écrits
dans un carré de trente unités, et `render-face.ts` comme le marquage des
places les mettent à l'échelle sur cette base. A5.4 et J5.4 posent pourtant la
vraie grille sur la famille de pictogrammes, que le modèle ne porte pas. La
constante est nommée une fois en `core-model` ; `render-face.ts` garde son
littéral, hors périmètre.

**Une seconde implantation de `pointInPolygon`.** `engine-graph` en porte une
copie privée, dans `validate-geometry.ts`, écrite avant que `core-model` n'en
expose une. Les deux donnent le même résultat ; les réunir est hors périmètre.

## La désignation de fonction, ce que la version 20 ferme

La question posée à la fin de la version 19 — **comment un paquet de règles
désigne le pictogramme d'un usage** — est tranchée par A5.4 : le pictogramme
porte une désignation de fonction, `function_key`. À quoi il sert, et non d'où
il vient.

C'était le bon manque. Le moteur ne pouvait pas nommer le pictogramme d'une
place accessible sans écrire une valeur d'origine normative, qu'INV-5 lui
interdit. Il le recevait donc de son appelant, sans pouvoir répondre de sa
provenance. La désignation déplace la question : le moteur demande
`access.accessible`, qui n'est la valeur d'aucune norme, et la donnée dit quel
pictogramme y répond.

| Ce qu'A5.4 pose | Où | État |
| --- | --- | --- |
| `pictogram.function_key`, facultative | Migration `0062`, `Pictogram`, schéma Drizzle, type de ligne | Fait |
| Forme espace de noms + point + nom | Contrainte de base et `isFunctionKeyShape` | Fait |
| Une fonction au plus une fois par registre et par site | Index unique partiel, et `PICTO.FUNCTION_AMBIGUOUS` au rendu | Fait |
| Vocabulaire enrichi au commit de son premier usage | `core-model/pictogram-functions.ts`, une seule fonction déclarée | Fait |
| Sécurité : la désignation vient du paquet de règles, jamais saisie | Refusée par INV-3 au passage obligé de l'écriture, essai dédié | Fait |
| Orientation : désignation libre | Aucun garde, l'ensemble des fonctions n'est pas fermé | Fait |
| `PICTO.FUNCTION_NOT_DESIGNATED`, `PICTO.FUNCTION_AMBIGUOUS` | Catalogue, libellés français et anglais | Fait |
| S-39 : marque omise et signalée, jamais de remplacement | Les deux moteurs de plan | Fait |

**L'unicité « par site » s'écrit « par organisation ».** La table `pictogram`
est portée par l'organisation et ne porte pas de site. Un site voit exactement
les pictogrammes de son organisation, tous et rien d'autre : sur ce modèle les
deux formulations désignent le même ensemble de cas, et c'est celle qui a une
colonne où s'accrocher qui est écrite.

**La fonction n'est demandée que s'il y a une place à marquer.** Un niveau sans
place accessible ne réclame rien et ne signale rien. La fonction n'y manque
pas : personne ne l'a demandée. Signaler partout ferait du code un bruit de
fond, et un code qu'on apprend à ignorer ne signale plus rien.

**Ce que le rendu fait des deux cas.** Non désignée, la marque est omise et
l'avertissement porté au rendu — omettre en silence ferait d'un plan incomplet
un plan d'apparence complète. Ambiguë, le plan refuse : départager deux
désignations serait décider à la place de celui qui a désigné, et A7 fait
refuser une entrée qu'un moteur ne peut pas traiter.

### Reste ouvert après la version 20

**Le motif d'une surface non numérisée.** Inchangé depuis la version 19.
`parking_uncovered_area.reason` disait pourquoi le plan s'arrête : bord de
page, calque absent, zone illisible. S-37 nomme le compte et la source, pas le
motif. Rien ne le porte plus, et rien ne dit qu'il doive l'être.

**Deux constats passés au registre du cahier des charges, K3.8.** La grille de
construction des pictogrammes présente à deux endroits, et le poids du paquet
du studio. Ils ne sont plus à traiter ici : la version 20 les inscrit, avec
leur porteur et leur échéance.

**Une seconde implantation de `pointInPolygon`.** `engine-graph` en porte
toujours une copie privée, dans `validate-geometry.ts`. Les deux donnent le
même résultat ; les réunir reste hors périmètre.

**Les sites de référence ne désignent aucune fonction.** `refMultilevel` porte
une place accessible et aucun pictogramme désigné pour elle : tout rendu de son
rez-de-chaussée porte désormais `PICTO.FUNCTION_NOT_DESIGNATED`. C'est exact —
la donnée est incomplète et le code le dit — mais c'est un défaut de la donnée
de référence, non du moteur. Le corriger demande d'ajouter un pictogramme de
sécurité au site de référence, ce qui touche les instantanés visuels : hors du
périmètre de cette tâche.

## La portée d'une fonction, ce que la version 21 ferme

La version 20 disait « une fonction est désignée au plus une fois par
registre et par site », et je l'avais écrite « par organisation ». Les deux
étaient fausses. A5.4 pose deux portées : le paquet de règles pour le
registre de sécurité, l'organisation pour celui d'orientation. Une
organisation qui exploite deux sites rattachés à deux paquets porte
légitimement deux pictogrammes d'accessibilité, un par paquet.

| Ce qu'A5.4 pose | Où | État |
| --- | --- | --- |
| `pictogram.rules_pack_id` | Migration `0063`, `Pictogram`, schéma Drizzle, type de ligne | Fait, nullable |
| Orientation : une fonction par organisation | Index `uq_pictogram_function_wayfinding`, portée `wayfinding` | Fait |
| Sécurité : une fonction par paquet | Index `uq_pictogram_function_safety`, portée du paquet du site | Fait |
| Le cas des deux paquets, non ambigu | `tests/s39-rendu-d-une-place.test.ts`, essais du vocabulaire | Fait |

**`org_id` reste dans la clé de sécurité.** Les pictogrammes d'un paquet
sont portés par chaque organisation qui l'emploie, et un index qui
franchirait la frontière d'organisation révélerait par son message de
conflit une ligne d'une autre organisation, ce qu'A6.1 interdit.

**Un site sans paquet n'a pas de registre de sécurité.** Aucune désignation
de ce registre ne l'atteint, pas même celle d'un pictogramme qui ne déclare
pas de paquet. La marque y est omise et signalée.

**Le motif d'une surface non numérisée** a son porteur :
`parking.undigitized_reason`, texte, à côté du nombre de places. Il entre
dans la table d'A5.11 avec le type `text`, et le chemin d'écriture refuse un
motif écrit sous une autre forme.

**Le site de référence est complet.** `refMultilevel` est rattaché au paquet
d'essai du dépôt et y désigne le pictogramme de sa place accessible. Cinq
instantanés du RDC gagnent la marque, et rien d'autre. Le contre-exemple est
dérivé dans l'essai S-39.

### Reste ouvert après la version 21

**`rules_pack_id` requis pour le registre de sécurité.** A5.4 : « standard_ref
et rules_pack_id sont requis si registry = 'safety' ». La colonne est entrée
nullable, et rien ne l'exige encore. `ref-minimal`, `ref-retail` et
`ref-broken` portent chacun un pictogramme de sécurité sans paquet, sur des
sites sans paquet : sans effet sur la marque, puisqu'aucun n'a de place
accessible, mais c'est la donnée que la règle refuse.

**Un site rattaché à deux paquets.** D3.6 permet un paquet international et
un paquet pays. Le modèle n'en rattache qu'un, `Site.rules_pack_id`. Le jour
où il en portera deux, une fonction désignée dans les deux se lira comme une
ambiguïté, et le document ne dit pas lequel des deux pictogrammes prime : la
préséance du paquet pays de D3.6 porte sur la contrainte, qui n'a pas de sens
pour un pictogramme.

**Le motif n'est lu par aucun livrable.** S-37 le compte parmi ce qu'une
déclaration porte, sans dire où il s'affiche ni faire de son absence une
anomalie.

**Une seconde implantation de `pointInPolygon`.** Inchangé.

## Paquets d'un site et motif d'une surface, ce que la version 22 ferme

| Ce que la version 22 pose | Où | État |
| --- | --- | --- |
| A5.4 — paquet requis pour un pictogramme de sécurité, vide pour l'orientation | Migration `0064`, contrainte `pictogram_pack_by_registry` | Fait |
| Pictogrammes de sécurité des sites de référence rattachés | `ref-minimal`, `ref-retail` : `rp-test-0001` | Fait |
| A5.8 — `site_rules_binding.role`, socle ou surcouche, au plus un de chaque | Migration `0065`, index `uq_site_rules_binding_role`, schéma Drizzle | Fait |
| La table de rattachement fait foi : lectures migrées | `SiteData.rules_bindings`, chargeur, API REST, studio, compilateur | Fait |
| Précédence : la surcouche l'emporte, l'ambiguïté se juge dans un paquet | `packsByPrecedence`, `resolvePictogramFunction`, `resolveSiteRulesPack` | Fait |
| La colonne de paquet disparaît de la table des sites | Migration `0066`, gardée ; Drizzle et liste de dérive dans le même commit | Fait |
| `PARK.UNDIGITIZED_REASON_MISSING`, avertissement | `auditParking`, catalogue, libellés fr et en | Fait |

**Le chemin de la migration.** Elle s'est faite en quatre temps, un commit
chacun : le rôle et le report de la colonne dans la table (`0065`), puis les
lectures, puis le retrait de la colonne (`0066`). `0066` s'arrête si une
valeur de la colonne n'est pas reprise en socle. Sur la base de
développement, la colonne était vide.

**Une surcouche seule répond.** A5.8 dit « au plus un socle », non « au
moins un ». Une surcouche sans socle est donc le paquet effectif du site.

**Une ambiguïté dans la surcouche arrête la recherche.** Descendre au socle
masquerait une contradiction du paquet qui prime.

**Un paquet choisi à la création devient le socle.** Le formulaire M1
(partie M) ne propose qu'un paquet, et un paquet seul n'est la surcouche de
rien.

**Correction de la section précédente.** « Reste ouvert après la version
21 » compte `ref-broken` parmi les sites qui portent un pictogramme de
sécurité. C'est faux : il ne porte qu'un pictogramme d'orientation. Seuls
`ref-minimal` et `ref-retail` étaient concernés.

### Reste ouvert après la version 22

**Deux sites de référence ont des pictogrammes que leur site n'atteint
pas.** `ref-minimal` et `ref-retail` rattachent leurs pictogrammes de
sécurité au paquet d'essai, mais aucun des deux sites n'est rattaché à un
paquet. Sans effet aujourd'hui, puisque ni l'un ni l'autre n'a de place
accessible.

**L'empreinte d'une fusion de paquets.** `mergeCountryOverlay` garde la clé
et la version du socle, et l'empreinte de contenu ne dit donc pas qu'une
surcouche est intervenue.

**`NULLS NOT DISTINCT` dans l'index de sécurité de `0063`.** Il devient
superflu maintenant que `0064` interdit un paquet nul dans ce registre. Il
ne coûte rien, et le retirer serait une migration.

**Le motif n'est toujours lu par aucun livrable.** Son absence est
maintenant signalée ; où il s'affiche reste non dit.

## Empreinte, sites de référence et borne, ce que la version 23 ferme

| Ce que la version 23 pose | Où | État |
| --- | --- | --- |
| D7.1 et annexe T, §3.1.4 — socle et surcouche dans l'empreinte, chacun avec sa clé et sa version | `BoundRulesPacks`, `rulesPacksInRoleOrder`, `computeContentHash`, `computeFaceContentHash` | Fait |
| L'identité des paquets se lit sur les rattachements, jamais sur la fusion | `boundRulesPackIdentities` | Fait |
| `ref-minimal` et `ref-retail` rattachés au paquet d'essai | Sites de référence, essai `safety-pictograms-bound` | Fait |
| Libellés de `PARK.CAPACITY_UNEXPLAINED` alignés sur S8 | Libellés fr et en | Fait |
| A8 — la limite de 400 lignes vise les fichiers source | Sans effet sur le code | Pris en compte |

Deux constats de la section précédente sont fermés : l'empreinte d'une
fusion de paquets, et les deux sites de référence dont le site ne voyait pas
les pictogrammes.

**La borne ne résout aucune fonction.** Les plans d'un paquet de borne sont
dessinés à sa construction, sur le site entier. La marque d'une place
accessible y entre à ce moment-là, résolue sur les rattachements réels. Le
code de la borne n'emploie que `computeRoute`. Deux essais le gardent.
L'écran d'évacuation du mode urgence (P10) n'existe pas encore.

### Reste ouvert après la version 23

**La construction d'un paquet de borne perd les avertissements du rendu.**
`buildKioskMapFiles` ne lit que le succès de `renderFloorPlan`. Une marque
omise faute de désignation (`PICTO.FUNCTION_NOT_DESIGNATED`) le serait donc
en silence dans le paquet, alors que S-39 veut qu'elle soit signalée.

**Deux calculs de l'empreinte de contenu.** Ce sont `computeContentHash`
(engine-graph, D7.1, employé par `computeStaleFaces`) et
`computeFaceContentHash` (engine-layout, T-2.14a). Ils diffèrent :
- le premier accepte un site sans paquet ; le second le refuse, comme
  l'annexe T, §8, le demande ;
- le premier écrit `null` pour un champ absent là où le second l'omet ;
- le premier ne normalise pas les chaînes en NFC.

Les deux portent désormais le socle et la surcouche.

**Le dépôt PostgREST du studio** fait 515 lignes (513 avant la version 22). Son découpage est une tâche
à déclarer avant la fin de la tranche 1.

**Vocabulaire d'avant S8 resté dans le code.** Le thème du plan nomme
`uncovered_fill` et `uncovered_stroke` ce qui dessine une surface non
numérisée. Deux commentaires parlent encore de « zone non couverte »
(`build-kiosk-tree.ts`, `render-floor-plan.ts`).

**Un site de borne se lit comme un site sans paquet.** `loadKioskSite` rend
`rules_bindings: []`, ce qui ne distingue pas un site sans paquet d'un site
dont le paquet n'est pas transporté. L'essai d'exécution empêche d'en tirer
une résolution ; le modèle, lui, ne le dit pas.

**Toujours au registre.** L'index `NULLS NOT DISTINCT` de `0063` et le poids
du paquet du studio, sans correction au passage.

## Anomalies du paquet, empreinte unique et borne, ce que la version 24 ferme

| Ce que la version 24 pose | Où | État |
| --- | --- | --- |
| D10.0 — l'assemblage agrège les anomalies de chaque rendu qu'il embarque | `buildKioskMapFiles`, `buildKioskTree`, `buildKioskPackage` | Fait |
| D10.0 — une marque de sécurité omise faute de fonction désignée bloque la construction | `buildKioskMapFiles`, essai `kiosk-anomalies-d10-0` | Fait |
| D7.2 — NFC, champ absent omis, site sans paquet refusé | `computeFaceContentHash` (core-model) | Fait |
| D7.2 — une seule implantation | `computeFaceContentHash` seule ; `computeContentHash` retiré ; essai `d7-2-empreinte-unique` | Fait |
| Vocabulaire d'avant S8 retiré du thème et des commentaires | `undigitised_fill`, `undigitised_stroke` | Fait |
| A5.8 — le site de borne n'a pas de rattachement : le champ est absent | `KioskSite`, `loadKioskSite` | Fait |
| Tâche de découpage du dépôt PostgREST | Déclarée ci-dessous | Déclarée |

Les cinq premiers constats de la section précédente sont fermés : les
avertissements perdus par le paquet de borne, les deux calculs de
l'empreinte, le vocabulaire d'avant S8, le site de borne lu comme un site sans
paquet, et le dépôt PostgREST, dont la tâche est déclarée.

**Les anomalies du paquet.** Chaque plan de niveau est rendu dans l'ordre des
ordinaux, et chaque anomalie reçoit l'identifiant du niveau qui l'a produite
(`level_id`). Un rendu refusé refuse le paquet. Une marque de sécurité omise
(`PICTO.FUNCTION_NOT_DESIGNATED` sur le registre de sécurité) le refuse
aussi. Les autres avertissements traversent l'assemblage et figurent au
résultat du travail (`findings`). L'anomalie de la marque omise garde la
gravité du catalogue, avertissement. C'est le paquet qui la rend bloquante.

**L'empreinte unique.** La fonction est passée du moteur de mise en page à
core-model, pour deux raisons. A4.1 interdit au moteur de graphe d'importer un
autre moteur. L'annexe T, §2, place la fonction d'empreinte dans core-model.
`computeStaleFaces` rend désormais un `Outcome`. Une face dont l'empreinte ne
peut être calculée est refusée et nommée, et non plus comparée sur une
empreinte d'une autre forme. La version du gabarit est fournie par
l'appelant, car `FaceTemplate` n'en porte pas. Aucun code de production
n'appelle encore `computeStaleFaces` ni `computeFaceContentHash`. La fusion ne
change donc aucune empreinte que le code enregistre.

**La borne.** `computeRoute` ne lit que le graphe, comme A7.1 le décrit. Il
prend désormais `Pick<SiteData, 'graph'>`, ce qui ne change aucun appelant.
Un essai refuse toute mention de `rules_bindings` dans le code d'exécution,
hors du chargeur.

### Tâche déclarée : découpage du dépôt PostgREST

**Objet.** `apps/studio/src/data/postgrest-repository.ts` fait 515 lignes. A8
limite un fichier source à 400.

**Portée.** Le fichier est découpé en modules par famille de collections,
sans changer le comportement. L'interface exposée au studio reste la même.

**Échéance.** Avant la fin de la tranche 1. La tâche se fait comme une
tâche, pas au passage d'une autre.

**Vérification.** Chaîne A13.2 complète, `test:rls` compris, puisque le
dépôt est le chemin des lectures sous cloisonnement.

**État.** Non commencée.

### Consigné : un commit qui porte un fichier de trop

Le commit `06d777b` (« docs(matrice): nombre de lignes du dépôt PostgREST
corrigé ») porte deux fichiers : la matrice et `docs/releve-m8-parcours.json`.
Son message ne mentionne que la matrice.

Le relevé qu'il porte date de `2026-09-25T18:48:37.417Z`. Il a été écrit par
une exécution des essais de bout en bout antérieure à la chaîne A13.2
retenue pour la version 23. Le relevé qui fait foi pour cette version est
celui de `5d4fda8`, daté de `2026-09-25T18:58:08.119Z`.

Le commit a été fait avec `git commit -a`, qui a pris un fichier modifié hors
de la tâche. L'historique n'est pas réécrit. Depuis, chaque commit nomme ses
fichiers.

### Reste ouvert après la version 24

**Les empreintes d'entrée et de graphe ne suivent pas D7.2.** `inputs_hash` et
`graph_hash` sont calculées par `contentHash` (`hash.ts`) :
- le calcul écrit `null` pour un champ absent ;
- il ne normalise pas les chaînes en NFC.

`graph_hash` est enregistrée avec la validation du graphe (`graph_validation`).
Aligner le calcul changerait les empreintes déjà enregistrées. D7.2 parle de
l'empreinte de contenu, et ne dit pas si ces deux empreintes en relèvent. La
question est posée.

**L'écran d'évacuation (P10)** n'existe toujours pas. `renderEvacuationPlan`
ne dessine aucun pictogramme de sécurité. La marque figée à la construction
ne vaut donc, aujourd'hui, que pour les plans de niveau.

**Toujours au registre.** L'index `NULLS NOT DISTINCT` de `0063` et le poids
du paquet du studio, sans correction au passage.

## Forme canonique pour toutes les empreintes, ce que la version 25 ferme

| Ce que la version 25 pose | Où | État |
| --- | --- | --- |
| D7.2 — la forme canonique vaut pour toutes les empreintes | `inputs_hash`, `graph_hash` : `computeInputsHash`, `computeGraphHash` passent par `empreinte` | Fait pour les deux empreintes signalées |
| D7.2 — une empreinte déjà enregistrée ne se convertit pas | Aucune migration ; essai du studio : un passage de validation sous l'ancienne forme ne vaut plus (M02.W11) | Fait |
| Graphie de la surface non numérisée alignée sur les clés de faits | `undigitized_fill`, `undigitized_stroke`, `parkingSpacesOfLevel().undigitized`, libellés anglais | Fait |

Le premier constat de la section précédente est fermé pour les deux
empreintes signalées : `inputs_hash` et `graph_hash` sont écrits en NFC,
sans champ nul, préfixés `sha256:`. L'essai de garde vérifie désormais que la
forme canonique n'est définie qu'une fois, et que les empreintes alignées
n'emploient plus `contentHash`.

### Reste ouvert après la version 25

**Les autres empreintes que D7.2 nomme ne suivent pas encore la forme
canonique.** Elles passent toujours par `contentHash`, ou par un condensé
d'octets :

| Empreinte | Où | Ce qu'un alignement entraîne |
| --- | --- | --- |
| Entrées d'un tableau des messages | `computeScheduleInputsHash` | Tout tableau enregistré, approuvé compris, se lit périmé et doit être régénéré |
| Manifeste d'un paquet de borne | `assembleKioskPackage`, et `recomputeContentHash` du protocole de mise à jour | Une borne mise à jour refuserait un paquet construit sous l'ancienne forme : compatibilité des paquets déployés (O14) |
| Dossier de livraison | `build-delivery-archive.ts` | Le `checksum` enregistré ne se retrouve plus |
| Paquet de règles | `pack-directory.ts` : condensé des fichiers concaténés, comparé au `checksum` du manifeste | Ce condensé porte sur des octets, pas sur une valeur sérialisée. L'aligner réécrit le `checksum` porté par chaque manifeste de paquet |

Deux comparaisons emploient aussi `contentHash` sans rien enregistrer : la
grille d'une famille de pictogrammes et la détection de doublons à
l'import d'une bibliothèque. La question est posée au rapport.

**La graphie de la place numérisée reste en -is-** : clé de liaison
documentaire `parking.digitised_spaces`, paramètres d'anomalie `digitised`,
champ `digitised_count`. La clé de liaison peut figurer dans des textes de
livrable déjà saisis : la renommer les casserait. La question est posée au
rapport.

**Le journal d'audit n'est pas en insertion seule en base.** Relevé à la
relecture des lignes partielles de la matrice de l'atelier :
- le rôle `authenticated` détient `UPDATE` et `DELETE` sur `audit_log` ;
- la table ne porte aucun déclencheur ;
- sa politique est `FOR ALL`.

A12.3 l'exige. La correction est une migration, et elle n'est pas demandée.

**Tri des identifiants par `localeCompare`** dans les empreintes du graphe
et du tableau des messages. A9 interdit une comparaison dépendante de la
locale. Relevé, non corrigé.

**Toujours au registre.**
- Les empreintes non alignées, ci-dessus.
- L'index `NULLS NOT DISTINCT` de `0063`.
- Le poids du paquet du studio.
- La tâche de découpage du dépôt PostgREST, déclarée à la version 24 et non
  commencée.
- L'écran d'évacuation (P10).

## Journal d'audit, empreintes et fond de plan, ce que la version 26 ferme

| Ce que la version 26 pose | Où | État |
| --- | --- | --- |
| A12.3 — le journal d'audit en insertion seule, en priorité | Migration `0067_a12_3_audit_log_insert_only` ; essai `a12-3-insertion-seule.db` | Fait |
| D7.2 — toutes les empreintes suivent la forme canonique, en un seul lot | `empreinteOutcome` (core-model), appelée par chaque empreinte nommée ci-dessous | Fait |
| A9 — plus de `localeCompare` dans un ensemble haché | `codePointCompare` (core-model) | Fait pour les empreintes |
| Clé de liaison `parking.digitized_spaces` | `document-bindings.ts`, `audit-parking.ts` | Fait |
| D2.2 — `DATA.HASH_INPUT_INVALID`, bloquant | Catalogue, libellés, `empreinteOutcome` | Fait |
| M2 — le DWG refusé, le DXF accepté | `ACCEPTED_PLAN_FORMATS` (studio) | Fait |

Le journal d'audit, les empreintes restantes, le tri par `localeCompare`
dans les empreintes et la graphie en -is- sont fermés. Ce sont les quatre
premiers constats de la section précédente.

### Tâche déclarée : le journal d'audit en insertion seule

**Objet.** A12.3 : `audit_log`, `approval`, `message_schedule_approval` et
`graph_validation` sont en insertion seule, garanti en base. Le rôle
`authenticated` détenait `UPDATE` et `DELETE` sur `audit_log`, sous une
politique `FOR ALL`, sans déclencheur.

**Portée.** Une migration, seule dans son commit (`ce5d937`). Elle pose trois
barrières :
- des politiques de lecture et d'insertion à la place de `FOR ALL` ;
- le retrait de `UPDATE`, `DELETE` et `TRUNCATE` au rôle applicatif ;
- trois déclencheurs de refus, qui tiennent aussi contre le propriétaire.

Aucune ligne n'est touchée.

**Essai.** `packages/db/src/__tests__/a12-3-insertion-seule.db.test.ts`
(`9c1b8af`) lit la base réelle, comme les essais de cloisonnement. Il échoue
si un rôle autre que le propriétaire regagne l'un des trois droits, si une
politique autorise la modification ou la suppression, ou si un déclencheur
disparaît. Il vérifie ces trois points sur les quatre tables. Il éprouve
ensuite `audit_log` sous les deux rôles, dans une transaction annulée. Sans
la migration, cinq de ses six essais échouent.

`message_schedule_approval` n'existe pas encore, parce que la tranche 2 est
suspendue. L'essai la tient en attente nommée, et échoue le jour où elle
naît sans en sortir.

**État.** Faite, avant le reste de la version.

### Le lot des empreintes

Toutes les empreintes passent par `empreinteOutcome` : NFC, champ absent
omis, clés triées par point de code, préfixe `sha256:`. Une valeur non
hachable (nombre non fini, objet non simple) est refusée par
`DATA.HASH_INPUT_INVALID`, et le refus remonte à l'appelant au lieu d'une
empreinte nulle.

| Empreinte | Où | Ce qui change pour une valeur enregistrée |
| --- | --- | --- |
| Entrées d'un parcours, graphe validé | `computeInputsHash`, `computeGraphHash` ; le cache de parcours n'a plus de calcul propre | Forme déjà alignée en version 25 ; le tri passe au point de code, ce qui ne change l'empreinte que si deux identifiants s'ordonnent autrement |
| Entrées d'un tableau des messages | `computeScheduleInputsHash` | Un tableau enregistré, approuvé compris, se lit périmé |
| Manifeste d'un paquet de borne | `kioskManifestContentHash`, seule fonction : l'assemblage et le protocole de mise à jour l'appellent tous deux | Un paquet construit sous l'ancienne forme est refusé à la mise à jour |
| Dossier de livraison | `build-delivery-archive.ts` | Le `checksum` enregistré ne se retrouve plus |
| Paquet de règles | `pack-empreinte.ts`, seule fonction : fichiers lus comme JSON, avec leur nom, dans l'ordre du manifeste | Un manifeste qui porte l'ancien `checksum` est refusé (`RULES.PACK_CHECKSUM_MISMATCH`) ; celui de la fixture de test est réécrit |
| Grille de famille, doublons de bibliothèque | `guard-family-consistency.ts`, `guard-library-import.ts` | Rien n'est enregistré |
| Sommes du testkit | `stableChecksum`, `siteChecksum` | `siteChecksum` ne dépend plus de l'ordre des clés |

`contentHash` est retiré de core-model : il n'avait plus d'appelant. L'essai
`d7-2-empreinte-unique` vérifie quatre points :
- aucune empreinte n'est définie hors d'`empreinte.ts` ;
- `createHash` n'apparaît nulle part ;
- aucun fichier ne combine `canonicalSerialize` et un condensé ;
- `contentHash(` n'est plus appelé.

Les condensés d'octets qui restent sont des sommes de fichiers, pas des
empreintes de valeur :
- entrées de fichier du paquet de borne ;
- `checksum` du paquet persisté ;
- artefacts assemblés.

**Aucune valeur enregistrée n'est convertie.** Il n'y a ni migration ni
réécriture. Ce que l'ancienne forme a produit se lit périmé, ou est refusé.

**La clé renommée.** La version 25 relevait qu'un texte de livrable déjà
saisi peut citer `parking.digitised_spaces`. Un tel texte n'est pas
converti : l'ancienne clé ne se résout plus.

### Le fond de plan

Un `.dwg` est refusé par `IMPORT.FORMAT_UNSUPPORTED`, par son extension comme
par ses types de média. Un `.dxf` est accepté, y compris quand le navigateur
ne donne pas de type. L'écran d'étalonnage lit la liste depuis la même
constante. C'est le septième conflit de la matrice de l'atelier, tranché dans
le sens du complément.

### Reste ouvert après la version 26

**`localeCompare` hors des empreintes.** A9 interdit, dans un moteur, une
comparaison de chaînes dépendante de la locale. Aucun appel ne passe de
locale. On en compte, hors essais :
- 147 dans `engine-*`, core-model, le compilateur, `engine-package` et
  l'exécution de borne ;
- 53 dans le studio.

La plupart trient des identifiants pour fixer un ordre de rendu. Les
remplacer peut changer l'ordre de sorties déjà produites pour un identifiant
non ASCII. Relevé, non corrigé : le lot ne portait que les ensembles hachés.

**`lineFingerprint`** (tableau des messages) sérialise par
`canonicalSerialize` sans condensé. Il n'est ni haché ni enregistré. Il
reste hors du lot.

**M2 : l'avertissement de précision limitée** d'une image en mode point n'a
pas de code au catalogue. Il n'est pas émis. Qu'un PDF soit vectoriel n'est
pas vérifié à l'import.

**Défaut du document, M2 étape 1.** Le paragraphe « Le DWG n'est pas
accepté » est inséré dans le tableau. La ligne « Page » (`IMPORT.PAGE_REQUIRED`)
se trouve ainsi détachée du tableau. Son contenu reste appliqué tel qu'il
était.

**Les essais du dossier `tests/` ne sont pas vérifiés par `pnpm typecheck`.**
La commande ne parcourt que les paquets. Un essai de déterminisme comparait
des `Outcome` par identité après le changement de signature, et seul
`pnpm test` l'a vu.

**Toujours au registre.**
- L'index `NULLS NOT DISTINCT` de `0063`.
- Le poids du paquet du studio.
- La tâche de découpage du dépôt PostgREST, déclarée à la version 24 et non
  commencée.
- L'écran d'évacuation (P10).

## Précision du fond, comparaisons localisées et contrôle de types, ce que la version 27 ferme

| Ce que la version 27 pose | Où | État |
| --- | --- | --- |
| D2.2 — `IMPORT.RASTER_PRECISION_LIMITED`, avertissement | Catalogue et libellés (core-model) | Fait |
| M2 — la précision du fond se juge sur le contenu, jamais sur l'extension | `plan-content.ts`, `pdf-painted-paths.ts`, `dxf-geometry.ts` (studio) ; écran M2 | Fait |
| M2 — tableau des champs rétabli | Document | Rien à faire dans le code |
| A9 — contrôle automatique des comparaisons localisées dans `engine-*` | Essai `a9-comparaison-localisee`, relevé `a9-releve-comparaisons-localisees.json` | Fait |
| A9 — remplacement des comparaisons localisées existantes | Déclaré ci-dessous | Déclarée |
| Le dossier `tests/` vérifié par le contrôle de types | `tests/tsconfig.json` ; essai `typecheck-couverture` | Fait |

**La précision du fond.** La nature du fichier se lit dans ses premiers
octets : PDF, PNG, JPEG, DXF texte ou binaire. Le nom du fichier et le type
annoncé par le navigateur n'y entrent pas.

- Une image PNG ou JPEG lève l'avertissement.
- Un PDF est vectoriel s'il porte au moins un chemin peint dans un flux de
  contenu. Les flux d'image, de police, d'index et de métadonnées ne sont
  pas lus. La découpe fermée par `n`, qui entoure l'image d'un plan
  numérisé, ne compte pas.
- Un DXF texte est vectoriel s'il porte une entité géométrique, ou insère un
  bloc qui en porte.
- Ce qui ne se lit pas lève l'avertissement avec le motif `undetermined` :
  filtre de flux autre que `FlateDecode`, DXF binaire, fichier illisible,
  nature inconnue. Rien n'est présumé vectoriel.

L'avertissement paraît dans le bandeau de l'écran M2. Il n'empêche pas le
calage. La lecture se fait sans bibliothèque : `DecompressionStream`, que le
navigateur fournit.

**Correction d'un constat de la version 26.** Le rapport de
la version 26 disait que `pnpm typecheck` ne vérifiait pas le dossier
`tests/`. C'était faux pour les essais `*.test.ts`, vérifiés depuis le
début. L'essai de déterminisme qui avait échoué comparait des `Outcome` par
identité, ce qui n'est pas une erreur de types. Le trou réel était ailleurs :
les quinze essais de bout en bout de `tests/e2e/`, que le motif `*.test.ts`
excluait. Ils sont inclus et passent sans erreur. L'essai
`typecheck-couverture` compare la liste que `tsc` vérifie aux fichiers du
dossier ; sans la correction, il relève les quinze.

### Tâche déclarée : remplacement des comparaisons localisées

**Objet.** A9 : « Comparer deux chaînes dans un moteur se fait par leurs
points de code, jamais par une comparaison sensible à la langue. » Aucun
appel relevé ne passe de langue : tous dépendent de la locale de la machine.

**Portée.** Les 124 occurrences des moteurs, dans 49 fichiers, relevées dans
`tests/a9-releve-comparaisons-localisees.json` (121 dans le code, 3 dans les
essais). Chacune passe à `codePointCompare` (core-model).

Hors des moteurs, on compte aussi, hors essais :
- 20 appels dans core-model ;
- 5 dans le compilateur ;
- 2 dans l'exécution de borne ;
- 59 dans le studio.

A9 ne classe ni core-model, ni le compilateur, ni l'exécution de borne. Le
studio relève de la règle de l'interface : un tri selon la langue y est
légitime si la langue est déclarée explicitement. Aucun des 59 appels ne la
déclare. La portée hors moteurs reste à arrêter avant de commencer.

**Échéance.** Avant le premier livrable réel.

**Vérification.** Le relevé des moteurs tombe à zéro et disparaît. Chaîne
A13.2 complète : `test:visual` et `test:determinism` diront si l'ordre d'une
sortie a changé, ce qui arrive pour des identifiants dont la casse ou les
accents diffèrent.

**État.** Non commencée. Le contrôle automatique empêche le relevé de
croître entre-temps.

### Reste ouvert après la version 27

**Le format accepté se juge encore sur l'extension et le type annoncé.**
`acceptPlanFile` accepte un fichier nommé `.pdf` qui contient une image, et
refuse un plan valide mal nommé. La précision, elle, est jugée sur le
contenu. Faut-il aussi juger le format sur le contenu ? Relevé, non
tranché.

**Le nombre de pages d'un PDF n'est pas lu.** L'écran transmet toujours
`pageCount: null`, si bien qu'`IMPORT.PAGE_REQUIRED` n'est jamais levé.
Relevé, non corrigé.

**Fichiers de configuration hors du contrôle de types.** Cinq fichiers
TypeScript ne relèvent d'aucun `tsconfig` :
- `playwright.config.ts` ;
- `vitest.config.ts` ;
- `vitest.db.config.ts` ;
- `apps/studio/vite.config.ts` ;
- `packages/db/drizzle.config.ts`.

**Défaut de mise en page du document, A9.** Le paragraphe « Comparer deux
chaînes » s'insère dans la liste des sources d'indéterminisme : le dernier
point, sur les flottants, s'en trouve détaché. Son contenu reste appliqué.

**Toujours au registre.**
- L'index `NULLS NOT DISTINCT` de `0063`.
- Le poids du paquet du studio.
- La tâche de découpage du dépôt PostgREST, déclarée à la version 24 et non
  commencée.
- L'écran d'évacuation (P10).
- `lineFingerprint`, hors des empreintes.

## Portée du déterminisme, fond de plan jugé sur son contenu, configurations, ce que la version 28 ferme

| Ce que la version 28 pose | Où | État |
| --- | --- | --- |
| A9 — portée : tout code qui produit une sortie ou une empreinte | Essai `a9-comparaison-localisee`, relevé étendu | Contrôle étendu ; tâche redéclarée ci-dessous |
| M2 — le format se juge sur le contenu ; un contenu hors des formats acceptés est refusé | `acceptPlanFile`, `inspectPlanContent` (studio) | Fait |
| M2 — le nombre de pages d'un PDF se lit, `IMPORT.PAGE_REQUIRED` se lève | `pdf-pages.ts` ; champ « Page » de l'écran M2 | Fait |
| A5.2 — `plan_source.content_kind` | Migration `0068_a5_2_plan_source_content_kind` ; écriture à l'import | Fait |
| Cinq fichiers de configuration sous contrôle de types | `tsconfig.config.json` (racine, studio, db) ; essai `typecheck-couverture` | Fait |
| A9 — liste des sources d'indéterminisme rétablie | Document | Rien à faire dans le code |

Les quatre premiers points ouverts après la version 27 sont fermés : le format
jugé sur l'extension, le nombre de pages jamais lu, les fichiers de
configuration hors contrôle, le défaut de mise en page d'A9.

**Le fond de plan.** Le format se lit dans les premiers octets : PDF, PNG,
JPEG, DXF texte ou binaire. Le nom et le type annoncé n'entrent plus nulle
part, et le type de média enregistré est celui du format reconnu. Un contenu
qui n'est aucun de ces formats est refusé par `IMPORT.FORMAT_UNSUPPORTED`,
un DWG compris, quel que soit son nom. Un fichier qui ne se lit pas du tout
n'est reconnu comme aucun format : il est refusé de même.

Un format reconnu sans tracés reste accepté, avec
`IMPORT.RASTER_PRECISION_LIMITED`. Le cas indéterminé aussi : un flux PDF
que le produit ne sait pas décoder, ou un DXF binaire.

**La nature du contenu.** `plan_source.content_kind` reçoit l'une de trois
valeurs :

| Ce que le contenu montre | `content_kind` |
| --- | --- |
| Au moins un tracé lu | `vector` |
| Aucun tracé lu : image, PDF numérisé, DXF sans entité géométrique | `raster` |
| Un flux qui ne se décode pas, sans tracé lu ailleurs | `undetermined` |

La migration 0068 porte la colonne, obligatoire, avec sa contrainte et sans
valeur par défaut. Une ligne antérieure reçoit `undetermined` ; la base de
développement n'en comptait aucune. Une valeur inconnue relue est
`undetermined`, jamais présumée vectorielle.

**Le nombre de pages.** Il se lit dans l'arbre des pages : le catalogue que
désigne le dernier `/Root`, son nœud `/Pages`, et le `/Count` de ce nœud.
Les objets se lisent en clair ou dans les flux d'objets, la dernière
révision l'emportant. À défaut d'arbre lisible, le compte retombe sur les
objets `/Page`. Si rien ne se lit, le nombre de pages est inconnu : le
document est traité comme d'une seule page. Un PDF de plusieurs pages lève
`IMPORT.PAGE_REQUIRED` jusqu'au choix de sa page, dans le champ « Page » que
l'écran affiche alors.

**Les fichiers de configuration.** Trois projets de configuration, chacun
ajouté au script `typecheck` de son paquet. Le contrôle a relevé tout de
suite un défaut réel, corrigé dans un commit séparé : dans
`playwright.config.ts`, la fenêtre de 1366 × 768 était écrasée par celle du
poste type. Toute la suite de bout en bout tournait donc en 1280 × 720, sous
la largeur minimale de F12. Elle passe à 1366 × 768 (133 essais).

`packages/db` déclare `@types/node`, déjà déclaré par trois paquets dans la
même version : aucun paquet nouveau n'entre au verrou.

### Tâche déclarée : remplacement des comparaisons localisées, version 28

Elle remplace la déclaration de la version 27.

**Objet.** A9 : « Comparer deux chaînes [...] se fait par leurs points de
code, jamais par une comparaison sensible à la langue », là où la section
s'applique : « tout code qui produit une sortie ou une empreinte ».

**Portée.** Les 155 occurrences relevées dans
`tests/a9-releve-comparaisons-localisees.json`, dans 66 fichiers :

| Où | Occurrences |
| --- | --- |
| `engine-graph` | 100 |
| `engine-layout` | 16 |
| `engine-package` | 5 |
| `engine-iso` | 3 |
| `core-model` | 21, dont une mention en commentaire |
| Compilateur | 7, dont 2 dans ses essais |
| Exécution de borne | 2 |
| Studio, code qui alimente une empreinte | 1 (`schedule-model.ts`) |

Chacune passe à `codePointCompare`. Le périmètre contrôlé couvre aussi les
paquets qui n'en portent aucune (règles, trousse d'essai, base, jetons), pour
qu'ils n'en gagnent pas. Dans le studio, un fichier alimente une empreinte
s'il en importe un point d'entrée ; chacun de ces points ordonne lui-même ses
ensembles par points de code.

**Échéance.** Avant le premier livrable réel.

**Vérification.** Le relevé tombe à zéro et disparaît. Chaîne A13.2
complète : `test:visual` et `test:determinism` diront si l'ordre d'une sortie
a changé.

**État.** Non commencée. Le contrôle automatique empêche le relevé de
croître.

### Reste ouvert après la version 28

**Tris d'affichage du studio sans langue déclarée.** Hors du code qui
alimente une empreinte, le studio porte 58 appels à `localeCompare`. Aucun
ne déclare la langue : tous la déduisent de la machine. A9 admet le tri par
langue dans l'interface « à condition que la langue soit déclarée
explicitement ». Ils sont hors du périmètre de la tâche ; relevé, non
tranché.

**Précision d'un PDF de plusieurs pages.** Elle se juge sur le fichier
entier, et non sur la page retenue. Un PDF dont une page est vectorielle et
une autre numérisée passe pour vectoriel, quelle que soit la page choisie.

**Toujours au registre.**
- L'index `NULLS NOT DISTINCT` de `0063`.
- Le poids du paquet du studio.
- La tâche de découpage du dépôt PostgREST, déclarée à la version 24 et non
  commencée.
- L'écran d'évacuation (P10).
- `lineFingerprint`, hors des empreintes.

## Nature jugée sur la page retenue, tris d'affichage du studio, fenêtre des relevés, ce que la version 29 ferme

| Ce que la version 29 pose | Où | État |
| --- | --- | --- |
| M2 — la nature d'un document de plusieurs pages se juge sur la page retenue, indéterminée quand le suivi ne conclut pas | `pdf-page-nature.ts`, `pdf-objects.ts`, `pdf-syntax.ts` (studio) ; `precisionOfPage` | Fait |
| A9 — les tris d'affichage du studio entrent dans la tâche, par la langue active déclarée | Tâche redéclarée ci-dessous | Déclarée |
| D13 — taille de fenêtre déclarée avec tout relevé qui dépend d'un rendu | Essai `m8-tranche` ; `docs/releves-m8-anterieurs.json` ; essai `d13-releves-fenetre` | Fait |

Les deux points ouverts après la version 28 sont fermés : la précision d'un
PDF de plusieurs pages jugée sur le fichier entier, et les tris d'affichage
du studio laissés hors de la tâche.

**La page retenue.** Le lecteur suit l'arbre des pages depuis le catalogue
que désigne le dernier `/Root` : le nœud `/Pages`, puis les `/Kids` de
chaque nœud, dans leur ordre. Pour chaque page, il lit ses flux de contenu,
puis chaque objet externe que ce contenu invoque par `Do`, résolu dans les
ressources de la page ou dans celles qu'elle hérite de l'arbre. Un
formulaire se lit comme du contenu, avec ses propres ressources ; une image
ne porte aucun tracé.

Deux choses ne sont pas suivies, et l'une comme l'autre ne peut que faire
manquer un tracé, jamais en prêter un :
- une ressource déclarée et jamais invoquée. Des ressources partagées au
  niveau de l'arbre porteraient sinon les formulaires des autres pages ;
- une annotation, qui se superpose à la page sans en être le contenu.

| Ce que le suivi de la page montre | Nature | `content_kind` |
| --- | --- | --- |
| Au moins un tracé lu | `vector` | `vector` |
| Tout lu, aucun tracé | `pdf_without_paths` | `raster` |
| Aucun tracé lu, et un objet que le suivi n'a pas pu lire | `undetermined` | `undetermined` |
| Arbre des pages illisible, bouclé, ou page qu'il n'atteint pas | `undetermined` | `undetermined` |

Un objet que le suivi ne lit pas : un flux introuvable ou non décodable, un
nom invoqué absent des ressources, un objet externe d'un type inconnu, un
formulaire qui s'invoque lui-même. Un flux de tracés que nul arbre de pages
ne désigne ne rend donc plus un fichier vectoriel : c'était le cas du fichier
d'essai de bout en bout, reconstruit avec un arbre.

Le nombre de pages suit la même lecture : l'arbre suivi jusqu'au bout fait
foi, puis le `/Count` du nœud des pages, puis les objets `/Page`.

L'inspection porte une nature par page, lue une fois au dépôt. Changer de
page rejuge sans relire le fichier. Nouvel essai de bout en bout : un PDF de
deux pages dont seule la première porte un tracé lève l'avertissement sur la
seconde, pas sur la première.

**La fenêtre des relevés.** L'essai du critère 4 de M8 relève la fenêtre sur
la page mesurée, comme il relève la machine, et refuse d'écrire un relevé
sans elle. Le relevé porte aussi avec quels autres relevés il se compare.

Les relevés antérieurs n'existaient plus que dans l'historique git : chaque
passage réécrivait le fichier. Les 43 sont rétablis tels qu'ils ont été
écrits dans `docs/releves-m8-anterieurs.json`, chacun marqué non comparable.
Aucun ne déclare sa fenêtre ; les 22 premiers sont en outre des exécutions
uniques, antérieures au protocole D13. La fenêtre que la configuration
imposait à chaque commit est jointe à titre d'indication, déduite de
`playwright.config.ts` : 1280 × 720 pour 42 d'entre eux, 1366 × 768 pour le
dernier (`ae18323`).

### Tâche déclarée : remplacement des comparaisons localisées, version 29

Elle remplace la déclaration de la version 28.

**Objet.** A9 : « Comparer deux chaînes [...] se fait par leurs points de
code, jamais par une comparaison sensible à la langue ». « Dans
l'interface, un tri selon la langue de l'utilisateur est légitime, à
condition que la langue soit déclarée explicitement et non déduite de la
machine. » Version 29 : les tris d'affichage du studio « passent par la
langue active, déclarée explicitement ».

**Portée, première partie : ce qui produit.** Inchangée : les 155
occurrences relevées dans `tests/a9-releve-comparaisons-localisees.json`,
dans 66 fichiers. Chacune passe à `codePointCompare`.

**Portée, seconde partie : le studio hors du code qui alimente une
empreinte.** 64 occurrences dans 42 fichiers, relevées par la même
expression que le contrôle, dont 6 dans 3 fichiers d'essai. Les 58 hors
essais sont le décompte que donnait la version 28 ; elle les appelait toutes
des tris d'affichage, ce qui était inexact. Lues une à une, elles se
rangent en trois groupes :

| Ce qu'elles comparent | Occurrences | Traitement |
| --- | --- | --- |
| Du texte affiché : noms de sites, libellés de légende | 4, dans `PortfolioView`, `SiteRecordAdapter`, `reference-repository`, `legend` | Langue active, déclarée explicitement. `legend` déclare déjà la sienne |
| Des identifiants, des codes, des clés, des dates : départages de tri, ordre des options de filtre et des groupes, sélection (E6.1), magnétisme (E8.2), dernier passage de validation | 49, dans 33 fichiers | Points de code, `codePointCompare` |
| Un pliage de casse avec une langue fixe déjà déclarée (`'fr'`) | 5 : unicité d'un nom de site, d'un nom de bâtiment ou de niveau, d'un code de cellule (4) ; recherche du tableau des messages (1) | Unicité : indépendante de la langue active. Recherche : langue active |

Les 6 occurrences des essais comparent des identifiants : points de code.

Ordonner un identifiant selon la langue de l'interface n'aurait pas de sens,
et ferait changer un départage à chaque bascule de langue ; A9 donne pour
règle les points de code, la langue n'étant qu'une exception admise pour
l'affichage. De même, un nom ne doit pas être accepté ou refusé selon la
langue de l'interface.

**Échéance.** Avant le premier livrable réel.

**Vérification.** Le relevé de la première partie tombe à zéro et
disparaît. Dans le studio, plus aucun appel ne déduit la langue de la
machine ; les 4 tris de texte reçoivent la langue active. Chaîne A13.2
complète.

**État.** Non commencée. Le contrôle automatique empêche le relevé de la
première partie de croître ; rien n'empêche encore la seconde de croître.

### Reste ouvert après la version 29

**Le studio n'est pas gardé.** Le contrôle automatique d'A9 ne couvre que ce
qui produit. Un tri du studio qui déduit la langue de la machine peut encore
s'ajouter sans que rien ne le refuse, avant que la tâche ne s'exécute.

**Toujours au registre.**
- L'index `NULLS NOT DISTINCT` de `0063`.
- Le poids du paquet du studio.
- La tâche de découpage du dépôt PostgREST, déclarée à la version 24 et non
  commencée.
- L'écran d'évacuation (P10).
- `lineFingerprint`, hors des empreintes.

## Contrôle de l'interface, pliage de casse sans langue, ce que la version 30 ferme

| Ce que la version 30 pose | Où | État |
| --- | --- | --- |
| A9 — dans l'interface, un contrôle automatique refuse tout appel qui ne déclare aucune langue | Essai `a9-studio-langue-declaree`, relevé `a9-releve-studio-langue-non-declaree.json` | Fait |
| A9 — le pliage de casse d'un contrôle d'unicité est indépendant de toute langue | Tâche redéclarée ci-dessous | Déclarée |
| Échéance de la tâche : avant le premier livrable réel | Tâche | Confirmée |

Le point ouvert après la version 29 est fermé : le studio est gardé.

**Le contrôle de l'interface.** Il porte sur les sources du studio qui
n'alimentent aucune empreinte, essais compris ; celles qui en alimentent une
restent sous la règle du code qui produit. Une occurrence déclare sa langue
si elle est appelée et que l'argument de langue est écrit et n'est pas
`undefined` : le second de `localeCompare`, le premier de
`toLocaleLowerCase`, de `toLocaleUpperCase` et d'`Intl.Collator`. Toute autre
mention, commentaire compris, compte comme un appel sans langue.

Le relevé fige 58 appels dans 38 fichiers, tous des `localeCompare` sans
langue : 52 hors essais, 6 dans 3 fichiers d'essai. Aucun pliage de casse
n'y figure, les 5 déclarant `'fr'`. Le compte se vérifie : 64 occurrences
dans l'interface, moins `legend.ts` qui déclare sa langue, moins les 5
pliages. Un appel sans langue ajouté fait échouer
l'essai, vérifié en en ajoutant un à `GraphView.tsx`.

Le motif, la liste des points d'entrée d'empreinte et la frontière entre
code qui produit et interface sont passés dans `tests/a9-perimetre.ts`,
commun aux deux contrôles. Le contrôle du code qui produit est inchangé :
155 occurrences dans 66 fichiers.

### Tâche déclarée : remplacement des comparaisons localisées, version 30

Elle remplace la déclaration de la version 29, qu'elle reprend avec une
seule différence : le traitement des quatre contrôles d'unicité.

**Portée, première partie : ce qui produit.** Les 155 occurrences de
`tests/a9-releve-comparaisons-localisees.json`, dans 66 fichiers. Chacune
passe à `codePointCompare`.

**Portée, seconde partie : l'interface.** 64 occurrences dans 42 fichiers,
dont 58 relevées dans `tests/a9-releve-studio-langue-non-declaree.json`.

| Ce qu'elles comparent | Occurrences | Traitement |
| --- | --- | --- |
| Du texte affiché : noms de sites, libellés de légende | 4, dans `PortfolioView`, `SiteRecordAdapter`, `reference-repository`, `legend` | Langue active, déclarée explicitement. `legend` déclare déjà la sienne |
| Des identifiants, des codes, des clés, des dates | 49 hors essais, dans 33 fichiers, et 6 dans 3 fichiers d'essai | Points de code, `codePointCompare` |
| Le pliage de casse de quatre contrôles d'unicité : nom de site, nom de bâtiment ou de niveau, code de cellule (deux) | 4, dans `site-creation`, `site-structure`, `footprint-input` | Indépendant de toute langue : pliage Unicode par défaut, sans langue déclarée |
| Le pliage de casse de la recherche du tableau des messages | 1, dans `message-schedule-rows` | Langue active |

Version 30, A9 : « Une langue déclarée reste un choix de langue : en turc, le
pliage du i ne donne pas ce que le français produit, et deux noms jugés
identiques ici seraient jugés distincts ailleurs. » Les quatre contrôles
d'unicité déclarent aujourd'hui `'fr'` : ils passent le contrôle de
l'interface, qui ne peut pas savoir qu'ils décident d'une unicité, et c'est
la tâche qui les corrige.

**Échéance.** Avant le premier livrable réel, confirmée à la version 30.

**Vérification.** Les deux relevés tombent à zéro et disparaissent. Les
quatre contrôles d'unicité ne portent plus de langue. Chaîne A13.2 complète.

**État.** Non commencée. Les deux contrôles empêchent chacun leur relevé de
croître.

### Reste ouvert après la version 30

**Un pliage de casse d'unicité nouveau n'est pas refusé.** Le contrôle de
l'interface admet un pliage qui déclare sa langue, légitime pour la
recherche, fautif pour une unicité. Rien ne distingue les deux dans le
texte : un cinquième contrôle d'unicité en `'fr'` passerait.

**Le formatage des nombres et des dates.** A9 range la dépendance à la
locale « pour le formatage des nombres ou des dates » parmi les sources
d'indéterminisme. Aucun des deux contrôles ne cherche `toLocaleString`,
`toLocaleDateString`, `Intl.NumberFormat` ni `Intl.DateTimeFormat` ; le
contrôle demandé porte sur les comparaisons. Le dépôt en porte une seule
occurrence, hors du code qui produit : `BudgetView.tsx` formate un montant
avec `toLocaleString('fr-FR')`, langue déclarée mais fixe, et non la langue
active. Relevé, non traité.

**Toujours au registre.**
- L'index `NULLS NOT DISTINCT` de `0063`.
- Le poids du paquet du studio.
- La tâche de découpage du dépôt PostgREST, déclarée à la version 24 et non
  commencée.
- L'écran d'évacuation (P10).
- `lineFingerprint`, hors des empreintes.

## Fusion de `master` dans la branche de la PR #11

Ce n'est pas une version du consolidé : la fusion (`760ed5f`) porte les
PR #5 à #10 de `master` sous la version 30, et cette section dit ce qu'elle a
tranché, ce qu'elle a adapté et ce qu'elle laisse ouvert.

| Ce que la fusion pose | Où | État |
| --- | --- | --- |
| Numéros de migration de `master` conservés, ceux de la branche renumérotés | `0041`–`0049` de `master`, `0050`–`0068` de la branche (`21376c0`, renvois `9a4fe41`) | Fait |
| Montage des migrations sur une base vide, dans l'ordre | Base locale remise à zéro, 72 migrations appliquées, `0066` après `0041`–`0049` | Vérifié |
| Code de `master` lu sur le rattachement des paquets (A5.8) | `EvacuationView`, `SiteSheetView` : `isBound`, `rulesPackLabel` au lieu de `site.rules_pack_id` | Fait |
| Comparaisons localisées introduites par `master` (A9) | 12 dans le code qui produit, 76 appels sans langue dans l'interface | Remplacées |
| Contrôle D2.2 du catalogue | `tests/catalogue-consolide.test.ts` | Rouge à la fusion, vert après la PR #12 |

**Résolution des conflits.** Là où `master` avait découpé un fichier que la
branche avait modifié, le découpage de `master` est gardé et les ajouts de la
branche y sont reportés : `postgrest-http.ts` porte les requêtes, les clés de
libellés propres à la branche passent dans `messages/workshop-structure.ts`,
les essais de `compile-artwork` et de `checks-structure` suivent le découpage
de `master`. Le bloc M01.S10 de `checks-structure`, perdu au découpage, est
rétabli dans `checks-structure-cross-building.test.ts`. Aucun nom d'essai de
l'un ou l'autre côté ne manque au résultat, vérifié dans les deux sens.

Deux doublons sont retirés. Les adaptateurs d'atelier `*ScreenAdapter.tsx` de
`master` étaient un déplacement pur du code de base (`ecde44e`) : ceux de la
branche, plus complets, sont gardés. La garde de rendu `openScreen` de
`keyboard-traversal` corrigeait la même course que `waitForInteractive` : la
seconde, bornée et qui nomme son échec, est gardée.

**Adaptations au schéma et aux règles v30.** Libellés des natures de règle
`forbidden_character` et `max_sentence_words`, et note de charte corrigée,
l'audit jugeant ces deux règles. Thème d'aperçu complété de `parking_fill` et
`parking_stroke`. `a5-8-charter-enums-check` lit la dernière redéfinition de
la contrainte (`0054`, sept natures) et non plus `0006` seule.

**A9.** Identifiants, codes et dates passent à `codePointCompare`. Les noms de
bâtiment (`levelRows`) et les initiales de site se comparent ou se capitalisent
dans la langue active, déclarée par l'appelant. Le pliage du nom légal est un
contrôle d'unicité : il passe à `toLowerCase()`, sans langue, comme les quatre
autres selon la version 30. Les deux relevés ne font que baisser : 155 à 153
occurrences dans 66 fichiers pour le code qui produit, 58 à 57 appels dans
37 fichiers pour l'interface. `master` avait lui-même retiré les occurrences
de `OperationsView`, de `message-schedule-generate` et de `resolve-face`.

**Chaîne A13.2 sur le résultat.** `install`, `typecheck`, `lint`,
`test:visual` (14), `test:rls` (67), `test:determinism` (11), `test:e2e`
(138) et `build` sortent à 0. `test` sort à 1 : 4 513 essais passent, un
échoue, le contrôle D2.2. La CI de la PR échoue au même essai ; empreinte,
installation, contrôle de types et lint y passent sous Node 24.

**La PR #12, fusionnée dans la branche.** Elle ferme D2.2 sans ajouter de
code au catalogue : les codes des clients deviennent `DATA.NAME_REQUIRED`,
`DATA.NAME_DUPLICATE` et `DATA.COUNTRY_REQUIRED`, les refus de formulaire
sans code passent par `FormNotice`, la saisie des blocs se limite au bloc
libre (`EDIT.CONTEXT_VIOLATION` sinon), la déclaration des plans muraux est
retirée (D6), et les fermetures passent à `temporary_closure` (O11,
migration `0069`). Chaîne A13.2 sur la branche qui la porte : les neuf étapes
à 0, `test` à 4 499 essais, 73 migrations montées.

**A12.3 sous un propriétaire non super-utilisateur.** La CI, qui atteint
enfin `test:rls`, y échoue sur deux essais d'`audit_log` : l'essai insérait
sous le rôle propriétaire sans identité posée, ce que `FORCE` (`0025`) et la
politique d'insertion refusent. La chaîne locale se connecte en
super-utilisateur et ne pouvait pas le voir. Reproduit sur une base montée
comme en CI, corrigé par le chemin de l'application, sans lever le
cloisonnement : 67 essais sur 67 sur les deux montages. La chaîne locale
reste en super-utilisateur ; l'écart avec la CI est consigné ci-dessous.

### Reste ouvert après la fusion

**La chaîne locale ne se connecte pas comme la CI.** Elle emploie le
super-utilisateur, qui passe outre les politiques ; la CI emploie le
propriétaire `azimut`, membre d'`authenticated`. Un essai de base peut donc
passer en local et échouer en CI, comme A12.3 l'a montré. À aligner.

**Noms de tables de `master` hors H11.** H11 nomme `ad_placement_state`,
`ad_contract`, `ad_rate_card`, `ad_invoice`, `tenant_signage_rule`,
`tenant_signage_case`, `tenant_signage_doc`, `fabrication_order` et
`installation_record`. Les migrations `0042` à `0046` de `master` créent
`ad_booking`, `ad_option`,
`tenant_sign_regulation`, `tenant_sign_dossier`, `tenant_sign_part`,
`lot_support`, `install_slot`, `slot_support` et `install_reserve`. Conservées
telles quelles ; les aligner est une migration qui renomme des tables, donc un
cas d'arrêt d'A2.2.

**Migration `0048` de `master`, destructrice.** Elle convertit
`work_order.estimated_cost` en unité mineure, puis supprime la colonne. C'est
une migration qui transforme et détruit des données existantes (A2.2,
point 7), et la conversion et la suppression y sont réunies. Conservée telle
quelle ; aucune base portant des données réelles n'a été vérifiée ici.

**`postgrest-repository.ts` au-delà de 400 lignes.** 496 lignes après la
fusion ; la branche en portait déjà 515. Rejoint la tâche de découpage du
dépôt PostgREST, déclarée à la version 24.

**« Workers Builds: azimut ».** Le check de l'intégration Git du tableau de
bord Cloudflare échoue sur la PR comme sur les PR #5 et #10. Il ne vient pas
de la CI du dépôt ; le déploiement du dépôt est le job « Déploiement
Cloudflare », qui ne tourne que sur `master`.

## Fusion de la PR #11 dans `master`

La branche des versions 20 à 30 entre dans `master` par le commit de fusion
`8fe3ecc`, le 3 octobre. Elle portait déjà `master` (`760ed5f`) et la PR #12 :
la fusion se fait sans conflit.

| Ce que la fusion pose | Où | État |
| --- | --- | --- |
| Branche fusionnée par commit de fusion, et non écrasée en un seul commit | `8fe3ecc` | Fait |
| Migrations et code applicatif dans des commits distincts (A2.5) | Historique de `0050` à `0069` conservé tel quel | Conservé |
| CI de `master` sur le commit de fusion | Job `ci` : empreinte, typecheck, lint, test, visuel, RLS, déterminisme, bout en bout, build | Vert |
| Mise en production | Job « Déploiement Cloudflare », après `ci` | Vert |
| Intégration Git du tableau de bord Cloudflare | Worker `azimut`, Settings > Builds | Déconnectée |

**Pourquoi un commit de fusion.** Un écrasement en un seul commit aurait réuni
les migrations et le code applicatif, ce qu'A2.5 interdit. La fusion garde
chaque migration dans son propre commit.

**Avant de fusionner.** CI verte sur la tête `00b3cd6`, `master` déjà contenu
dans la branche, aucune revue ouverte. Le seul check rouge était
« Workers Builds: azimut ».

**Le check Cloudflare, élucidé.** Son journal, transmis après la fusion, en
donne la cause : l'intégration lançait `npx wrangler deploy` à la racine de
l'espace de travail, sans construction préalable, et wrangler refusait d'y
choisir un projet. Elle publiait par ailleurs le même Worker que la CI, sans
passer par les contrôles d'A2.3. Elle est déconnectée : la mise en production
passe désormais par le seul job « Déploiement Cloudflare », qui ne part que de
`master` et seulement après `ci`. Le check reste affiché en échec sur
`8fe3ecc`, où il a tourné avant la déconnexion.

### Reste ouvert après la fusion dans `master`

**Les migrations `0050` à `0069` sur une base existante.** Une base montée sous
l'ancien `master` les recevra. Plusieurs retirent des tables ou des colonnes
(`0052`, `0059`, `0060`, `0061`, `0066`). Avant de les appliquer à une base qui
porte des données réelles, la vérifier (A2.2, point 7).

**Toujours ouverts**, reportés de la section précédente : noms de tables hors
H11, migration `0048` destructrice, `postgrest-repository.ts` au-delà de 400
lignes, chaîne locale connectée en super-utilisateur.

## Tâche A9 exécutée : comparaisons localisées remplacées

La tâche déclarée à la version 30, et confirmée « avant le premier livrable
réel », est faite. Les deux relevés sont tombés à zéro et ont disparu ; les deux
contrôles exigent désormais zéro.

| Ce que la tâche exigeait | Où | État |
| --- | --- | --- |
| Code qui produit : chaque occurrence passe à `codePointCompare` | 153 occurrences dans 66 fichiers | Fait |
| Interface, identifiants, codes et dates : points de code | 55 des 57 appels relevés, essais compris | Fait |
| Interface, texte affiché : langue active, déclarée | Les 2 autres (noms de bâtiments, portefeuille), et le nouveau tri des sites `sitesByName` | Fait |
| Pliages des contrôles d'unicité : indépendants de toute langue | Nom de site, nom de bâtiment ou de niveau, code de cellule (deux), nom légal | Fait |
| Pliage de la recherche du tableau des messages : langue active | `foldForSearch`, `applyFilters` | Fait |
| Les deux relevés tombent à zéro et disparaissent | `a9-releve-*.json` supprimés | Fait |

**Code qui produit.** Les 153 occurrences, commentaire compris, passent à
`codePointCompare`. Aucun essai ne change de résultat : les sites de référence
ne portent pas d'identifiant ni de code dont l'ordre diffère entre les deux
comparaisons. Le rendu visuel et le déterminisme sont inchangés.

**Interface.** Les 57 appels sans langue sont remplacés. Le classement de la
version 30 est suivi :

- Les identifiants, les codes, les clés et les dates passent par points de
  code.
- Le texte affiché prend la langue active, déclarée par l'appelant.
- Les pliages d'unicité passent à `toLowerCase` et `toUpperCase`, sans langue.
  Le nom légal (Q5) en fait partie : il avait été traité à la fusion de
  `master`.
- La recherche reçoit la langue active jusqu'à `foldForSearch`.

**Le tri des sites pour l'affichage.** Le dépôt de référence ne connaît pas la
langue de l'écran. Il rend désormais ses sites dans un ordre de donnée, par
points de code. Ce sont les écrans qui les affichent qui ordonnent par nom dans
la langue active, au moyen de `sitesByName` :

- l'écran d'ouverture ;
- le sélecteur de site ;
- la liste des sites ;
- l'atelier.

La couche de données n'apprend rien de l'i18n. La coquille porte son propre
fournisseur de langue : seul l'écran qui affiche sait dans quelle langue il le
fait.

**Les contrôles.** Les essais d'exactitude des relevés sont retirés avec les
relevés. Chaque contrôle tient en un essai : aucun fichier de son périmètre ne
compte une occurrence. Vérifié en en introduisant une dans `engine-graph` et
une dans l'interface : les deux contrôles échouent et nomment le fichier.

**Chaîne A13.2.** Les neuf étapes sortent à 0 : `test` à 4 500 essais,
`test:visual` à 14, `test:rls` à 67, `test:determinism` à 11, `test:e2e` à
138, `build` sans erreur.

### Reste ouvert après la tâche A9

**Un pliage d'unicité nouveau qui déclare une langue n'est toujours pas
refusé.** Le contrôle de l'interface admet un appel qui déclare sa langue : la
recherche en a besoin, une unicité non. Rien ne distingue les deux dans le
texte. Reporté de la version 30.

**L'ordre que rend le dépôt PostgREST.** `listSites` demande `order=name.asc`.
L'ordre suit alors la collation de la base, que le dépôt ne fixe pas. Les
écrans réordonnent dans la langue active, et l'affichage ne dépend donc pas de
la collation. L'ordre de donnée du dépôt PostgREST, en revanche, peut différer
de celui du dépôt de référence. Relevé, non traité.

**Le formatage des nombres et des dates.** Reporté de la version 30 : aucun
contrôle ne cherche `toLocaleString` ni `Intl.NumberFormat`.

## Identité du service de compilation : le travail porte son demandeur

Le blocage relevé à la section 5 (« `loadSiteData` sans identité ») est levé.
Le cahier des charges ne disait pas comment un service sans utilisateur lit
sous cloisonnement ; l'utilisatrice a retenu, parmi les options présentées,
celle où **le travail porte l'identité de son demandeur**.

| Ce qui est posé | Où | État |
| --- | --- | --- |
| Le travail porte son demandeur | `job.requested_by`, migration `0070` | Fait |
| Le demandeur est posé par la base et ne s'usurpe pas | Défaut `azimut.current_user_id()`, politique restrictive `job_requested_by_self` | Fait |
| Le demandeur ne change plus après l'insertion | Déclencheur `guard_job_requested_by` | Fait |
| Le service lit sous l'identité du demandeur | `loadSiteDataAs`, `dbLoadSite` | Fait |
| Le site lu appartient à l'organisation du travail | `loadSiteData` | Fait |
| Un travail sans demandeur est refusé, jamais deviné | `createKioskPackageJobHandler` | Fait |
| Un lot porte son demandeur sur chaque travail | `runBatch`, option `requested_by` | Fait |

**Aucune politique n'élargit ce qu'un rôle voit.** Le service ouvre une
transaction par lecture, sous le rôle `authenticated` et l'identité du
demandeur, par le même mécanisme que le chemin d'écriture. Il voit exactement
ce que le demandeur voit, et le cloisonnement reste en base (A6.1).

**Trois gardes**, sans lesquelles l'option ouvrirait une brèche entre
organisations :

1. Un membre de A ne peut pas créer un travail au nom d'un utilisateur de B :
   le service lirait B pour le compte de A.
2. Le demandeur ne change pas après l'insertion.
3. Un membre de deux organisations ne fait pas lire le site de l'une sous le
   nom de l'autre.

**Migration additive.** La colonne est facultative et aucune ligne existante
n'est transformée (A2.2, point 7). Un travail antérieur, sans demandeur, est
refusé par le service.

**Preuve.** `a6-1-travail-demandeur.db.test.ts`, 7 essais, passe sur la base
de développement et sur une base montée comme en CI (propriétaire non
super-utilisateur). Il vérifie :

- le demandeur lit son site ;
- un utilisateur de A ne lit rien de B ;
- un membre des deux organisations est refusé ;
- sans identité, la lecture ne voit rien ;
- le demandeur est posé par défaut ;
- l'usurpation est refusée par la politique ;
- la modification est refusée par le déclencheur.

Le décor s'installe par le chemin identifié, sans lever le cloisonnement.

**Chaîne A13.2.** Les neuf étapes sortent à 0 : `test` à 4 502 essais,
`test:visual` à 14, `test:rls` à 74, `test:determinism` à 11, `test:e2e` à
138, `build` sans erreur. Les 74 migrations se montent sur une base vide.

### Reste ouvert après l'identité du service

**La file elle-même.** Le service n'a encore ni file en base, ni point
d'entrée `worker` : la file n'existe qu'en mémoire. Une file en base devra
lire les travaux en attente de toutes les organisations, ce que l'identité
d'un demandeur ne permet pas. Il faudra une voie dédiée, à décider le jour où
la file en base se construit.

**Les autres lectures du service.** Seul le paquet de borne lit la base
aujourd'hui. Tout autre gestionnaire qui la lira devra passer par la même
lecture identifiée.

## File des travaux en base (T-0.11)

Voie retenue par l'utilisatrice, entre trois proposées : des fonctions de
prise, et rien d'autre. Les deux voies écartées étaient un rôle qui lève le
cloisonnement sur `job`, et un service par organisation.

**Migration 0071** (commit seul, A2.5). Trois fonctions SECURITY DEFINER :

- `job_claim` prend le plus ancien travail en file dont la temporisation est
  écoulée. Elle utilise `SKIP LOCKED` et un ordre total.
- `job_stalled` désigne les travaux en cours depuis plus que le délai de D9.2.
- `job_abandon` clôt en échec un travail en cours que nul ne peut plus porter.

Elles n'apprennent d'un travail que son identifiant, son organisation, son
type, son demandeur et sa tentative. Elles appartiennent à
`azimut_job_dispatch`, rôle sans connexion. Les deux politiques de prise ne
s'adressent qu'à lui, et il n'a sur `job` que la lecture et la modification.
Seul `azimut_compiler`, rôle du service sans aucun droit sur les tables, les
exécute. `authenticated` n'en exécute aucune.

Un second rôle est nécessaire parce que FORCE soumet aussi le propriétaire des
tables aux politiques. Possédées par lui, les fonctions ne verraient rien, et
ouvrir une politique au propriétaire l'ouvrirait à toute connexion sous son
nom.

La temporisation n'ajoute pas de colonne. Un travail remis en file garde
l'heure de fin de son essai échoué, et le service passe la temporisation en
paramètre, depuis sa seule définition. Aucune ligne n'est touchée. La CI et
ORDRE.md posent les deux rôles avant les migrations, comme `authenticated`.

**Le service** (`DbWorkerQueue`, requêtes dans `@azimut/db`) prend sous
`azimut_compiler`, puis lit le contenu et clôt sous l'identité du demandeur.
Une clôture réussie termine le travail. Un échec le remet en file avec la
temporisation tant que des tentatives restent, et le clôt en échec ensuite.
Un travail sans demandeur, ou dont le demandeur a quitté l'organisation, est
abandonné, avec sa raison écrite dans la ligne. Une clôture tardive, après
qu'un travail stagnant a été relevé et repris ailleurs, ne touche pas l'essai
suivant.

**Essais sur base réelle** (`db-queue.db.test.ts`, 7 cas) :

- prise des travaux de deux organisations, chacun lu et clos sous son
  demandeur ;
- rejeu d'un travail factice après échec, refusé à 4 s et pris à 5 s, sans
  doublon, c'est l'acceptation de T-0.11 ;
- tentatives épuisées ;
- stagnation relevée à 30 minutes et pas à 29, clôture tardive sans effet ;
- demandeur parti de l'organisation, travail abandonné avec la raison ;
- `authenticated` n'exécute aucune des trois fonctions ;
- `azimut_compiler` ne lit ni n'écrit la table.

Sur la base configurée comme en CI (propriétaire non superutilisateur),
`test:rls` passe : 81 essais sur 81.

**Chaîne A13.2.** Les neuf étapes sortent à 0 : `test` à 4 502 essais,
`test:visual` à 14, `test:rls` à 81 (74 avant, plus les 7 de la file),
`test:determinism` à 11, `test:e2e` à 138, `build` sans erreur. Les 75
migrations se montent sur une base vide.

### Reste ouvert après la file en base

**Le point d'entrée du service.** Aucun exécutable ne lance encore
`runWorkerLoop` sur `DbWorkerQueue` avec une connexion réelle. Sa connexion,
en production, devra être membre de `azimut_compiler` et de `authenticated`,
et de rien d'autre (ORDRE.md).

**L'historique par tentative.** La trace de A12.2 est la ligne du travail :
état, début et fin, tentatives, dernière erreur, résultat. Les erreurs des
tentatives antérieures ne sont pas conservées en base. La file en mémoire les
garde, la file en base non.

**Deux types de travaux sans place en base.** Le service connaît
`build_delivery_archive` et `build_wall_plans`. Ni A5.10 ni la contrainte de
`job.kind` ne les listent, donc un tel travail ne peut pas être inséré.
L'écart est entre le code et le cahier des charges, et il revient à l'éditeur
du cahier de le trancher.

## Point d'entrée du service de compilation

Voie retenue par l'utilisatrice : le paquet de borne d'abord. Les autres
gestionnaires passeront dans une tâche suivante.

**`main.ts` et `service.ts`.**

- Le service lit sa configuration dans l'environnement :
  - `AZIMUT_COMPILER_DATABASE_URL` ;
  - `AZIMUT_KIOSK_BUNDLE_DIR` ;
  - `AZIMUT_PACKAGE_DIR` ;
  - `AZIMUT_KIOSK_MIN_RUNTIME` ;
  - les cadences, facultatives.
- Une configuration incomplète est refusée au démarrage avec le code 2. Le
  message nomme tout ce qui manque.
- La boucle prend les travaux de la file en base jusqu'à SIGTERM ou SIGINT. Un
  arrêt n'interrompt jamais un travail, puis la connexion est fermée.
- Un seul gestionnaire est branché : `build_kiosk_package`. Un travail d'un
  autre type est remis en file avec la raison, sans arrêter le service.

**L'enregistreur du paquet sous le demandeur.** `dbKioskPackageRecorder`
insérait la ligne `kiosk_package` sans identité. Sous FORCE, sur toute base
réelle, cette insertion était refusée. Il passe désormais par
`insertKioskPackageAs`, sous l'identité du demandeur.

**Essais.**

- Configuration : 5 cas.
- Service assemblé comme en production, contre la base réelle (2 cas) :
  - un travail déposé par un utilisateur est pris, le site est lu sous son
    identité, le paquet est écrit dans le répertoire et la ligne
    `kiosk_package` est enregistrée sous la même identité ;
  - un travail sans gestionnaire est remis en file avec la raison.
- Lancement réel sur la base configurée comme en CI :
  - sans configuration, code 2 et la liste des quatre variables ;
  - avec configuration, la file est interrogée, SIGTERM donne un arrêt
    propre, le code 0, et aucune connexion ne reste ouverte.

**Chaîne A13.2.** Les neuf étapes sortent à 0 : `test` à 4 507 essais
(4 502 plus les 5 de la configuration), `test:visual` à 14, `test:rls` à 83
(81 plus les 2 du service assemblé), `test:determinism` à 11, `test:e2e` à
138, `build` sans erreur, sur une base remise à zéro (75 migrations).

### Reste ouvert après le point d'entrée

**Les quatre autres gestionnaires** (`compile_artworks`, `audit_site`,
`export_quantities`, plans muraux) reçoivent encore un site figé à leur
construction.

**Deux notes de décision** :

- `docs/note-editeur-types-de-travaux.md`, pour l'éditeur du cahier ;
- `docs/note-base-studio-deploye.md`, pour l'utilisatrice.

## Exécution du service : un seul module construit par Vite

Voie retenue par l'utilisatrice, entre trois proposées : un seul fichier
construit par Vite. Les deux voies écartées étaient `tsx`, bibliothèque
nouvelle, et la compilation de chaque paquet vers `dist/`.

Node ne sait pas charger les sources de l'espace de travail : leurs imports en
`.js` désignent des fichiers `.ts`. `apps/compiler/vite.config.ts` construit
donc `dist/main.js`, en mode SSR, sans minification, avec sa carte de sources.

- Les paquets `@azimut/*` et leurs dépendances (`postgres`, `drizzle-orm`,
  `zod`) y sont rassemblés.
- Le module n'importe plus que des modules intégrés à Node. Il se lance par
  `node dist/main.js` (`pnpm --filter @azimut/compiler start`) et n'a besoin
  d'aucun `node_modules` à côté de lui.
- Vite était déjà dans le dépôt, pour le studio. Il entre comme dépendance de
  développement du service, à la même version.
- `pnpm build` construit désormais le module, la CI aussi.
- `vite.config.ts` entre dans le contrôle de types des fichiers de
  configuration.

**Essai du module construit**, sur la base configurée comme en CI
(propriétaire non superutilisateur) :

- sans configuration, code 2 et la liste des quatre variables ;
- un travail `build_kiosk_package` déposé par un utilisateur est pris ;
- les neuf fichiers du paquet sont écrits : programme, données, `maps/level-0.svg`
  et `manifest.json` ;
- la ligne `kiosk_package` est enregistrée sous le demandeur ;
- le travail passe à `succeeded` à la première tentative ;
- SIGTERM donne un arrêt propre et le code 0.

**Chaîne A13.2.** Les neuf étapes sortent à 0, dont `install` sur le fichier de
verrouillage mis à jour, en mode figé. Résultats : `test` à 4 507, `test:visual` à 14,
`test:rls` à 83, `test:determinism` à 11, `test:e2e` à 138, et `build`, qui
construit `dist/main.js` (586 ko), sans erreur.

## Stylet : socle et décalque dans l'atelier des empreintes (J1, G3)

Demande de l'utilisatrice : tracer au stylet dans Azimut. Elle a choisi de
commencer par le socle et le décalque. Le fond est un plan en image pour
l'instant ; le rendu des PDF fera l'objet d'une décision à part.

**Ce que le cahier permet et refuse.**

- Il permet :
  - le stylet comme méthode de saisie : la forme reconnue est quantifiée et
    devient une donnée ordinaire (J0, J1) ;
  - l'esquisse libre (J3) ;
  - l'annotation de revue (J4) ;
  - l'éditeur de pictogrammes d'orientation (J5).
- Il refuse :
  - un panneau dessiné à la main (INV-1, INV-2) ;
  - toute modification depuis la vue 3D (S-6) ;
  - un parcours dessiné à la main, puisqu'il est calculé depuis le réseau,
    qui lui se trace au stylet.

**Socle** (`apps/studio/src/editor/ink/`, fonctions pures, 26 essais) :

- type de pointeur et tolérances de G3.2 ;
- refus du tracé au doigt (G3.1) ;
- rejet de la paume (G3.4) : le doigt est ignoré tant que le stylet touche
  ou a signalé sa présence depuis moins de 1,5 s, l'heure venant de
  l'événement ;
- reconnaissance des formes de J1.2 et redressement d'un bloc de J1.3 ;
- candidates rangées, quantifiées au millimètre, sans lecture de la
  pression ; la suppression n'est jamais proposée en premier.

**Décalque dans M3.** L'atelier n'avait pas de zone de travail : seule la
saisie numérique existait.

- La zone montre :
  - le plan calé en fond, s'il est en image ;
  - les empreintes du niveau ;
  - le contour en cours, à l'accent ;
  - le trait d'origine en filigrane jusqu'à la clôture.
- Un trait au stylet ou à la souris est lu selon l'outil actif :
  - la cellule préfère le rectangle ;
  - le polygone libre préfère le polygone ;
  - le rectangle n'accepte que le rectangle.
- La lecture retenue remplace le contour en cours. Elle se modifie au clavier
  dans le panneau et se ferme comme une saisie. L'autre lecture se prend en
  un geste.
- Le doigt est refusé avec son motif. Un outil qui ne trace pas le dit.

**Placement du plan** (`domain/plan-placement.ts`, 7 essais) : le plan se
déduit du calage déjà enregistré (échelle, azimut, points de la mesure). Le
cahier ne fixait pas quel pixel de l'image correspond à l'origine du site.
Décision de l'utilisatrice : le point A du calage. L'image elle-même est
gardée par la session depuis le calage, le temps de la session, puisque le
téléversement n'existe pas encore. Après rechargement, la zone le dit.

**Essais de bout en bout** (`j1-trace-stylet.spec.ts`, 7 cas) :

- un rectangle à main levée devient le contour en cours, sur les axes ;
- le contour se ferme comme une saisie, et le trait d'origine s'efface ;
- un outil qui ne trace pas le dit ;
- le doigt est refusé ;
- la paume est ignorée pendant le survol du stylet ;
- sans plan calé, la zone le dit ;
- l'image calée est posée en fond, et après rechargement la zone dit que le
  fichier n'est plus gardé.

**Chaîne A13.2.** Les neuf étapes sortent à 0, sur une base remise à zéro
(75 migrations) : `test` à 4 547 (essais de la reconnaissance, du placement et
de l'atelier compris), `test:visual` à 14, `test:rls` à 83, `test:determinism`
à 11, `test:e2e` à 145 (138 plus les 7 du tracé), `build` sans erreur. Un
premier passage avait échoué sur le contrôle des citations de règle : quatre
commentaires citaient M2, M3 ou M7.10 sans leur partie ; corrigé.

### Reste ouvert après le décalque

**Contradiction dans J1.5 (A2.2, cas 3), signalée à l'éditeur du cahier.**
J1.5 admet le déplacement et le zoom à deux doigts « pendant que le stylet
dessine ». La même section dit tout contact tactile ignoré dès qu'un stylet
est détecté. Aucune des deux lectures n'est appliquée : pendant que le
stylet est actif, le doigt ne trace ni ne sélectionne, et la navigation au
doigt n'est pas construite.

**Réglages choisis**, paramètres d'ergonomie et non valeurs normatives :

- les seuils des trois niveaux d'intensité ;
- le pas de 15° des angles remarquables (E, « valeur réglable ») ;
- 1,5 s d'inactivité du stylet.

L'intensité n'est pas encore mémorisée par utilisateur (J1.3) : elle est au
niveau intermédiaire.

**Encore à construire** :

- le rendu des PDF en fond (décision de bibliothèque, A2.2 cas 4) ;
- le téléversement du plan ;
- les trois réglages du fond (J1.4) ;
- le zoom et le déplacement dans la zone ;
- la couche d'esquisse (J3) ;
- l'annotation de revue (J4) ;
- l'éditeur de pictogrammes (J5) ;
- la vue isométrique (S1).

## Stylet : le réseau de circulation dans l'atelier du graphe (J1.2)

Suite du socle, dans l'option choisie par l'utilisatrice. Le parcours se
calcule depuis ce réseau, il ne se dessine jamais à la main (INV-1).

**Gestes reconnus dans la vue du graphe.**

- Outil « Nœud » : un point appuyé pose un nœud du type choisi avant le geste
  (J1.2). Un point appuyé sur un nœud déjà posé le sélectionne, sans en
  poser un second par-dessus.
- Outil « Arête » : un trait qui part d'un nœud et arrive sur un autre les
  relie. L'arête prend la largeur héritée du bâtiment et passe par le même
  jugement que l'outil au clavier (`acceptEdge`).
- Chaque geste est une commande annulable.
- Les outils Axe et Liaison verticale ne lisent pas le trait et le disent.
- Un trait mal formé dit ce que l'outil attend.

**Construction.**

- La capture du trait est commune aux deux ateliers
  (`editor/ink/use-stroke-capture.ts`). Elle ramène les coordonnées au repère
  de la vue quand la feuille de style la met à l'échelle, et remet l'échelle
  réelle de l'écran à la reconnaissance.
- La vue du graphe s'ajuste sur les empreintes du niveau et les nœuds : un
  cadrage qui suivrait le seul nœud posé ferait tomber le suivant ailleurs
  que là où on l'a tracé.
- La logique est dans `state/graph-ink.ts` (6 essais) ; l'écriture dans
  `app/useGraphInk.tsx`, à part pour garder l'adaptateur du graphe sous
  400 lignes (A2.4).

**Essais de bout en bout** (2 cas de plus dans `j1-trace-stylet.spec.ts`,
passés trois fois de suite) :

- deux points appuyés posent deux nœuds, un troisième sur un nœud n'en pose
  pas, et un trait de l'un à l'autre trace l'arête ;
- un trait qui ne part d'aucun nœud est refusé avec son motif.

En les écrivant, la course de M7.8 est réapparue : une touche frappée avant
que l'atelier soit monté. L'essai attend désormais la barre d'outils et
vérifie l'outil actif avant de tracer.

**Régression attrapée par la chaîne, puis corrigée.** Le premier passage
(chain40) a fait échouer six essais de M4 : en mode tracé, la vue capturait le
pointeur dès l'appui, le clic n'atteignait plus le nœud ou l'arête, et la
sélection ne se faisait plus. Un point appuyé sur une arête aurait même posé
un nœud dessus. La capture remet désormais l'élément sous le pointeur au
moment de l'appui : un point appuyé sur un nœud ou une arête est une
sélection, et seul un vrai trait, ou un point appuyé dans le vide, va à la
reconnaissance. L'essai du stylet vérifie désormais aussi la sélection.

**Chaîne A13.2.** Après correction (chain41), les neuf étapes sortent à 0
sur une base remise à zéro : `test` à 4 553, `test:visual` à 14, `test:rls` à
83, `test:determinism` à 11, `test:e2e` à 147 (145 plus les 2 du graphe),
`build` sans erreur.

## Zoom et déplacement dans les zones de travail (E3.3)

Prérequis pour décalquer finement un vrai plan. Rien n'était à décider : la
partie E le fixe.

**Le module de transformation unique** (`viewport/view-transform.ts`, E3.1)
porte désormais les opérations de vue :

- un cran de zoom autour d'un point, au facteur nommé `ZOOM_STEP_FACTOR`,
  borné, la vue restant immobile hors bornes ;
- le déplacement ;
- `affineToView`, qui tire la matrice de pose du plan de `toView`.

Le placement du plan calculait auparavant sa propre conversion vers la vue
(`imageMatrix`), contre E3.1 : il est retiré, et la pose du fond passe par
la transformation unique.

**Navigation** (`viewport/use-zone-view.ts`), commune aux deux zones :

- molette autour du pointeur ;
- déplacement au bouton du milieu ou espace enfoncée, sans rien tracer ;
- boutons « Zoom avant », « Zoom arrière » et « Recadrer sur le contenu »
  pour le clavier (E6.2).

La vue suit son contenu (le fond de plan arrive après l'ouverture) tant que
l'utilisateur ne l'a pas bougée. Elle n'entre ni dans l'historique ni dans le
modèle. Elle est mémorisée par zone et par niveau dans le stockage du
navigateur (`view-memory.ts`). Une valeur illisible ou hors bornes est
ignorée, et un stockage refusé ne casse rien.

**Essais.**

- Unitaires : 4 pour le zoom et le déplacement, 4 pour la mémoire.
- De bout en bout, 3 de plus dans `j1-trace-stylet.spec.ts` :
  - la molette zoome, le recadrage revient, le zoom arrière s'applique ;
  - le bouton du milieu déplace la vue de 60 pixels, sans rien tracer ;
  - la vue se retrouve au rechargement.

**Chaîne A13.2.** Les neuf étapes sortent à 0 du premier coup (chain42), sur
une base remise à zéro : `test` à 4 561, `test:visual` à 14, `test:rls` à 83,
`test:determinism` à 11, `test:e2e` à 150 (accessibilité axe de M3 et M4
comprise, avec les nouveaux boutons), `build` sans erreur.

### Reste ouvert après la navigation

- La navigation au doigt (G3.3) attend que l'éditeur tranche la contradiction
  de J1.5.
- `rotationDeg` reste à 0 dans les ateliers : l'aperçu orienté de D6 n'est
  pas leur affaire.

## Couche d'esquisse dans la zone de travail (J3)

Décisions prises avec l'utilisateur : J3.4 complété par la règle de A5
(`updated_at`, `deleted_at` sur les deux tables), et une palette d'esquisse
de quatre couleurs de feutre — graphite, brique, outremer, sapin — portée par
des jetons `sketch-*` distincts de ceux de l'interface et des chartes (J3.2).

**Base** (migration 0072, commit à part) :

- `sketch_layer` et `sketch_stroke`, sous cloisonnement forcé ;
- outil et couleur bornés en base ;
- `points` en `jsonb`, tracé et pression tels quels ;
- l'auteur est pris en base (`owner_id` par défaut `current_user_id()`).

Le module 12 est propriétaire des deux tables.

**Studio.**

- `state/sketch.ts` :
  - le premier trait crée la couche du niveau dans le même geste ;
  - la gomme supprime logiquement les traits touchés, d'un seul geste ;
  - la couche se masque et se remontre ;
  - la pression module l'épaisseur et l'opacité, et le marqueur reste
    translucide d'un bloc.
- La capture de trait remet désormais la pression lue à chaque point. Seule
  l'esquisse la garde.
- Dans la zone de travail des empreintes, le bouton « Esquisser » détourne le
  trait vers la couche : il n'est ni lu, ni redressé, ni quantifié (J3.3).
  Hors de ce mode, l'esquisse reste affichée sous le travail.
- La relecture depuis le dépôt passe par `loadSketch`, à part de `loadSite` :
  l'esquisse n'entre jamais dans `SiteData`, que lisent moteurs et
  compilateur.

**Contrôle automatisé sur les exports (J3.3)** — `tests/j3-3-esquisse-hors-livrable.test.ts` :

- `SiteData` ne porte aucune esquisse ;
- ni les moteurs, ni le compilateur, ni le paquet de borne, ni la couche
  d'accès (hors schéma), ni les règles ne nomment les tables ou leurs
  lectures ;
- dans le studio, seule une liste blanche de fichiers de l'atelier le peut.

**Défaut trouvé en chemin.** Le client `postgres` sérialise en « faux » toute
valeur non booléenne passée à une colonne booléenne, la chaîne `'true'`
comprise (sonde : `select 'true'::text` passé en paramètre booléen rend
`false`). L'esquisse écrit de vrais booléens, et un essai en base le vérifie.

**Essais.**

- Unitaires : 6 pour l'esquisse, 3 pour la palette, 6 pour le contrôle J3.3.
- En base (`test:rls`) : 5, dont le cloisonnement, la gomme, le masquage et
  le refus d'une couleur hors palette.
- De bout en bout, 6 dans `j3-esquisse.spec.ts` :
  - le trait gardé tel quel, dans sa couleur ;
  - le même trait lu comme une forme hors mode esquisse ;
  - la pression du stylet qui épaissit le trait ;
  - la gomme ;
  - le masquage ;
  - l'annulation.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain43), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 576 |
| `test:visual` | 14 |
| `test:rls` | 88 |
| `test:determinism` | 11 |
| `test:e2e` | 156 |
| `build` | sans erreur |

### Reste ouvert après l'esquisse

- La promotion (entourer une esquisse et demander sa conversion, J3.3)
  n'est pas faite. *Faite depuis : voir la section « Promotion d'une
  esquisse ».*
- L'inclinaison qui module la largeur du marqueur (J3.2) n'est pas faite :
  J3.4 ne prévoit pas de la conserver dans `points`. C'est un choix de modèle
  à faire trancher (A2.2).
- L'esquisse n'est proposée que dans l'atelier des empreintes, pas encore
  dans celui du graphe.
- L'auteur et la date sont en base mais pas encore affichés.
- Le verrouillage de couche est lu et respecté, mais aucun bouton ne le pose.
- `graph-update-commands.ts` écrit encore `'true'`/`'false'` en chaînes.
  Le studio passe par PostgREST, qui les convertit bien ; le chemin
  `applyCommands` les enregistrerait à faux.

## Réglages du fond de décalque et gomme du stylet (J1.4, J1.5)

Rien n'était à décider : J1.4 et J1.5 les fixent.

**J1.4, les trois réglages du fond.**

- L'opacité du plan calé se règle au curseur, par pas de 10 %. Elle part de
  60 %, la valeur que la zone appliquait jusque-là.
- Les formes déjà tracées se montrent ou se masquent d'une case.
- Les deux réglages sont des préférences de travail, comme la position de vue
  (E3.3). Ils sont gardés dans le stockage du navigateur, par zone et par
  niveau, et n'entrent ni dans la base ni dans l'historique
  (`viewport/backdrop-settings.ts`). Une valeur illisible est ignorée champ
  par champ.
- Le verrouillage du fond est acquis par construction : la zone n'offre aucun
  geste qui déplace le fond, que seul le calage pose. Aucune bascule inerte
  n'est ajoutée.

**J1.5, la gomme du stylet.**

- Le bout gomme d'un stylet retourné (`buttons` 32) et le bouton latéral
  (`buttons` 2) sont lus à la pose (`isPenEraser`). Le geste entier est alors
  un geste de gomme.
- En mode esquisse, il efface quel que soit l'outil choisi.
- Hors esquisse, dans l'atelier des empreintes comme dans celui du graphe, il
  ne touche à rien et le dit : une forme se retire par une commande, jamais
  d'un frottement.

**Essais.**

- Unitaires : 3 pour les réglages, 2 pour la lecture des boutons.
- De bout en bout, 5 dans `j1-reglages-stylet.spec.ts` :
  - l'opacité appliquée au plan ;
  - les formes masquées, et le réglage retrouvé au rechargement ;
  - le bout gomme ;
  - le bouton latéral ;
  - le refus hors esquisse.

### Reste ouvert après les réglages

- L'appui long pour le menu contextuel (J1.5) : le contenu du menu n'est pas
  spécifié.
- Les deux doigts pendant le tracé (J1.5) attendent que la contradiction
  signalée à l'éditeur soit tranchée.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain44), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 581 |
| `test:visual` | 14 |
| `test:rls` | 88 |
| `test:determinism` | 11 |
| `test:e2e` | 161 |
| `build` | sans erreur |

## Promotion d'une esquisse (J3.3)

« Entourer une esquisse et demander sa conversion produit une forme reconnue,
arbitrée et quantifiée comme n'importe quelle saisie. La promotion est
explicite, jamais automatique. » Rien n'était à décider.

**Deux temps, séparés.**

1. L'outil « Entourer » de l'esquisse choisit les traits que le lasso entoure
   entièrement (J1.2 : boucle autour de plusieurs formes, sélection). Les
   traits choisis sont cernés d'un halo pointillé. Rien n'est converti.
2. « Convertir en forme » remet les traits choisis, mis bout à bout, à
   l'atelier des empreintes. Il les lit comme un trait : même reconnaissance,
   même outil actif, même arbitrage, même quantification. Le résultat est le
   contour en cours, que l'on ferme comme une saisie.

**Mise bout à bout** (`state/sketch-promotion.ts`). L'enchaînement part du
premier trait par identifiant. À chaque pas, il prend le trait dont une
extrémité est la plus proche, retourné au besoin. Le tracé produit ne dépend
donc que des traits choisis, jamais de l'ordre où ils ont été tracés (A9). La
pression ne passe pas dans la saisie.

**L'esquisse reste.** La promotion ne la modifie ni ne la retire : la forme
est une saisie nouvelle. Le lasso est permis sur une couche verrouillée, car
il ne fait que choisir. Il n'est proposé que là où l'atelier sait convertir.

**Essais.**

- Unitaires : 4.
- De bout en bout, 3 dans `j3-promotion.spec.ts` :
  - un rectangle esquissé, entouré puis converti, devient le contour en cours,
    sur les axes, et l'esquisse reste ;
  - quatre traits fermés se convertissent d'un seul tenant ;
  - un lasso vide le dit.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain45), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 585 |
| `test:visual` | 14 |
| `test:rls` | 88 |
| `test:determinism` | 11 |
| `test:e2e` | 164 |
| `build` | sans erreur |

### Reste ouvert après la promotion

- La promotion n'est proposée que dans l'atelier des empreintes, là où
  l'esquisse l'est.
- Le cercle et l'ovale (J1.2) ne sont pas reconnus : une empreinte reste un
  polygone.

## Stylet : graphe, trait barrant, redressement, ellipse (J3, J1.2, J1.3)

Deux décisions de l'utilisateur, prises le 2026-10-05 :

- **J1.3**, le niveau de redressement est mémorisé dans le stockage du
  navigateur, comme la position de vue (E3.3). Aucune table n'est ajoutée.
- **Cercle et ovale**, la décision a été déléguée (« choisis la meilleure
  solution »). L'ellipse va à l'éditeur d'habillage, où elle est une forme.
  Une empreinte reste un polygone, ce qui évite de fixer un nombre de sommets
  arbitraire. La nature de la forme vient de l'outil actif (J2).

**L'esquisse dans l'atelier du graphe (J3, J3.3).**

- La couche d'esquisse est celle du niveau : ce qui est esquissé dans un
  atelier se voit dans l'autre.
- Mêmes outils, même lasso.
- Une esquisse promue y est lue comme un trait du réseau : tracée d'un nœud
  à un autre avec l'outil Arête, elle les relie.

**Le trait barrant (J1.2).**

- Un trait ouvert qui barre une ou plusieurs empreintes les supprime, d'un
  seul geste annulable, quel que soit l'outil (`state/footprint-strike.ts`).
- La commande porte la ligne, colonne par colonne, et l'annulation la
  rétablit telle qu'elle était. Un essai en base le vérifie, ainsi que le
  refus pour une autre organisation.
- Une empreinte que d'autres lignes citent (volume, destination…) n'est pas
  supprimée. La base les emporterait par ses clés étrangères et l'annulation
  ne les rendrait pas : c'est la règle du niveau peuplé, appliquée au barré.
  L'écran nomme l'empreinte et le nombre d'éléments qui la citent.

**Le redressement (J1.3).** Strict, intermédiaire ou permissif, réglé dans
les deux ateliers et retrouvé à la session suivante. L'éditeur d'habillage
lit le même réglage. Tant que le studio n'ouvre aucune session
d'authentification, l'utilisateur est le profil du navigateur.

**Cercle et ovale (J1.2).**

- Dans l'éditeur d'habillage, avec l'outil Ellipse, le stylet trace à main
  levée. À la levée, le trait devient une ellipse posée sur les axes, cercle
  si proche.
- Un ovale de biais au-delà de l'écart admis sur un axe n'est pas redressé
  d'office, et l'éditeur le dit.
- La souris garde le cadre tiré d'un coin à l'autre (E7.1).

**Essais.**

- Unitaires :
  - 3 pour le barré ;
  - 2 pour la mémoire du redressement ;
  - 5 pour la lecture de l'ellipse.
- En base : 2 pour le barré (`footprint-strike.db.test.ts`).
- De bout en bout :
  - 2 dans `j3-esquisse-graphe.spec.ts` ;
  - 3 de plus dans `j1-reglages-stylet.spec.ts` (barré et annulation, trait
    qui ne barre rien, redressement retrouvé d'un atelier à l'autre) ;
  - 2 dans `j1-ellipse-habillage.spec.ts`.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain46), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 595 |
| `test:visual` | 14 |
| `test:rls` | 90 |
| `test:determinism` | 11 |
| `test:e2e` | 171 |
| `build` | sans erreur |

### Reste ouvert après ce lot

- Le barré n'agit que sur les empreintes. Dans l'atelier du graphe, un nœud
  ou une arête se retire par le panneau.
- Le stylet n'entre dans l'éditeur d'habillage que par l'outil Ellipse. Le
  rectangle et le polygone y gardent le geste de la souris. *Le rectangle est
  fait depuis : voir la section « Rectangle au stylet ».*
- La clé du redressement prendra l'identifiant de l'utilisateur quand le
  studio ouvrira une session d'authentification.

## Rectangle au stylet dans l'éditeur d'habillage (J1.2)

« Rectangle approximatif : rectangle, angles droits. » Rien n'était à
décider : c'est la même règle que l'ellipse.

- Avec l'outil Rectangle, le stylet trace à main levée. À la levée, le trait
  devient un rectangle posé sur les axes.
- Un rectangle tracé de biais au-delà de l'écart admis sur un axe n'est pas
  redressé d'office, et l'éditeur le dit.
- La souris garde le cadre tiré d'un coin à l'autre.
- La lecture des formes de l'habillage est réunie dans
  `editor/ink/editor-shapes.ts`.

**Le barré dans l'atelier du graphe n'est pas fait, à dessein.** M4 ne
spécifie aucune suppression de nœud ni d'arête. En retirer un toucherait la
validation du graphe et le tableau des messages (M02.W8). Ce n'est pas à
l'atelier de l'inventer : le point est laissé à l'éditeur du cahier.

**Essais.**

- Unitaires : 3 de plus dans `editor-shapes.test.ts`.
- De bout en bout : 1 de plus dans `j1-ellipse-habillage.spec.ts`.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain47), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 598 |
| `test:visual` | 14 |
| `test:rls` | 90 |
| `test:determinism` | 11 |
| `test:e2e` | 172 |
| `build` | sans erreur |

## Booléens : le chemin d'écriture refuse ce qu'il écrirait faux

Décision de l'utilisateur du 2026-10-05 : corriger le défaut constaté pendant
l'esquisse.

**Le défaut.** Le client `postgres` sérialise une valeur destinée à une
colonne booléenne par `x === true ? 't' : 'f'`. La chaîne `'true'` s'écrivait
donc « faux », sans erreur (sonde du 2026-10-04 : `'true'` et `'false'`
stockés tous deux à faux). `graph-update-commands.ts` écrivait l'accessibilité
et le cheminement d'évacuation d'une arête en chaînes. Le studio passe par
PostgREST, qui convertit correctement, mais le chemin `applyCommands` les
aurait enregistrés à faux.

**La correction.**

- `packages/db/src/column-types.ts` lit les colonnes booléennes dans le
  schéma Drizzle déclaré, que l'essai de dérive tient d'accord avec les
  migrations.
- `applyCommands` refuse toute valeur autre qu'un booléen ou `null` pour ces
  colonnes. L'écriture entière est refusée, comme tout refus du dépôt
  (`EDIT.WRITE_REFUSED`). Aucun nouveau code d'anomalie n'est ajouté.
- `graph-update-commands.ts` écrit de vrais booléens. C'était le seul endroit
  du code qui écrivait des booléens en chaînes.

**Essais.**

- 3 unitaires dans `boolean-columns.test.ts` : la table des colonnes, le refus
  d'une chaîne (rien ne part après l'identité), le passage d'un vrai booléen.
- L'essai du panneau d'arête attend désormais de vrais booléens.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain48), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 601 |
| `test:visual` | 14 |
| `test:rls` | 90 |
| `test:determinism` | 11 |
| `test:e2e` | 172 |
| `build` | sans erreur |

## Annotation en révision (J4, R7.4)

Décisions de l'utilisateur du 2026-10-06, sur proposition (A2.2, point 2 :
J4 ne figure pas en A5) :

- le modèle tel que proposé ;
- la propriété au module 02, qui tient le tableau des messages et son circuit
  d'approbation ;
- pas de reconnaissance d'écriture : la remarque se saisit au clavier, et le
  tracé au stylet est gardé tel quel.

**Base** (migration 0073, commit à part, montée, descente et remontée
éprouvées) :

- `review_annotation` porte exactement une ancre parmi quatre clés
  étrangères : ligne du tableau, face, support, zone. Elle n'est jamais
  flottante, et la base garantit que l'entité existe.
- Trois états. Le texte, ou le tracé facultatif, ou les deux ; une annotation
  vide est refusée.
- L'auteur est pris en base.
- Un déclencheur signe la clôture (`resolved_by`, `resolved_at`) au passage à
  traitée ou refusée, et l'efface à la réouverture. Le studio ne connaît pas
  l'utilisateur, et une signature fournie par l'appelant se falsifierait.
- `review_annotation_reply` porte le fil de réponses.
- Les deux tables sont sous cloisonnement forcé.

**Studio.**

- `state/review-annotation.ts` porte les commandes et la lecture :
  - une même remarque sur une sélection crée une annotation par ligne, en un
    geste (R8) ;
  - répondre ;
  - traiter, refuser, rouvrir.
- Le panneau R7.4 est dans le détail de ligne du tableau des messages :
  - remarque au clavier, ou tracée au stylet dans un cadre qui garde la note
    rapportée au cadre ;
  - fil de réponses ;
  - actions selon la permission « annoter » de R2. R2 ne dit pas qui clôt :
    la même permission le permet.
- Un bandeau `REVIEW.ANNOTATION_OPEN` dit l'approbation bloquée tant qu'une
  annotation est ouverte. Les identifiants des annotations ouvertes sur les
  lignes du tableau sont ceux que `transitionSchedule` attend
  (`openAnnotationIds`) ; un essai montre le refus d'approbation qui en
  résulte.

**Hors des livrables.** Le contrôle `tests/j4-annotation-hors-livrable.test.ts`
vérifie deux choses :

- `SiteData` ne porte aucune annotation ;
- seuls six fichiers nommés, chacun avec sa raison, peuvent nommer les tables
  ou leur lecture.

**Essais.**

- Unitaires : 5 pour les commandes et la lecture, 5 pour le contrôle.
- En base : 4 (auteur et tracé, signature et réouverture, fil et
  cloisonnement, refus de l'annotation flottante, à deux ancres ou vide).
- De bout en bout, 3 dans `j4-annotation.spec.ts` :
  - remarque, bandeau, réponse, clôture ;
  - note au stylet ;
  - refus d'une remarque vide.

### Reste ouvert après l'annotation

- Les transitions du tableau des messages (émettre, approuver, rejeter) ne
  sont pas câblées dans l'écran : le bouton « Approuver » ne fait rien, comme
  avant ce lot. Le blocage tient dans `transitionSchedule`, que l'écran
  appellera quand R12 sera câblé.
- Les ancres sur une face, un support ou une zone sont prêtes en base et en
  commandes, mais aucun écran ne les pose encore. Le circuit des bons à tirer
  (module 04) en dépend.
- Les annotations sont relues depuis la session locale. La relecture depuis
  le dépôt viendra avec le chargement du tableau des messages lui-même, qui ne
  passe pas encore par le dépôt.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain49), sur une base remise
à zéro avec les 77 migrations :

| Étape | Résultat |
| --- | --- |
| `test` | 4 611 |
| `test:visual` | 14 |
| `test:rls` | 94 |
| `test:determinism` | 11 |
| `test:e2e` | 175 |
| `build` | sans erreur |

## Émission pour revue sans paquet de règles : refusée (R14, annexe Z nº 201)

**Le défaut.** `transitionSchedule` (`engine-graph`) laissait émettre pour
revue le tableau d'un site sans paquet de règles rattaché. Son commentaire
disait que R14 en fait « un bandeau et non un blocage ». Le cahier consolidé
dit le contraire : R14, « Aucun paquet de règles | Bandeau […] Bloque
l'émission pour revue », et l'annexe Z nº 201 consigne la correction. Le
module avait été écrit avant la consolidation.

**La correction.**

- Le contexte de transition porte `rulesPackBound`.
- Sans paquet rattaché, l'émission est refusée avec `RULES.PACK_NOT_BOUND`
  (référence R14), qui est déjà au catalogue avec la gravité bloquante.
- La génération reste possible sans paquet. R12 le dit : « possible sans
  paquet de règles rattaché, avec le bandeau ».

**Essais.** 2 de plus dans `message-schedule-state.test.ts` (refus de
l'émission, génération permise). Le cumul des causes inclut désormais le
paquet, et le contrôle « aucun code créé » liste `RULES.PACK_NOT_BOUND`.

**Chaîne A13.2.** Les neuf étapes sortent à 0 (chain50), sur une base remise
à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 613 |
| `test:visual` | 14 |
| `test:rls` | 94 |
| `test:determinism` | 11 |
| `test:e2e` | 175 |
| `build` | sans erreur |

## Parcours d'un visiteur : le parcours animé (L3.1, A7.3)

Chantier choisi par l'utilisateur le 2026-10-06 : le parcours client. Dans le
cahier, le « parcours client » au sens commercial (H3, module 03) est
l'analyse des flux, de l'incrément 5. Ce qui répond au besoin de voir le
chemin d'un visiteur sur le plan, c'est le parcours animé : INV-1, L3.1 et
A7.3 (`renderRouteAnimation`). C'est lui qui est fait.

**Moteur** (`engine-iso/src/route-animation.ts`) :

- un tronçon par niveau traversé, dans l'ordre du chemin ;
- un tracé progressif ;
- des points de décision qui apparaissent quand le tracé les atteint ;
- une marque par rôle, distincte par la forme et non par la couleur : départ
  rond évidé, arrivée carrée, décision ronde pleine, changement de niveau en
  losange ;
- un équivalent statique sans mouvement par tronçon ;
- les changements de niveau rendus à part, avec le nœud quitté et le nœud
  atteint, dont le type dit le moyen.

La durée est celle de l'animation, réglée par l'appelant et répartie au
prorata des longueurs. Aucune vitesse de marche (INV-5), aucun texte dans le
rendu (A7). Le rendu est déterministe, même avec les nœuds donnés dans un
autre ordre.

**Studio.** L'atelier du graphe a un panneau « Parcours d'un visiteur » :

- départ, arrivée, profil, puis « Tracer le parcours » ;
- le chemin est calculé par `computeRoute`, les points de décision par
  `deriveDecisionPoints` (qui ne demande plus que le graphe) ;
- lecture tronçon par tronçon, avec le niveau, la longueur, le nombre de
  points de décision, et la transition dite au changement de niveau ;
- « Rejouer », et une vue statique au choix, qui s'ouvre d'elle-même en mode
  à animation réduite.

Les profils de parcours entrent dans la session chargée du dépôt, en lecture.
Aucun profil n'est inventé : un site qui n'en déclare pas le dit, et le
parcours ne se calcule pas.

**Essais.**

- Moteur : 7 (tronçons, transition, répartition des durées, apparition des
  points de décision, marques, statique sans mouvement, absence de texte,
  déterminisme, nœud absent refusé).
- Studio : 3 (profils lus et jamais inventés, parcours sur deux niveaux, refus
  du moteur rendu tel quel).
- De bout en bout, 4 dans `l3-parcours.spec.ts` :
  - le tracé et la transition ;
  - la vue statique ;
  - l'animation réduite ;
  - un site sans profil.

**Défaut révélé, corrigé.** Le panneau a réduit la hauteur de la vue du
graphe, devenue limitée par sa hauteur. La capture du trait convertissait les
coordonnées d'écran par le seul rapport des largeurs, et ignorait donc le
décalage du centrage : un trait tracé d'un nœud à l'autre tombait à côté. La
première chaîne (chain51) l'a montré :

- `test` : 1 échec, une couleur en dur dans l'essai du moteur ;
- `test:e2e` : 2 échecs, les arêtes tracées au stylet.

La capture passe désormais par la matrice d'écran du SVG (`getScreenCTM`), et
l'essai n'écrit plus de couleur en dur.

### Reste ouvert après le parcours animé

- Le parcours n'est montré qu'en plan, dans l'atelier. La borne (P5.5) et la
  vue isométrique ne s'en servent pas encore.
- Les étapes écrites (P5.5) existent dans la borne
  (`kiosk-runtime/wayfinding-session.ts`) mais ne sont pas reprises dans
  l'atelier. *Faites depuis : voir la section « Étapes écrites ».*
- L'analyse commerciale des flux (H3) reste de l'incrément 5.

**Chaîne A13.2.** Après correction, les neuf étapes sortent à 0 (chain52),
sur une base remise à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 623 |
| `test:visual` | 14 |
| `test:rls` | 94 |
| `test:determinism` | 11 |
| `test:e2e` | 179 |
| `build` | sans erreur |

## Étapes écrites d'un itinéraire, sous forme neutre (partie P, écran Itinéraire)

« Étapes écrites, courtes, dans la langue active. Changement de niveau
signalé explicitement, avec le moyen. »

**Ce qui existait.** La borne (`kiosk-runtime/wayfinding-session.ts`) tirait
les étapes du chemin avec ses phrases françaises et anglaises écrites dans le
code. La règle n'était donc pas partageable, et l'atelier aurait dû la
recopier.

**Ce qui change.**

- La règle passe dans le moteur de graphe : `routeSteps(graph, route)`. Elle
  ne produit aucune phrase (A7) :
  - une étape par nœud du chemin, avec un code (`from`, `take_elevator`,
    `take_stairs`, `take_escalator`, `pass_by`, `arrival`,
    `continue_towards`, `go_through`, `continue_for`) et ses paramètres ;
  - les carrefours et paliers consécutifs d'un même niveau réunis en un
    « continuer tout droit » qui porte la distance ;
  - la distance totale et le nombre de changements de niveau.
- La borne y met ses mots, à l'identique : ses 84 essais passent sans
  changement.
- L'atelier du graphe les dit dans la langue active, sous le parcours animé.

**Essais.** 3 pour `routeSteps` (codes sans phrase, réunion avec distance,
changement de niveau et distance totale). L'essai de bout en bout du parcours
vérifie les cinq étapes affichées.

**Chaîne A13.2, premier passage (chain53) : deux échecs.**

- `test` : le contrôle des citations refusait « P5.5 ». Le jeton est ambigu,
  et le contrôle n'accepte en qualificatif que les parties M, N, L et R. Les
  citations nomment désormais « partie P, écran Itinéraire » ; le contrôle
  n'est pas assoupli.
- `test:e2e` : l'essai du bouton du milieu (E3.3) mesurait le contour avant
  que la zone ne se recadre sur sa largeur réelle. Il trouvait 112 px pour 60.
  C'est une course de l'essai, apparue sous la charge de la chaîne complète :
  seul, il passe cinq fois sur cinq. Les trois essais de navigation attendent
  désormais deux mesures égales avant de partir, et douze répétitions sur
  quatre processus passent.

**Chaîne A13.2.** Après correction, les neuf étapes sortent à 0 (chain54),
sur une base remise à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 626 |
| `test:visual` | 14 |
| `test:rls` | 94 |
| `test:determinism` | 11 |
| `test:e2e` | 179 |
| `build` | sans erreur |

## Itinéraire sur le plan orienté de la borne (partie P, écran Itinéraire ; D10.3, D6.2)

Périmètre choisi par Oss53pa : le calcul seul, sans écran. La borne n'a pas
encore d'application (`index.html`, `app.js`) : le socle des écrans du totem
est l'élément « Socle d'orientation, écrans P5 » de la section P15, incrément
3, taille L, et n'est pas entrepris ici.

- La rotation de D6.2 passe dans `core-model` : `orientationDegForAzimuth`
  et `orientForDisplay`. Le plan mural (`renderOrientedPlan`) et
  l'itinéraire de la borne font le même calcul. `engine-layout` réexporte
  `orientationDegForAzimuth`, son API ne change pas.
- Le composeur du parcours animé (`renderRouteAnimation`) quitte
  `engine-iso` pour `engine-graph`. Il ne résout aucune fonction de
  pictogramme (A5.8), et la borne, qui ne dépend d'aucun moteur de rendu,
  peut l'employer. Il prend une orientation facultative : sans elle, le plan
  est nord en haut, à l'octet près comme avant ; avec elle, le plan est tourné
  selon D6.2 autour de la position de l'usager.
- La borne gagne `orientedItinerary(site, borne, profil, chemin, options)` :
  le tracé animé sur son plan orienté, depuis son nœud et son azimut (D10.3),
  un tronçon par niveau, les points de décision mis en évidence, et
  l'équivalent statique de chaque tronçon. Une borne placée sur un nœud
  inconnu est refusée par `DATA.KIOSK_CONFIG_INVALID`.
- L'atelier du graphe lit le composeur dans `engine-graph` et ne dépend plus
  d'`engine-iso`.
- Le commentaire de l'essai A5.8 de la borne disait que tout ce qui se dessine
  sur une borne est composé à la construction du paquet. Il dit maintenant que
  c'est vrai de ce qui porte un pictogramme, et que le tracé, lui, se compose à
  l'exécution. Les assertions de l'essai ne changent pas : la borne ne dépend
  toujours ni d'`engine-iso`, ni d'`engine-layout`, ni des règles.

**Décision prise.** Tous les tronçons d'un itinéraire sont tournés de
l'azimut de la borne, y compris ceux des autres niveaux. Le visiteur garde le
même repère d'un niveau à l'autre. Le cahier des charges ne dit rien de
l'orientation d'un niveau où la borne n'est pas.

**Essais.**

- `engine-graph`, 3 : le test décisif de D6.4 sur le tracé (tourné vers
  l'est, le point situé à l'est est plus haut ; tourné vers l'ouest, il est
  plus bas) ; nord en haut et est à droite sans orientation ; orientation
  d'azimut nul identique à l'octet au plan nord en haut.
- `kiosk-runtime`, 5 : D6.4 sur un itinéraire du site de référence
  multiniveau (la destination devant la borne est dans la moitié haute,
  derrière elle dans la basse) ; départ à la borne et équivalent statique
  sans animation ; points de décision marqués ; déterminisme ; nœud inconnu
  refusé.
- Essai par mutation : l'azimut passé brut, sans `orientationDegForAzimuth`,
  fait échouer l'essai D6.4 de la borne.
- Le rendu nord en haut a été comparé à l'octet avec l'ancien composeur
  d'`engine-iso`, sur une scène à coordonnées non entières.

### Reste ouvert après l'itinéraire de la borne

- Les écrans du totem (P5) : attente, accueil, recherche, fiche, itinéraire,
  mode accessible. C'est le socle de l'incrément 3.
- Le code à scanner pour emporter l'itinéraire, élément « Passage au
  téléphone » de la section P15.
- La vue en plan simplifié à la place de l'isométrie, en mode accessible (P5.6) :
  le tracé est déjà en vue de dessus. Rien n'est à faire tant que l'écran
  n'existe pas.

**Chaîne A13.2 (chain55).** Les neuf étapes sortent à 0 au premier passage,
sur une base remise à zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 634 |
| `test:visual` | 14 |
| `test:rls` | 94 |
| `test:determinism` | 11 |
| `test:e2e` | 179 |
| `build` | sans erreur |

## Circuit de validation du tableau des messages : émission pour revue et décisions (R12, H11)

Périmètre choisi par Oss53pa : brancher l'émission pour revue, créer la table des
décisions et ses commandes. Les boutons Approuver et Rejeter restent absents. Le
studio n'a pas d'authentification, et le rôle de sa session, `designer`, n'a pas
le droit d'approuver (R2 : « celui qui génère ne peut pas approuver »). Une
décision sans approbateur réel n'aurait pas de sens.

- **Migration 0074**, dans un commit à part. Elle crée `message_schedule_approval`,
  telle que H11 la définit. Elle est additive : aucune ligne existante n'est
  touchée.
  - Insertion seule, avec les quatre verrous d'A12.3.
  - Clés en `RESTRICT` : une décision ne disparaît ni avec le site ni avec le
    tableau qu'elle juge.
  - Le rejet exige un motif non blanc.
  - L'approbateur et la date sont pris en base. La politique d'insertion refuse
    un `user_id` qui ne serait pas celui de la session.
  - Aller, retour, aller passent sur `azimut_ci`.
- **Enregistrement de la table.** Elle est déclarée au schéma drizzle et
  attribuée au module 02 (L3). Elle entre dans la liste des tables en insertion
  seule du retrait des décors d'essai. L'essai A12.3 la couvre désormais : sa
  liste d'attente est vide.
- **Commandes de transition.** Émettre pour revue, rejeter et approuver passent
  tous par la machine de R12 (`transitionSchedule`), dont les refus sont rendus
  tels quels.
  - Chaque transition est un seul geste.
  - Le rejet et l'approbation écrivent leur décision dans
    `message_schedule_approval`, jamais dans `approval`.
  - L'approbation fait passer la version approuvée précédente à `superseded`.
- **« Émettre pour revue » à l'écran.** Les conditions sont lues dans la session :
  - les anomalies de R14 qui bloquent l'émission : niveau d'information,
    continuité (H2.4), nommage (H2.2) dans chaque langue active ;
  - le dernier passage de validation du site, réussi et portant l'empreinte du
    graphe actuel (M02.W11) ;
  - le rattachement d'un paquet de règles.

  Un refus est affiché avec ses codes. La transition s'enregistre sans
  annulation possible, puisque R12 ne ramène une version en revue au brouillon
  que par un rejet motivé.
- **Prérequis de M02.W11.** Le bandeau n'est plus affiché d'office : il se lit
  dans les passages de validation enregistrés.
- **Hors ligne (R16).** Générer, émettre et approuver sont retirés, et l'écran
  le dit.
- **Annuaire.** Les destinations et leurs noms entrent dans la session, en
  lecture, comme les profils de parcours.

**Décisions prises.**

- Le plafond de destinations par face n'est pas recontrôlé à l'émission. R14 en
  fait le déclencheur de l'écartement, appliqué à la génération et tracé ligne
  par ligne (M02.W9).
- La politique d'insertion exige que l'approbateur soit l'utilisateur de la
  session. Elle n'exige pas son rôle : aucune table du schéma ne juge encore un
  rôle en base, et le relecteur externe (O7) n'a pas de modèle.

**Essais.**

- Base : 5 essais.
  - L'approbateur et la date sont pris en base.
  - Un rejet sans motif est refusé.
  - Une décision hors de H11, ou sans empreinte, est refusée.
  - Un approbateur forgé est refusé sous le rôle applicatif.
  - Une décision ne se modifie pas, et le tableau qu'elle juge ne se supprime
    pas sous elle.

  L'essai A12.3 couvre la table.
- Commandes : 7 essais.
- Conditions : 8 essais. Ils portent sur la validation (absente, réussie, pour
  un autre graphe, échec postérieur), la collision de nommage, le niveau
  d'information et l'assemblage des conditions.
- Bout en bout : 2 essais.
  - Le refus est dit avec ses codes, sans changement d'état.
  - Les prérequis remplis, la version passe en revue, l'action disparaît, et
    ni Approuver ni Rejeter n'apparaissent.

  Le premier passage du second essai a été refusé pour continuité rompue :
  l'essai annonçait des destinations que rien n'atteignait. Le refus était
  juste, et c'est le décor de l'essai qui a été corrigé.

### Reste ouvert après l'émission pour revue

- Approuver et rejeter à l'écran : il faut un approbateur authentifié (A6). La
  confirmation de M7 règle 9 et la saisie du motif de rejet viendront avec eux.
- La session ne recharge depuis la base ni les tableaux, ni les passages de
  validation, ni les décisions. Hors du stockage local, l'écran est dans l'état
  vide de R16.
- La validation du graphe (écran M5) ne lit toujours pas l'annuaire de la
  session. Ses contrôles de destination ne lèvent donc rien, comme avant.
- Un essai de bout en bout des commandes de décision contre la base est à
  écrire. Une décision écrite ne se supprime pas, si bien qu'un tel essai
  laisserait ses lignes : il demande un décor qui ne soit jamais retiré.

**Chaîne A13.2, premier passage (chain56) : `test` refusé, deux contrôles.**

- Le contrôle des citations a refusé « R2 » seul, en deux endroits. Le jeton
  est ambigu ; il est désormais cité « R2 (partie R) ».
- Le contrôle des branchements a refusé `submissionFindings` : la fonction
  était exportée, mais seul son essai l'appelait. Elle n'est plus exportée, et
  l'essai passe par `submissionConditions`.

Aucun des deux contrôles n'a été assoupli. La chaîne a été arrêtée, puis
relancée entière.

**Chaîne A13.2 (chain57).** Les neuf étapes sortent à 0, sur une base remise à
zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 649 |
| `test:visual` | 14 |
| `test:rls` | 99 |
| `test:determinism` | 11 |
| `test:e2e` | 181 |
| `build` | sans erreur |

## Rechargement du circuit du tableau des messages depuis la base (R12, E5.4)

Chantier choisi par Oss53pa. Avant lui, la session ne portait que ce que l'écran
avait écrit lui-même. Hors du stockage local, l'écran du tableau était dans
l'état vide de R16, et l'émission pour revue ne voyait aucun passage de
validation enregistré. L'écran du tableau ne relisait d'ailleurs rien du dépôt.

- **Lecture dans le dépôt.** Le dépôt gagne `loadScheduleRecords(siteId)`. Par
  l'API REST, il lit les versions et les passages de validation du site, puis
  les lignes et les décisions de ces versions. Le dépôt de référence rend des
  listes vides, et refuse un site inconnu.
- **Chargeur commun.** Un même chargeur, `loadSiteSession`, sert l'atelier et
  l'écran du tableau. L'atelier seul y ajoute son esquisse : J3.3 la réserve à
  l'atelier, et le garde-fou de J3.3 a refusé un premier chargeur qui la lisait
  pour les deux. La liste de ce garde-fou n'a pas été touchée.
- **Lecture des lignes.** Elle accepte les colonnes `jsonb` (`content`,
  `exclusion_reason`) sous les deux formes : le texte que le chemin d'écriture
  pose dans la session, et l'objet que la base rend.
- **Dernier passage de validation.** Il se juge à l'instant, et non au texte de
  l'horodatage : la base écrit `+00:00`, la session écrit `Z`.

**Essais.**

- Dépôt : 4 essais.
  - Le dépôt de référence rend des listes vides.
  - Un site inconnu est refusé.
  - Les tables sont lues avec leurs filtres de site et de version.
  - Sans version, ni lignes ni décisions ne sont demandées.
- Session : 4 essais.
  - Un tableau relu, aux colonnes en objets, se lit avec son écartement.
  - Les décisions entrent dans la session.
  - Un passage relu vaut pour le graphe actuel.
  - Un passage plus récent l'emporte, malgré les deux écritures de l'instant.

**Non vérifié.** La lecture contre un PostgREST réel n'a pas d'essai : le dépôt
n'est éprouvé qu'avec un `fetch` simulé. Un tel essai laisserait en base des
lignes en insertion seule (décisions, passages de validation) qu'aucun retrait
ne peut ôter.

**Constaté, non traité.**

- `apps/studio/src/data/postgrest-repository.ts` dépassait déjà 400 lignes ; il
  en gagne quatre.
- Les annotations de révision (J4) ne se relisent toujours pas depuis la base.
- La version approuvée ne montre pas encore son bandeau d'approbateur et de
  date (R16).

**Chaîne A13.2 (chain58).** Les neuf étapes sortent à 0, sur une base remise à
zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 657 |
| `test:visual` | 14 |
| `test:rls` | 99 |
| `test:determinism` | 11 |
| `test:e2e` | 181 |
| `build` | sans erreur |

## Annotations de révision relues depuis la base (J4, R12)

Chantier choisi par Oss53pa. Avant lui, les annotations de révision se
perdaient à la réouverture d'un site, alors qu'une annotation ouverte bloque
l'approbation (`REVIEW.ANNOTATION_OPEN`).

- Le circuit du tableau relu depuis la base porte désormais les annotations du
  site et leur fil. Ni les annotations supprimées ni les réponses supprimées
  ne sont relues : la suppression est logique.
- Une annotation ouverte relue bloque l'approbation, comme une annotation posée
  dans la session. Son tracé au stylet, que la base rend sous forme de tableau,
  se relit tel quel.
- Le fil se trie à l'instant, et non au texte de l'horodatage. Une réponse
  écrite dans la session après une réponse relue vient bien après elle.
- Deux fichiers nomment désormais les tables d'annotation : le chargeur REST
  du circuit et la session relue du dépôt. Le contrôle J4 les inscrit, chacun
  avec sa raison, comme le contrôle J3.3 le fait pour l'esquisse. Ses
  assertions ne changent pas : `SiteData` ne porte aucune annotation, et aucun
  moteur, compilateur ni export ne les nomme.

**Essais.**

- Dépôt : la lecture des annotations est filtrée par site et sans les
  supprimées, la réponse supprimée est écartée, et sans annotation aucune
  réponse n'est demandée.
- Session : 2 essais.
  - L'annotation relue garde son tracé et son fil, et bloque l'approbation.
  - Le fil mêle correctement les deux écritures de l'instant.

**Non vérifié.** Comme pour le reste du circuit, la lecture contre un PostgREST
réel n'a pas d'essai.

**Chaîne A13.2 (chain59).** Les neuf étapes sortent à 0, sur une base remise à
zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 659 |
| `test:visual` | 14 |
| `test:rls` | 99 |
| `test:determinism` | 11 |
| `test:e2e` | 181 |
| `build` | sans erreur |

## Bandeau de version approuvée (R16)

Chantier choisi par Oss53pa. R16 : « Version approuvée | Bandeau d'état
indiquant l'approbateur et la date. Aucune action de génération sur cette
version. »

- La décision qui approuve la version affichée se lit dans les décisions
  relues de la base : c'est la dernière décision `approved` de ce tableau,
  jugée à l'instant.
- Le bandeau dit la date, et l'approbateur par son identifiant : les huit
  premiers caractères, puis la valeur complète à côté, comme pour l'empreinte
  des entrées (R4).
- Le modèle ne porte aucun nom d'utilisateur (A5.1). Une note à l'éditeur le
  signale (`docs/note-editeur-nom-approbateur.md`) ; rien n'est ajouté au
  modèle. Choix de l'utilisatrice, au titre de A2.2.
- Si aucune décision n'est lue, le bandeau le dit au lieu d'inventer un
  approbateur.
- Aucune action de génération n'est offerte sur une version approuvée : la
  machine de R12 n'en permet aucune depuis cet état.

**Essais.**

- Lecture de la décision : 3 essais.
  - Sans décision, rien n'est inventé.
  - Un rejet, ou la décision d'une autre version, ne compte pas.
  - C'est la dernière approbation qui compte, jugée à l'instant.
- Bout en bout : 2 essais.
  - Le bandeau donne l'identifiant et la date, et n'offre aucune action de
    génération, d'émission ni de décision.
  - Sans décision lue, le bandeau le dit.

**Chaîne A13.2 (chain60).** Les neuf étapes sortent à 0, sur une base remise à
zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 662 |
| `test:visual` | 14 |
| `test:rls` | 99 |
| `test:determinism` | 11 |
| `test:e2e` | 183 |
| `build` | sans erreur |

## Aperçu du parcours : le calcul des points de décision n'est plus tu (L3.1)

Chantier choisi par Oss53pa. L'aperçu du parcours, dans l'atelier du graphe,
taisait deux choses :

- un refus du calcul des points de décision, qu'il traitait comme un parcours
  sans point de décision ;
- les avertissements d'un tracé réussi, que l'écran effaçait.

La borne, elle, rendait déjà le refus.

- Un refus arrête le tracé et se dit avec ses codes.
- Les avertissements accompagnent le tracé, chacun avec sa sévérité.

Le moteur ne lève aujourd'hui ni refus ni avertissement sur ce calcul. Le
défaut était donc latent ; l'essai simule les deux cas pour que l'aperçu les
dise déjà le jour où le moteur en lèvera.

**Essais.** 2 nouveaux essais : un refus arrête le tracé, un avertissement
l'accompagne. L'essai par mutation le confirme : sur l'ancien code, les deux
échouent.

**Chaîne A13.2 (chain61).** Les neuf étapes sortent à 0, sur une base remise à
zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 664 |
| `test:visual` | 14 |
| `test:rls` | 99 |
| `test:determinism` | 11 |
| `test:e2e` | 183 |
| `build` | sans erreur |

## La validation du graphe lit l'annuaire de la session (M5)

Chantier choisi par Oss53pa. Jusqu'ici, la portée de la validation laissait
l'annuaire vide (« l'annuaire entre avec le module 02 »). Ses contrôles de
destination ne levaient donc rien, même sur un site qui en déclarait. La
session porte désormais l'annuaire relu du dépôt, et ces contrôles
s'appliquent :

- destination reliée à un nœud absent (`GRAPH.DESTINATION_UNLINKED`) ;
- destination inatteignable depuis une entrée ;
- nom manquant dans une langue.

Comportement de la lecture :

- Une ligne d'annuaire illisible est écartée et comptée, jamais complétée.
  Elle s'affiche comme toute ligne illisible de la session.
- Une session sans annuaire n'en invente aucun.
- L'émission pour revue lit la même portée au lieu d'une lecture à part.

Le résultat de la validation peut donc changer : un site déclaré « sans
anomalie » peut maintenant en montrer, si son annuaire en porte.

**Essais.** 4 essais de portée.

- L'annuaire du site est rendu tel quel.
- La validation lève `GRAPH.DESTINATION_UNLINKED` sur une destination dont le
  nœud manque.
- Rien n'est inventé sans annuaire.
- Une destination illisible est écartée et comptée.

L'ancien essai, qui exigeait une portée sans destination, est remplacé par ces
quatre.

**Non traité.** Les profils de parcours, que la session porte aussi, n'entrent
pas dans la portée. Le contrôle de couverture des entrées
(`GRAPH.DESTINATION_ENTRANCE_COVERAGE`) n'est donc toujours pas exercé dans
l'atelier.

**Chaîne A13.2, premiers passages : deux refus.**

- chain62, `test` : le contrôle des citations a refusé « M5 » seul, en trois
  commentaires. Le jeton est désormais cité « M5 (partie M) ».
- chain63, `test:e2e` : l'essai d'émission R12 était refusé pour continuité
  rompue. Son décor ne donnait aux destinations que leur nœud et leur nom. La
  nouvelle lecture les jugeait illisibles et les écartait : c'était la
  conséquence attendue du chantier, révélée par un décor irréaliste. Le décor
  porte maintenant les colonnes requises, comme en base.

Aucun contrôle et aucune lecture n'ont été assouplis. La chaîne a été relancée
entière après chaque correction.

**Chaîne A13.2 (chain64).** Les neuf étapes sortent à 0, sur une base remise à
zéro :

| Étape | Résultat |
| --- | --- |
| `test` | 4 667 |
| `test:visual` | 14 |
| `test:rls` | 99 |
| `test:determinism` | 11 |
| `test:e2e` | 183 |
| `build` | sans erreur |
