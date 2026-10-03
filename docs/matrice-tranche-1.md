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
