# Azimut — matrice de traçabilité, écart, plan

Remis pour accord avant toute ligne de code, conformément aux sections 3, 4 et 5 de la consigne.

Référence : les quatorze documents joints, et eux seuls. Toute note antérieure a été revérifiée contre eux ; ce qui ne s'y retrouve pas est signalé au chapitre 4 comme invention à retirer.

---

## 0. Lecture faite, et préséance appliquée

| Document | Lignes | Lu |
| --- | --- | --- |
| `CDC_Azimut.md` (parties A, B, C) | 1087 | entier |
| `CDC_Azimut_Complement.md` (partie D) | 678 | entier |
| `CDC_Azimut_Partie_E_Edition.md` | 473 | entier |
| `CDC_Azimut_Partie_F_Interface.md` | 548 | entier |
| `CDC_Azimut_Partie_G_Points_Ouverts.md` | 369 | entier |
| `CDC_Azimut_Partie_H_Modules.md` | 380 | entier |
| `CDC_Azimut_Partie_I_Atelier.md` | 264 | entier |
| `CDC_Azimut_Partie_J_Stylet.md` | 274 | entier |
| `CDC_Azimut_Partie_K_Registre.md` | 238 | entier |
| `CDC_Azimut_Partie_L_Modules_Integration.md` | 319 | entier |
| `CDC_Azimut_Partie_M_Ecrans.md` | 416 | entier |
| `CDC_Azimut_Partie_N1_Modules_01_04.md` | 423 | entier |
| `CDC_Azimut_Partie_N2_Modules_05_12.md` | 328 | entier |
| `T-2.14a_consigne.md` | 170 | entier |
| **Total** | **5 967** | |

Préséance retenue : partie A souveraine pour les invariants (A1.2) et les règles de conduite (A2) ; parties D à N de même rang entre elles, le plus récent tranchant lorsqu'il le dit ; partie K seule liste de points ouverts ; partie L prioritaire sur A5.6 pour la propriété de `support`.

**Fait notable.** La partie M est dans le dossier. Le `CLAUDE.md` du dépôt la déclare absente et en tire une consigne d'arrêt avant toute spécification d'écran. Cette consigne est caduque : les cinq écrans de la tranche 1 sont spécifiés au champ près, M7 est lisible, M8 est lisible.

---

## 1. Matrice de traçabilité

Règle d'établissement, reprise de la section 3 de la consigne : **une exigence sans preuve par un test qui la nomme est « absente », même si du code semble la couvrir.** La colonne « preuve » ne porte donc que des tests qui citent la règle. Les tests dont le jeton coïncide avec une section d'une autre partie (`A5` pour A5.6, `E5` pour la partie E, `G5` pour G5.2, `F2` pour F2.2, `P1`/`P5`/`M2` pour le complément atelier) ont été écartés un par un : ils ne prouvent pas la règle de module homonyme.

### 1.1 Invariants (A1.2)

| Exigence | État | Preuve |
| --- | --- | --- |
| INV-1 source unique, rendus dérivés | partiel | `apps/kiosk-runtime/src/__tests__/autonomy.test.ts`, `apps/compiler/src/__tests__/build-delivery-archive.test.ts` |
| INV-2 un panneau est une vue, pas un dessin | partiel | `packages/engine-graph/src/__tests__/resolve-face.test.ts` |
| INV-3 registre de sécurité cloisonné | partiel | `packages/engine-graph/src/__tests__/guard-safety.test.ts`, `validate-library.test.ts` |
| INV-4 rendu déterministe | fait | 48 fichiers de test le nomment, dont `tests/determinism.test.ts` |
| INV-5 aucune valeur réglementaire dans le code | partiel | `packages/rules/src/__tests__/loader-guard.test.ts`, `apps/compiler/src/__tests__/required-face-format.test.ts` (aucun test ne nomme l'invariant, deux en énoncent la substance) |

Les quatre « partiel » le sont pour la même raison : l'invariant est vérifié sur un chemin, pas sur les voies de contournement. INV-3 en particulier n'a pas le test par voie de contournement que N4.7 critère 3 exige explicitement.

### 1.2 Module 01, socle du site — règles S (N1.3)

| Règle | Objet | État | Preuve |
| --- | --- | --- | --- |
| S1 | repère site fixé au premier calage, immuable | fait | `packages/core-model/src/__tests__/site-origin.test.ts`, `packages/engine-graph/src/__tests__/site-origin-coherent.test.ts`, `packages/testkit/src/__tests__/sites.test.ts` |
| S2 | aucune coordonnée en pixels en base | absent | aucun test ne nomme S2 |
| S3 | toute cellule porte un code d'unité | fait | `packages/engine-graph/src/__tests__/unit-code.test.ts` |
| S4 | — | absent | aucun test ne nomme S4 |
| S5 | — | absent | aucun test ne nomme S5 |
| S6 | longueur d'arête calculée, jamais saisie | fait | `packages/testkit/src/__tests__/edge-length.test.ts` |
| S7 | — | absent | aucun test ne nomme S7 |
| S8 | — | absent | aucun test ne nomme S8 |
| S9 | — | absent | aucun test ne nomme S9 |

**3 sur 9.**

### 1.3 Module 02, wayfinding — règles W (N2.3)

| Règle | Objet | État | Preuve |
| --- | --- | --- | --- |
| W1 | — | absent | — |
| W2 | — | absent | — |
| W3 | tout support porte au moins un niveau d'information | absent | — |
| W4 | toute ligne référence son point de décision | fait | `packages/engine-graph/src/__tests__/message-schedule.test.ts` |
| W5 | continuité du message | absent | — |
| W6 | tableau généré, jamais saisi | absent | — |
| W7 | tableau versionné et validé comme un BAT | absent | — |
| W8 | péremption des seules lignes concernées | absent | — |
| W9 | plafond de destinations par face | bloqué | valeur du paquet de règles ; N2.8 le dit ouvert, K3.1 « corpus réglementaire ERP », niveau P |
| W10 | aucun taux publié tant que la complétude échoue | fait | `packages/engine-graph/src/__tests__/audit.test.ts` |

**2 sur 10, une bloquée.**

### 1.4 Module 03, parcours clients — règles P (N3.2)

| Règle | Objet | État | Preuve |
| --- | --- | --- | --- |
| P1 | pondérations déclarées, jamais devinées | absent | — |
| P2 | exposition = parcours pondérés | absent | — |
| P3 | indice relatif et rang, jamais une valeur absolue | fait | `packages/engine-graph/src/__tests__/correlation.test.ts` |
| P4 | jamais d'export sans les hypothèses | absent | — |
| P5 | montants seulement au-delà du seuil de corrélation | fait | `packages/engine-graph/src/__tests__/correlation.test.ts` |
| P6 | origine et date des données réelles conservées | fait | `packages/engine-graph/src/__tests__/correlation.test.ts` |
| P7 | comparaison entre deux états du même site | absent | — |

**3 sur 7.** Attention au jeton : `P1` est aussi un principe du complément atelier, employé sous la forme `atelier-P1` dans `audit-parking.ts`. Aucun test ne prouve le `P1` de N3.2.

### 1.5 Module 04, signalétique — règles G (N4.3)

| Règle | Objet | État | Preuve |
| --- | --- | --- | --- |
| G1 | un bloc `resolved` référence une `message_line` | absent | `composeFace` ne consomme pas `message_line` ; T-2.14a §7 l'interdit explicitement pour l'instant |
| G2 | seul un bloc `free` porte un texte saisi | absent | — |
| G3 | format calculé depuis contenu, distance, variante la plus longue | fait | `apps/compiler/src/__tests__/required-face-format.test.ts` |
| G4 | aucune valeur normative dans le code | absent | l'exigence est couverte par INV-5, pas par un test nommant G4 |
| G5 | registre de sécurité verrouillé, le moteur refuse | absent | couvert de fait par `guard-safety.test.ts`, qui nomme INV-3 et non G5 ; le test par voie de contournement manque |
| G6 | un plan mural est une famille de fichiers, un par implantation | absent | — |
| G7 | une version approuvée est immuable | fait | `packages/core-model/src/__tests__/support-version-state.test.ts`, `packages/engine-graph/src/__tests__/approved-version-immutable.test.ts` |
| G8 | un contrôle bloquant empêche l'épreuve, sans dérogation | absent | — |
| G9 | rendu déterministe | partiel | couvert par INV-4, aucun test ne nomme G9 |
| G10 | plans d'évacuation, livrable nommé | absent | — |

**2 sur 10.**

### 1.6 Module 05, régie publicitaire — règles R (N5.2)

| Règle | Objet | État | Preuve |
| --- | --- | --- | --- |
| R1 | un emplacement publicitaire n'est pas un support | absent | jeton en collision avec R1 de L1 |
| R2 | tarification indexée sur l'exposition du module 03 | absent | — |
| R3 | une option expire seule | absent | — |
| R4 | pas de double réservation sur périodes recoupées | absent | — |
| R5 | tout visuel est assaini avant stockage | fait | `apps/studio/src/domain/__tests__/ad-creative-intake.test.ts`, `apps/studio/src/views/advertising/__tests__/module-05-wiring.test.ts` |
| R6 | contrôles techniques automatiques, contrôles de fond humains | fait | `apps/studio/src/domain/__tests__/ad-creative-intake.test.ts` |
| R7 | paquet de règles publicitaires enfichable, refusé sans référence | fait | `apps/studio/src/views/advertising/__tests__/module-05-wiring.test.ts` |
| R8 | rendu en situation, mention d'aperçu | absent | — |
| R9 | une facture naît d'une décision humaine | absent | N5.6 critère 4 exige un test dédié ; il n'existe pas |

**3 sur 9.**

### 1.7 Modules 06 à 12 — règles T, C, E, B, F, X, A

| Module | Règles | État | Preuve |
| --- | --- | --- | --- |
| 06 enseignes locataires | T1 à T5 | absent (5) | aucun test ne nomme une règle T |
| 07 chantier et pose | C1 à C5 | absent (5) | aucun test ne nomme une règle C |
| 08 exploitation | E1 à E5 | absent (5) | les occurrences de `E1`…`E5` dans les tests désignent la partie E |
| 09 budget | B1 à B5 | absent (5) | aucun test ne nomme une règle B |
| 10 portefeuille | F1 à F4 | absent (4) | les occurrences de `F1`…`F4` désignent la partie F |
| 11 transverse | X1 à X5 | absent (5) | aucun test ne nomme une règle X |
| 12 atelier | A1 à A9 | absent (9) | les occurrences de `A1`…`A9` désignent A1.2, A2.4, A5.6 |

**0 sur 38.**

### 1.8 Récapitulatif des 88 règles de module

| Module | Règles | Prouvées | Bloquées | Absentes |
| --- | --- | --- | --- | --- |
| 01 socle | 9 | 3 | 0 | 6 |
| 02 wayfinding | 10 | 2 | 1 | 7 |
| 03 parcours | 7 | 3 | 0 | 4 |
| 04 signalétique | 10 | 2 | 0 | 8 |
| 05 régie | 9 | 3 | 0 | 6 |
| 06 à 12 | 38 | 0 | 0 | 38 |
| **Total** | **88** | **13** | **1** | **74** |

### 1.9 Règles d'écran M7

Onze règles auxquelles tout écran construit ensuite se conforme.

| Règle | Objet | État | Preuve |
| --- | --- | --- | --- |
| M7.1 | les six états sont traités | absent | aucune des 24 vues ne traite l'état hors ligne |
| M7.2 | toute valeur saisissable au pointeur l'est au clavier, en numérique, dans le panneau | absent | — |
| M7.3 | toute valeur calculée est en lecture seule et se voit comme calculée | absent | — |
| M7.4 | tout champ dimensionnel affiche son unité | absent | — |
| M7.5 | un refus de saisie n'efface jamais le travail en cours | absent | — |
| M7.6 | une anomalie porte son entité, un lien, sa référence normative | absent | — |
| M7.7 | aucune information portée par la seule couleur | absent | — |
| M7.8 | focus distinct de sélection | absent | — |
| M7.9 | une action irréversible demande une confirmation qui nomme la conséquence | absent | — |
| M7.10 | l'accent ne signale que ce que le logiciel a calculé | absent | — |
| M7.11 | aucun résultat vide présenté comme un succès sans calcul | absent | — |

**0 sur 11.** Aucun test du dépôt ne contient le jeton `M7`.

### 1.10 Critères d'acceptation des cinq écrans de la partie M

| Écran | Critères | État |
| --- | --- | --- |
| M1 liste des sites | création, unicité du nom, pays et langues requis | absent — l'écran lit, ne crée pas |
| M2 import et calage | 5 critères (1 % d'erreur, rejouabilité, aucun pixel en base, clavier seul, confirmation nommée) | absent — 0 sur 5 |
| M3 tracé des empreintes | 4 critères | absent — 0 sur 4 |
| M4 saisie du graphe | 4 critères | absent — 0 sur 4 |
| M5 validation de complétude | états dont « jamais lancé » | partiel — la validation existe côté moteur, l'écran ne distingue pas « jamais lancé » de « aucune anomalie » |

### 1.11 Critères d'acceptation de la tranche entière (M8)

| Critère | État |
| --- | --- |
| 1. parcours complet site vide → validation, sans aide | absent — aucun chemin d'écriture, le parcours est impossible |
| 2. le même parcours au clavier seul | absent |
| 3. le même parcours hors ligne, avec synchronisation | absent |
| 4. temps du parcours mesuré et consigné | absent |
| 5. conformité AA vérifiée automatiquement sur les cinq écrans | absent — aucun outil d'audit automatisé au dépôt |
| 6. aucune couleur en dur, aucun espacement hors échelle, aucune chaîne dans un composant | fait — `packages/design-tokens/src/__tests__/no-hardcoded-colors.test.ts`, `spacing-scale.test.ts`, `apps/studio/src/i18n/__tests__/no-hardcoded-strings.test.ts` |

**1 sur 6.**

### 1.12 Critères d'acceptation des modules (N1.7 à N12.3)

| Module | Critères | Prouvés |
| --- | --- | --- |
| 01 (N1.7) | 5 | 0 — aucun ne se rejoue, faute de saisie |
| 02 (N2.7) | 5 | 1 (le 2, péremption au compte exact, par `message-schedule.test.ts`) |
| 03 (N3.6) | 4 | 2 (déterminisme, refus du montant sous le seuil) |
| 04 (N4.7) | 5 | 1 (le 2, déterminisme octet pour octet) |
| 05 (N5.6) | 5 | 2 (le 2 et le 3, par `ad-creative-intake.test.ts`) |
| 06 (N6.6) | 3 | 0 |
| 07 (N7.6) | 4 | 0 |
| 08 (N8.6) | 4 | 0 |
| 09 (N9.6) | 3 | 0 |
| 10 (N10.4) | 2 | 0 |
| 11 (N11.3) | 3 | 0 |
| 12 (N12.3) | 4 | 0 |
| **Total** | **47** | **6** |

### 1.13 Critères d'acceptation de la tâche T-2.14a

| Critère | État |
| --- | --- |
| 1. déterminisme de la sérialisation et de l'empreinte | fait — `tests/determinism.test.ts`, `tests/content-hash-peremption.test.ts` |
| 2. indépendance à l'ordre d'insertion | fait |
| 3. exclusions effectives, un test par élément exclu | partiel — les exclusions sont testées en bloc, pas un test par élément |
| 4. sensibilité, un test par élément inclus | partiel — même motif |
| 5. absence contre valeur nulle | fait |
| 6. normalisation NFC des accents | fait |
| 7. **précision de la péremption, critère principal** | fait — `tests/content-hash-peremption.test.ts` |
| 8. machine à états, chaque transition non listée lève un code stable | fait — `support-version-state.test.ts` |
| 9. insertion seule garantie au niveau de la base, avec le rôle d'administration | absent — la garantie est applicative ; aucun test ne l'exerce en base |
| 10. empreinte figée d'une version `approved` | fait |

**7 sur 10, 2 partiels, 1 absent.** Le critère 9 exige la base et non la convention ; les migrations 0013 et suivantes ne sont pas appliquées, donc rien n'est vérifié en base.

### 1.14 Points bloqués, avec leur référence au registre K

| Exigence | Blocage | Référence K | Niveau |
| --- | --- | --- | --- |
| W9 plafond de destinations | valeur du paquet de règles absente | K3.1 corpus ERP, millésimes | P |
| G4 hauteurs, contrastes, dimensions de pictogramme | idem | K3.1 | P |
| R7 corpus publicitaire | idem, module 05 | K3.1 corpus publicitaire | L |
| N4.8 déterminisme du PDF | expérimentation à mener | K3.3, tâche T-0.9 | P |
| Cloisonnement sur agrégats et jointures profondes | expérimentation à mener | K3.3 | P |
| P5 seuil de corrélation, méthode d'exposition | validation par un professionnel | K3.6 | V |
| Polices incorporées | licences | K3.2 | L |
| Chaîne tactile, braille | standard de transcription | K3.1 | L |
| Nom « Azimut » | disponibilité | K3.2 | V |

---

## 2. Écart avec l'existant

### 2.1 L'absence de chemin d'écriture, chiffrée

C'est le reproche central, et il est exact. Le dépôt compte 558 fichiers TypeScript, 221 fichiers de test, 24 vues, 10 paquets. Il contient **deux** écritures en base, toutes deux pour des artefacts d'emballage :

- `packages/db/src/delivery-package-repo.ts:36` → `delivery_package`
- `packages/db/src/kiosk-package-repo.ts:29` → `kiosk_package`

`packages/db/src/load-site-data.ts` porte 25 lectures et zéro écriture. **Aucune entité du module 01 — `site`, `level`, `plan_source`, `plan_calibration`, `footprint`, `node`, `edge` — n'a de voie d'écriture.** Le motif de commande de la partie E existe (`apps/studio/src/editor/command.ts`, pile de 200, réversibilité vérifiée) mais s'arrête en mémoire : aucune commande n'atteint le dépôt.

La partie F le prescrivait pourtant nommément. F15 exige un dossier `state/` décrit comme « magasin et commandes, **écrit dans le dépôt** ». Ce dossier n'existe pas.

Conséquence mécanique : M8 critères 1, 2, 3 et 4 sont hors d'atteinte, et avec eux les cinq critères de N1.7. Le produit n'a pas de premier geste.

### 2.2 Les écrans construits hors spécification

24 vues au dépôt. La partie M en spécifie cinq, au champ près. Les dix-neuf autres ont été construites sans spécification d'écran, contre l'inventaire de noms de N2.5, N3.4, N4.5, N5.4 — qui nomme des écrans sans les spécifier, ce que N13.1 dit explicitement.

| | |
| --- | --- |
| Vues spécifiées par la partie M et présentes | 5 (`SitesView`, `PlanCalibrationView`, `FootprintsView`, `GraphView`, `ChecksView`) |
| Vues construites sans spécification d'écran | 19 |
| Vues traitant les six états de F7 | 0 |
| Vues traitant l'état hors ligne | 0 |
| Tests citant M7 | 0 |

C'est exactement ce que K2.7 interdit : « Spécifier aujourd'hui un écran qui sera construit dans deux ans produit un texte réécrit avant d'être lu. » Dix-neuf écrans ont été construits avant l'incrément qui les appelle, et aucun ne porte les onze règles auxquelles il devait se conformer.

Les cinq vues qui portent un nom de la partie M ne sont pas pour autant conformes. Deux écarts vérifiés dans le code, sur l'écran M2 seul :

1. `apps/studio/src/domain/plan-calibration.ts:41` fixe `MIN_POINT_SEPARATION_PX = 20`. M2 étape 2 exige **40 pixels**. La valeur est fausse de moitié.
2. Le code lève `CALIB.NORTH_MISSING`, que **la partie M ne nomme pas**. M2 nomme `CALIB.AZIMUTH_INVALID` pour l'azimut et `CALIB.POINT_REQUIRED` pour un point manquant. Ni l'un ni l'autre n'existe au dépôt.

### 2.3 Les décisions prises avant la scission de propriété de la partie L

L0 scinde `support` en deux propriétaires : wayfinding possède nœud, azimut, typologie, niveau d'information, distance de lecture ; signalétique possède cotes, substrat, fixation. La scission n'est pas faite. `packages/db/src/schema/signage.ts` porte une table `support` unique, sans propriétaire déclaré, dont le module 02 aurait besoin en écriture — ce que R2 de L1 interdit et renvoie à la procédure d'arrêt.

Champs manquants ou mal placés au regard de A5.6 corrigée par L0 et de N4.2 :

| Champ | Attendu | Constat |
| --- | --- | --- |
| `support.substrate_key` | A5.6, propriété signalétique (L0) | absent |
| `support.mounting` jsonb | A5.6, propriété signalétique (L0) | absent |
| `support.information_level` | L0, propriété wayfinding | absent |
| `support_typology.default_substrate` | N4.2 | absent |
| `support_typology.registry` | N4.2 | absent ; `registry` est porté par `support`, ce qui suit A5.6 et non N4.2 |
| `support.context` | aucun document ne le porte sur `support` | **présent sans mandat** — `context` est une portée de règle (D3.5), pas une colonne de support. Décision prise sans vérification, à retirer ou à justifier |

Autres entités que les documents nomment et que le dépôt n'a pas : `orientation_zone`, `naming_rule`, `wayfinding_sequence`, `edge.availability` (présent en schéma, jamais écrit ni lu), et surtout **`message_line`, qui n'a aucune table**. Le modèle existe en mémoire dans `engine-graph`, il n'est jamais persisté. Or W6, W7, W8 et G1 en dépendent, et la tranche 3 le consomme.

### 2.4 Trois inventions à retirer

Vérification faite contre les quatorze documents, trois domaines de codes d'anomalie du dépôt ne sont autorisés par aucun d'eux. Les domaines autorisés s'accumulent en D2.1, E17, G8, H12, I6, J8 et partie M — trente au total.

| Domaine | Déclaré au dépôt comme | Réalité |
| --- | --- | --- |
| `NET` (5 codes) | « Tranche M » dans `error-catalog.ts:293` | **la partie M n'autorise pas `NET`**. Invention, avec une fausse attribution. À retirer. |
| `PARK` (4 codes) | « complément atelier (M2) » | vient du quinzième document, hors des quatorze |
| `DOC` (3 codes) | « complément atelier (M15) » | idem |

### 2.5 Deux collisions de numéros de migration

`packages/db/migrations/` porte deux `0020` et deux `0021` : les miens (`0020_n1_2_missing_fields`, `0021_s1_site_origin`) et ceux du complément atelier (`0020_atelier_m16_source_claim`, `0021_atelier_m2_parking`), arrivés par une fusion. L'ordre d'application n'est plus déterminé. Les migrations 0013 à 0023 ne sont pas appliquées.

### 2.6 Structure du front, F15

| F15 prescrit | Dépôt |
| --- | --- |
| `app/ screens/ components/ viewport/ state/ i18n/ a11y/` | `views/ components/ editor/ data/ domain/ context/ i18n/` |

`state/` et `a11y/` manquent, et ce sont les deux que la tranche 1 appelle : l'un pour l'écriture, l'autre pour M7.8 et M8 critère 5.

### 2.7 Sites de référence, C1

C1 en spécifie sept. Le dépôt en a cinq, dont deux qui ne figurent pas dans C1.

| C1 | Dépôt |
| --- | --- |
| `ref-minimal` | présent |
| `ref-retail` | **absent** |
| `ref-health` | **absent** |
| `ref-transit` | **absent** |
| `ref-campus` | **absent** |
| `ref-broken` | présent |
| `ref-adversarial` | présent |
| — | `ref-multilevel`, `ref-multilevel-graph` (hors C1) |

Or N2.7 critère 1 et T-2.14a critère 7 se vérifient « sur un site de référence ». Quatre des sept manquent.

### 2.8 Ce qui est acquis, et qu'il ne faut pas refaire

L'écart n'est pas total. Ce qui tient et qui sert la tranche 1 :

- INV-4, le déterminisme, prouvé par 48 fichiers, dont un test de bout en bout.
- T-2.14a, sept critères sur dix, dont le critère principal de précision de la péremption.
- D1.4, la primitive d'arrondi unique, et D1.5, les quatre tolérances.
- La machine à états de `support_version` (D9.1, G7), en un seul exemplaire, les tables de preuve en dérivant.
- Le motif de commande de la partie E, réversibilité et pile de 200 comprises — il lui manque sa sortie, pas son cœur.
- M8 critère 6, les trois scanners : aucune couleur en dur, aucun espacement hors échelle, aucune chaîne dans un composant.
- Les jetons de thème, conformes aux valeurs de la partie F et non à celles, périmées, de A11.1.
- Le refus de charger un paquet de règles sans `sourceRef` (D3), qui est le comportement correct en l'absence de corpus.

---

## 3. Arrêts A2.2 à trancher avant la tranche 1

Quatre questions. Les trois premières bloquent la tranche 1 ; la quatrième bloque la tranche 3.

### 3.1 Les sept préalables de K4 — arrêt principal

La section 7 de la consigne dit : « Les préalables de la partie K4 restent des préalables. Ne les contourne pas. » K4 en énumère sept avant la première ligne de code, et ajoute : « Les deux derniers peuvent être menés comme premières tâches de l'incrément 0, **les cinq premiers non**. »

| Préalable | Qui peut le fermer |
| --- | --- |
| 1. Seuils de viabilité commerciale confrontés au terrain | Atlas Studio, en allant vendre (K3.6) |
| 2. Étude concurrentielle documentée | Atlas Studio (K3.1) |
| 3. Corpus réglementaire ERP, au moins une juridiction | Expert normatif externe (K3.1) |
| 4. Millésimes des normes confirmés | Expert normatif externe (K3.1) |
| 5. Origine du code et des données réutilisés, réglée par écrit | Conseil juridique (K3.2) |
| 6. Déterminisme de la sortie PDF démontré | Développement, T-0.9 |
| 7. Cloisonnement sur agrégats et jointures profondes, validé empiriquement | Développement, incrément 0 |

Les cinq premiers ne sont pas des tâches de développement et ne sont pas les miennes à fermer. Les deux derniers le sont, et je peux les mener comme premières tâches, leur livrable étant une note et non du code (K3.3).

**Je m'arrête et je demande.** Trois voies, et il faut en choisir une explicitement :

- **(a)** Les cinq préalables sont réputés fermés hors développement, et vous me le dites par écrit. Je démarre la tranche 1.
- **(b)** Je mène d'abord les préalables 6 et 7, dont le livrable est une note, et rien d'autre. Vous fermez les cinq premiers en parallèle.
- **(c)** Nous constatons que le préalable 3 ne bloque pas la tranche 1. C'est défendable : le module 01 ne compose rien, ne cite aucune hauteur de caractère, et le mécanisme d'accueil des corpus refuse déjà de composer plutôt que d'inventer — ce que K3.1 appelle « le comportement correct ». Le préalable 3 bloquerait alors la tranche 3, pas la tranche 1. Les préalables 1, 2 et 5 restent entiers.

Ma recommandation est **(b) puis (c)** : les préalables 6 et 7 d'abord, parce que K3.3 dit qu'ils « peuvent remettre en cause un choix de socle » et qu'il serait absurde de bâtir l'écriture sur un cloisonnement non validé ; puis la tranche 1 sous la lecture (c), les préalables 1, 2 et 5 restant à votre main et bloquant l'engagement commercial, pas le socle.

### 3.2 Le statut du quinzième document

Le `CLAUDE.md` du dépôt référence un `docs/complement-atelier-plans-parcours-signaletique.md`, complément « atelier de plans, parcours et signalétique » du 17 septembre, **qui n'est pas dans le dossier joint**. Du code au dépôt en dépend déjà : les domaines `PARK` et `DOC`, les migrations `0020_atelier_m16_source_claim` et `0021_atelier_m2_parking`, `audit-parking.ts` et sa forme `ruleRef: 'atelier-P1'`.

Votre consigne dit que les quatorze documents sont la seule référence. Deux lectures possibles, et elles ne donnent pas le même dépôt :

- le quinzième document reste versé et lisible, mais ne tranche pas — le code qui en dépend reste, signalé comme hors des quatorze ;
- il sort du périmètre — `PARK`, `DOC`, les deux migrations atelier et `audit-parking.ts` sont à retirer.

Je ne tranche pas cela seul. Le `CLAUDE.md` pose par ailleurs trois règles de collision de jetons (`M1`–`M17`, `R1`–`R6`, `P1`–`P13`) qui n'ont de sens que si ce document reste.

### 3.3 La consigne caduque du `CLAUDE.md` sur la partie M

Le `CLAUDE.md` déclare la partie M absente du dépôt et en tire : « Réclamer la partie M avant de spécifier un nouvel écran relève de A2.2. » La partie M est dans le dossier joint. Je propose de verser les quatorze documents dans `docs/` et de réécrire ce chapitre du `CLAUDE.md`, ce qui n'est pas du code et ne consomme pas la tranche 1. Dites-moi si je le fais avant ou après la tranche 1.

### 3.4 La propriété de `information_level` (tranche 2, signalé tôt)

L0 attribue le niveau d'information au wayfinding, et W3 l'exige sur tout support. Aucun document ne donne les champs de `information_level` — N13.3 dit les champs des modules 05 à 11 volontairement non descendus, mais le module 02 est descendu au champ en N2.2, et `information_level` n'y figure pas. C'est un choix de modèle non prévu, donc A2.2 cas 2. Je le signale maintenant pour que la réponse soit prête quand la tranche 2 l'appellera, pas au moment de coder.

---

## 4. Plan

### 4.1 Avant la tranche 1 — les deux préalables qui sont les miens

Livrable : deux notes, pas de code. C'est ce que K3.3 prescrit.

- **P-6.** Déterminisme de la sortie PDF (T-0.9, K3.3, niveau P). Mesure sur la chaîne existante, qui est déjà déterministe en SVG ; le PDF ne l'est pas démontré. La note conclut : déterministe, ou déterministe sous conditions nommées, ou non déterministe et alors quel livrable le remplace.
- **P-7.** Cloisonnement sur agrégats et jointures profondes (K3.3, niveau P). Test empirique contre une base réelle : un agrégat et une jointure à trois niveaux ne doivent jamais franchir la frontière d'organisation. Les migrations 0013 à 0023 sont à appliquer pour cela, ce qui est aussi la condition du critère 9 de T-2.14a.

### 4.2 Tranche 1 — chemin d'écriture du module 01, puis les cinq écrans, puis le chronométrage

Une tranche n'est terminée que de bout en bout : saisie, calcul, contrôle, rendu, export, états d'écran, accès clavier, hors ligne. Je la découpe en six lots, chacun terminé avant le suivant.

**Lot 1.1 — La propriété avant l'écriture.** Rien ne s'écrit avant que le propriétaire soit déclaré. Scission de `support` selon L0, champs manquants de A5.6 et N4.2 (`substrate_key`, `mounting`, `information_level`, `default_substrate`), renumérotation des migrations en collision, retrait ou justification de `support.context`. Un test par règle de L1 : R1 propriété unique, R2 lecture sans écriture, R3 dépendance descendante, R4 dégradation déclarée.

**Lot 1.2 — Le magasin et les commandes.** Le `state/` de F15. Les commandes de la partie E, qui existent en mémoire, gagnent leur sortie : une commande, une écriture, une seule voie. A2 du module 12 en est la règle opposable — « l'atelier n'écrit jamais directement en base, il appelle les commandes du module propriétaire ». Cloisonnement en écriture selon A6.1, éprouvé par la note P-7 et non supposé. Pile d'annulation vidée à la synchronisation (E5, A6 du module 12).

**Lot 1.3 — Les codes d'anomalie de la tranche.** Retrait de `NET` et de `CALIB.NORTH_MISSING`. Ajout des neuf codes que M1 et M2 nomment et qui manquent : `DATA.NAME_REQUIRED`, `DATA.NAME_DUPLICATE`, `DATA.COUNTRY_REQUIRED`, `DATA.LANG_REQUIRED`, `IMPORT.FILE_TOO_LARGE`, `IMPORT.FORMAT_UNSUPPORTED`, `IMPORT.PAGE_REQUIRED`, `CALIB.POINT_REQUIRED`, `CALIB.AZIMUTH_INVALID`. Correction de `MIN_POINT_SEPARATION_PX` à 40.

**Lot 1.4 — Les cinq écrans, dans l'ordre de la chaîne.** M1 liste des sites, M2 import et calage, M3 tracé des empreintes, M4 saisie du graphe, M5 validation. Chacun avec ses six états, ses raccourcis, ses critères. Aucun composant hors de la liste fermée de F6, ce que M6 dit sans réserve : « si un écran semble exiger un composant absent de la liste, c'est l'écran qu'il faut revoir ».

**Lot 1.5 — Les onze règles de M7, une par test.** Onze tests qui nomment `M7.1` à `M7.11`, exercés sur les cinq écrans. C'est ce qui rend la règle opposable au sens de N0, et ce qui manque aujourd'hui à la totalité des 24 vues.

**Lot 1.6 — M8, les six critères.** Le parcours complet, puis au clavier seul, puis hors ligne avec synchronisation. Conformité AA automatisée sur les cinq écrans. Et le critère 4, **le chronométrage du parcours, consigné** : premier relevé de l'indicateur économique central du produit.

**Fin de tranche 1.** Rapport A2.6, sortie réelle des quatre vérifications, matrice mise à jour, ce qui n'a pas pu être vérifié.

### 4.3 Tranche 2 — module 02 et tableau des messages

Arrêt prévu et annoncé : **l'écran du tableau des messages n'est pas spécifié au champ près.** N2.5 le dit — « mérite une spécification au champ près, au même titre que la tranche de la partie M » — et M9.2 le confirme. Je m'arrêterai et demanderai avant de le construire, comme votre section 6 l'exige. Le moteur, le modèle `message_line` et sa table, W1 à W10 et les cinq critères de N2.7 ne dépendent pas de cet écran et se font avant l'arrêt.

W9 restera bloquée, plafond de destinations absent du corpus, et le dira à l'écran plutôt que d'inventer une valeur.

### 4.4 Tranche 3 — module 04 consommant `message_line`, et T-2.14a

Le rewire de `composeFace` que T-2.14a §7 interdisait explicitement devient possible ici, et seulement ici : « `composeFace` consommera `message_line`, pas `content_block` directement ». Plus les trois critères de T-2.14a encore ouverts : les deux partiels (un test par élément exclu, un test par élément inclus) et le critère 9, l'insertion seule garantie en base.

### 4.5 Au-delà

Ordre des incréments de la partie B, corrigé par H13, par la décomposition de la partie I et par les couches de L2. Deux lots sont de taille XL et n'entrent pas en développement avant découpage, ce que K3.7 impose et que votre section 7 reprend : les assistances de tracé et la régie publicitaire.

### 4.6 Ce que ce plan ne fait pas

- Aucun écran d'une tranche suivante pendant la tranche en cours. Les dix-neuf vues construites hors spécification ne sont ni étendues ni corrigées en tranche 1 ; elles seront reprises quand leur incrément les appellera, ou retirées.
- Aucun paquet de règles réel. Ils restent vides tant que l'étude d'expert n'est pas faite. La fixture de test sert aux tests, jamais la production.
- Aucune valeur normative inventée. Un seuil manquant produit une anomalie et le dit.

---

## 5. Ce que j'attends de vous pour démarrer

1. La voie retenue sur K4 : (a), (b) ou (c) du chapitre 3.1. Ma recommandation est (b) puis (c).
2. Le statut du quinzième document (chapitre 3.2) : versé sans faire foi, ou sorti du périmètre.
3. Le moment du versement des quatorze documents dans `docs/` et de la réécriture du chapitre du `CLAUDE.md` sur la partie M (chapitre 3.3).

Rien n'est écrit avant votre réponse.
