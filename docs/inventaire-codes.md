# Inventaire des codes d'anomalie absents du cahier des charges consolidé

> **Clos par la version 13 du consolidé.** Ce fichier est le relevé qui a servi
> à l'arbitrage ; il n'est plus une liste à tenir. Ce que l'éditeur a décidé,
> ligne par ligne :
>
> · **93 codes inscrits** au catalogue du consolidé, avec leur gravité et leur
>   sens. Les libellés du dépôt sont alignés sur les leurs.
> · **3 codes retirés** — `DATA.VOCABULARY_UNREADABLE`, `EDIT.NOTHING_TO_UNDO`,
>   `EDIT.NOTHING_TO_REDO` — et réservés : ce sont des états d'écran de F7, non
>   des anomalies de moteur. Leurs points d'appel ont disparu avec eux.
> · **`PARK` et `DOC` admis en D2.1**, et fondés par les faits du site, A5.11,
>   règle M01.S11. **`CHARTER` retiré** des domaines du dépôt, déclaré et vide.
> · **`RULES.OVERLAY_NOT_COMPARABLE` passe en bloquant**, D3.6 tranchant qu'à
>   défaut de preuve de durcissement, la surcouche pays est refusée.
> · **Calage à n points adopté** et spécifié en section M2 ; les cinq codes
>   `CALIB` restent, leurs seuils sont des tolérances techniques.
> · Les deux contrôles déjà tranchés le restent : `GRAPH.VERTICAL_LINK_MISALIGNED`
>   tel quel, `GRAPH.DESTINATION_ENTRANCE_COVERAGE` en avertissement et limité
>   aux entrées empruntées par un profil.
>
> Le recoupement des deux catalogues est désormais tenu par un contrôle, et non
> par un relevé : `tests/catalogue-consolide.test.ts` lit le consolidé lui-même
> et échoue au premier écart, dans un sens comme dans l'autre. La colonne
> « avis » ci-dessous est de l'histoire.

**Le document antérieur `docs/complement-atelier-plans-parcours-signaletique.md`
reste sous `docs/` pour l'historique, et a cessé de faire foi.** Ce qu'il
portait de vivant est ici, ligne par ligne, avec le fichier qui l'applique.

**Les mentions qu'il garde dans ce fichier sont de l'histoire, pas des renvois.**
Le code du dépôt n'en porte plus aucune : plus un commentaire, plus un
`ruleRef`, plus un en-tête de migration ne le désigne, et
`tests/rule-citation-ambiguity.test.ts` échoue si l'un reparaît. Les colonnes
ci-dessous disent d'où venait chaque code au moment du relevé ; les corriger
falsifierait le relevé qu'on a demandé.

Ce fichier est un relevé, pas une décision. Il ne retire rien, n'inscrit rien et ne
modifie aucun contrôle. Le catalogue qui fait foi est celui du consolidé : la table
D2.2 et les tables de code des parties E à Q, dont D2.2 dit que « l'ensemble de ces
tableaux forme le catalogue ».

## Ce qui a été compté

`ERROR_CATALOG` de `packages/core-model/src/error-catalog.ts` porte **216 codes
vivants**. **96** n'apparaissent nulle part dans `docs/cahier-des-charges.md` — ni
dans D2.2, ni dans aucune table de partie. Ce sont les 96 lignes de ce fichier.

Un chiffre de 102 a circulé avant ce relevé : il comptait les six valeurs de
`RETIRED_CODES`, que le dépôt conserve réservées et qui ne doivent justement pas
reparaître au catalogue. Elles ne sont pas de la dette, et ne sont pas ici.

L'écart court aussi dans l'autre sens : le consolidé nomme **24 codes** que le dépôt
ne porte pas encore — `VISITOR.*`, `KIOSK.*`, `ACCOUNT.*`, `DATA.CURRENCY_*` et
d'autres, qui appartiennent à des tranches non construites. Ils ne sont pas de la
dette non plus.

## Domaines hors de la liste fermée de D2.1

D2.1 énumère trente-six domaines, « et eux seuls », et précise qu'« un domaine
nouveau s'ajoute ici, dans le même commit que son premier code ». Deux domaines du
catalogue du dépôt n'y figurent pas :

| Domaine | Codes concernés | Origine |
| --- | --- | --- |
| `PARK` | `PARK.CAPACITY_EXCEEDED`, `PARK.CAPACITY_UNEXPLAINED`, `PARK.PROPOSAL_AS_EXISTING`, `PARK.SOURCE_MISSING` | Complément atelier, M2 et P1 |
| `DOC` | `DOC.BINDING_UNKNOWN`, `DOC.BINDING_UNRESOLVED`, `DOC.LITERAL_NUMBER` | Complément atelier, M15 |

Un troisième, `CHARTER`, figure dans `ANOMALY_DOMAINS` sans porter aucun code : il
est déclaré et vide. Aucun de ces trois n'est ajouté ni retiré ici.

## Les deux contrôles tranchés

`GRAPH.VERTICAL_LINK_MISALIGNED` — **retenu tel quel** : ascenseurs et escaliers
droits seulement, escaliers mécaniques et rampes exemptés, tolérance de la section
D1.5 (`POINT_COINCIDENCE_M`, un millimètre), gravité bloquante. Le code n'a pas
changé.

`GRAPH.DESTINATION_ENTRANCE_COVERAGE` — **retenu en avertissement**, et limité aux
entrées empruntées par au moins un profil de visiteur. Le contrôle et son essai ont
changé en conséquence, dans le commit qui porte ce fichier. « Empruntée » se lit sur
le graphe : le profil franchit au moins une arête depuis cette entrée. Conséquence
dite plutôt que découverte : un site sans profil déclaré ne lève plus rien, ce qui
est le cas de la session d'atelier de la tranche 1.

## Comment lire les colonnes

**Gravité levée.** Celle du site d'appel. Quand elle diffère de celle du catalogue,
les deux sont données — le cas se présente une fois, `PACKAGE.EMPTY_ARTIFACT`.

**Renvoi de règle.** Le `ruleRef` que porte l'anomalie, vide quand elle n'en porte
pas. `atelier-*` désigne le complément atelier.

**Exigence équivalente dans le consolidé.** La section qui porte **le fait que le
code vérifie**, et non celle qui déclare la fonction qui le lève : une section qui
nomme `renderEvacuationPlan` n'exige pas pour autant qu'un niveau introuvable soit
refusé. « aucune » veut dire que le fait vérifié n'est écrit nulle part, et
l'hésitation a été tranchée en faveur de « aucune ».

**Avis.** `inscrire` quand le consolidé porte déjà l'exigence : le code n'attend
qu'une entrée au catalogue. `décider` quand l'exigence n'y est pas : c'est une
décision d'éditeur, pas une écriture de dépôt. `retirer` quand le contrôle est jugé
infondé — trois cas, tous pour le même motif, qui est celui du retrait de
`NET.OFFLINE` : D2.2 réserve le catalogue aux anomalies produites par un moteur, et
un état d'écran de F7 n'en est pas une.

Répartition : **52 `inscrire`**, **41 `décider`**, **3 `retirer`**.

| Code | Gravité levée | Fichier et fonction | Renvoi | Règle d'origine | Exigence dans le consolidé | Avis |
| --- | --- | --- | --- | --- | --- | --- |
| `CALIB.CONTROL_POINTS_COLLINEAR` | bloquant | `packages/core-model/src/affine-calibration.ts` · `fitMeasuredCalibration` | `atelier-M1.4` | M1.4 — calage mesuré à n points homologues, avec résidu | K3.8 — inscrit au registre comme « amélioration possible, non engagée » | `décider` |
| `CALIB.CONTROL_POINTS_INSUFFICIENT` | bloquant | `packages/core-model/src/affine-calibration.ts` · `fitMeasuredCalibration` | `atelier-M1.4` | M1.4 — calage mesuré à n points homologues, avec résidu | K3.8 — « amélioration possible, non engagée » | `décider` |
| `CALIB.ORIGIN_LOCKED` | bloquant | `packages/core-model/src/plan.ts` · `guardSiteOrigin` | `N1.3` | M01.S1 — le repère site est fixé au premier calage et n'est jamais modifié | N1.3, règle M01.S1 | `inscrire` |
| `CALIB.ORIGIN_MISMATCH` | bloquant | `packages/engine-graph/src/checks/site-frame.ts` · `checkSiteOriginCoherent` | `N1.3` | M01.S1 — le repère site est fixé au premier calage et n'est jamais modifié | N1.3, règle M01.S1 | `inscrire` |
| `CALIB.RESIDUAL_MEAN_EXCEEDED` | bloquant | `packages/core-model/src/affine-calibration.ts` · `auditCalibrationResiduals` | `atelier-M1.4` | M1.4 — résidu moyen de calage sous le seuil | K3.8 — « amélioration possible, non engagée » | `décider` |
| `CALIB.RESIDUAL_NOT_MEASURED` | avertissement | `packages/core-model/src/affine-calibration.ts` · `fitMeasuredCalibration` | `atelier-M1.4` | M1.4 — le résidu ne mesure rien à trois points homologues | K3.8 — « amélioration possible, non engagée » | `décider` |
| `CALIB.RESIDUAL_POINT_EXCEEDED` | bloquant | `packages/core-model/src/affine-calibration.ts` · `auditCalibrationResiduals` | `atelier-M1.4` | M1.4 — résidu par point sous le seuil | K3.8 — « amélioration possible, non engagée » | `décider` |
| `DATA.APPROVED_VERSION_NOT_IMMUTABLE` | bloquant | `packages/engine-graph/src/checks/support-version.ts` · `checkApprovedVersionImmutable` | `N4.3` | M04.G7 — une version approuvée est immuable | N4.3, règle M04.G7 ; D9.1 | `inscrire` |
| `DATA.CATEGORY_CYCLE` | bloquant | `packages/engine-graph/src/validate-library.ts` · `categoryCycleFindings` |  | Hiérarchie de catégories sans cycle | aucune | `décider` |
| `DATA.CATEGORY_PARENT_NOT_FOUND` | bloquant | `packages/engine-graph/src/validate-library.ts` · `categoryParentNotFoundFindings` |  | `category.parent_id` désigne une catégorie existante | A5.4 — la relation y est déclarée | `inscrire` |
| `DATA.DEST_CATEGORY_NOT_FOUND` | avertissement | `packages/engine-graph/src/validate-library.ts` · `destCategoryNotFoundFindings` |  | `destination.category_id` désigne une catégorie existante | A5.4 — la relation y est déclarée | `inscrire` |
| `DATA.EMPTY_SVG_PATH` | bloquant | `packages/engine-graph/src/validate-library.ts` · `emptySvgPathFindings` |  | Un pictogramme porte un tracé | aucune | `décider` |
| `DATA.FACE_CONTENT_UNSERIALIZABLE` | bloquant | `packages/engine-layout/src/face-content-hash.ts` · `computeFaceContentHash` |  | Sérialisation canonique avant hachage | D7.2 | `inscrire` |
| `DATA.FACE_DIMENSIONS_INVALID` | bloquant | `packages/engine-graph/src/face-format.ts` · `computeFaceFormat` (+1 autre) | `N4.3` | Format déduit du contenu, dimensions calculées | A7.2, `computeDimensions` — la positivité n'y est pas dite | `décider` |
| `DATA.KIOSK_CONFIG_INVALID` | bloquant | `packages/engine-package/src/kiosk-config.ts` · `invalid` |  | Configuration locale d'une borne | aucune | `décider` |
| `DATA.PICTOGRAM_CATEGORY_NOT_FOUND` | bloquant | `packages/engine-graph/src/validate-library.ts` · `pictogramCategoryNotFoundFindings` |  | `pictogram.category_id` désigne une catégorie existante | A5.4 — la relation y est déclarée | `inscrire` |
| `DATA.PROOF_DUPLICATE_VERSION` | bloquant | `packages/engine-graph/src/validate-proofs.ts` · `validateProofs` |  | Un numéro de version par épreuve | aucune | `décider` |
| `DATA.PROOF_PENDING_WITH_APPROVAL` | avertissement | `packages/engine-graph/src/validate-proofs.ts` · `validateProofs` |  | L'approbation fait sortir de l'état en revue | D9.1 — table des transitions | `inscrire` |
| `DATA.PROOF_STATUS_WITHOUT_APPROVAL` | bloquant | `packages/engine-graph/src/validate-proofs.ts` · `validateProofs` |  | L'approbation écrit une ligne d'approbation | D9.1 — table des transitions | `inscrire` |
| `DATA.SUPPORT_BLOCK_REGION_INVALID` | bloquant | `packages/engine-graph/src/validate-supports.ts` · `blockRegionFindings` |  | Refus d'un bloc qui déborde de la grille du gabarit | E10 ; D8.2 | `inscrire` |
| `DATA.SUPPORT_DUPLICATE_TYPE_KEY` | bloquant | `packages/engine-graph/src/validate-supports.ts` · `duplicateTypeKeyFindings` |  | Clé de typologie unique | aucune | `décider` |
| `DATA.SUPPORT_FACE_COUNT_MISMATCH` | bloquant | `packages/engine-graph/src/validate-supports.ts` · `faceCountMismatchFindings` |  | `face_count` entier de 1 à 4, et autant de faces déclarées | N4.2 ; A5.6 | `inscrire` |
| `DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND` | avertissement | `packages/engine-graph/src/validate-supports.ts` · `templateSideNotFoundFindings` |  | Une face de gabarit correspond à une face de la typologie | A5.6 ; D8.2 | `inscrire` |
| `DATA.SUPPORT_TEMPLATE_TYPE_NOT_FOUND` | bloquant | `packages/engine-graph/src/validate-supports.ts` · `templateTypeNotFoundFindings` |  | `support_typology.template_key` désigne un gabarit existant | A5.6 — la relation y est déclarée | `inscrire` |
| `DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED` | bloquant | `packages/core-model/src/support-version-state.ts` · `transitionSupportVersion` |  | Rejet d'une version : motif obligatoire | D9.1 — « Rejet | Motif obligatoire » | `inscrire` |
| `DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN` | bloquant | `packages/core-model/src/support-version-state.ts` · `transitionSupportVersion` |  | Les transitions non listées sont interdites | D9.1 | `inscrire` |
| `DATA.VOCABULARY_UNREADABLE` | bloquant | `apps/studio/src/data/use-site-repository.ts` · `useSiteVocabularyLoad` |  | M3 — registre du site, vocabulaire (complément atelier) | aucune | `retirer` |
| `DOC.BINDING_UNKNOWN` | bloquant | `packages/engine-graph/src/audit-bound-text.ts` · `auditBoundText` | `atelier-M15` | M15 — document de stratégie et données des cartographies | aucune ; le domaine `DOC` est hors de la liste de D2.1 | `décider` |
| `DOC.BINDING_UNRESOLVED` | bloquant | `packages/engine-graph/src/audit-bound-text.ts` · `auditBoundText` | `atelier-M15` | M15 — document de stratégie et données des cartographies | aucune ; domaine `DOC` hors D2.1 | `décider` |
| `DOC.LITERAL_NUMBER` | avertissement | `packages/engine-graph/src/audit-bound-text.ts` · `auditBoundText` | `atelier-M15` | M15 — un nombre d'un document vient d'un champ lié | aucune ; domaine `DOC` hors D2.1 | `décider` |
| `EDIT.COMMAND_SHAPE_INVALID` | bloquant | `packages/core-model/src/site-commands.ts` · `buildCommand` (+7 autres) | `A5.3` | E5.1 — une commande porte un type, une cible, les valeurs avant et après, un horodatage | E5.1 | `inscrire` |
| `EDIT.NOTHING_TO_REDO` | information | `apps/studio/src/state/command-store.ts` · `nothingToRedo` | `E5.2` | E5.2 — pile d'annulation par site et par utilisateur | E5.2 — la pile y est, l'anomalie non | `retirer` |
| `EDIT.NOTHING_TO_UNDO` | information | `apps/studio/src/state/command-store.ts` · `nothingToUndo` | `E5.2` | E5.2 — pile d'annulation par site et par utilisateur | E5.2 — la pile y est, l'anomalie non | `retirer` |
| `EDIT.TABLE_NOT_OWNED` | bloquant | `packages/core-model/src/site-commands.ts` · `buildCommand` |  | M12.A2 — l'atelier n'écrit jamais directement en base | N12.2, règle M12.A2 ; L0 | `inscrire` |
| `EDIT.TIMESTAMP_REQUIRED` | bloquant | `packages/core-model/src/site-commands.ts` · `buildCommand` |  | E5.1 — horodatage fourni par l'appelant | E5.1 | `inscrire` |
| `EDIT.WRITE_REFUSED` | bloquant | `packages/db/src/write-path.ts` · `writeFailure` (+1 autre) | `A6.1` | A6.1 — cloisonnement par ligne, la base refuse l'écriture hors périmètre | A6.1 | `inscrire` |
| `FLOW.WEIGHT_INVALID` | bloquant | `packages/engine-graph/src/exposure.ts` · `invalidWeight` | `I5.3` | I5.3 — pondérations d'un profil de parcours | D2.2 porte `FLOW.WEIGHTS_NOT_NORMALIZED`, fait voisin ; rien sur une pondération négative | `décider` |
| `GRAPH.CATEGORY_ALL_VACANT` | avertissement | `packages/engine-graph/src/checks/directory.ts` · `checkAllVacantCategory` |  | Catégorie dont toutes les destinations sont vacantes | aucune | `décider` |
| `GRAPH.DESTINATION_DUPLICATE_ON_NODE` | avertissement | `packages/engine-graph/src/validate-directory.ts` · `duplicateDestOnNodeFindings` |  | Un nœud d'accès porte une destination | aucune | `décider` |
| `GRAPH.DESTINATION_ENTRANCE_COVERAGE` | avertissement | `packages/engine-graph/src/checks-structure.ts` · `destinationNotReachedFromEveryEntranceFindings` | `atelier-QC-10` | QC-10 — nœud public non relié à toutes les entrées | aucune — **tranché** : retenu en avertissement, limité aux entrées empruntées par au moins un profil | `inscrire` |
| `GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND` | bloquant | `packages/engine-graph/src/validate-directory.ts` · `destFootprintNotFoundFindings` |  | `destination.footprint_id` désigne une empreinte existante | A5.4 ; N1.3, règle M01.S4 | `inscrire` |
| `GRAPH.DESTINATION_LANG_INCOMPLETE` | avertissement | `packages/engine-graph/src/checks/directory.ts` · `checkIncompleteLangCoverage` |  | Une destination est dénommée dans chaque langue active | D2.2, `LAYOUT.LANG_VARIANT_MISSING` — même fait au rendu | `inscrire` |
| `GRAPH.DESTINATION_NAME_DUPLICATE` | avertissement | `packages/engine-graph/src/checks/directory.ts` · `checkDuplicateDisplayName` |  | Deux destinations ne portent pas la même dénomination | aucune | `décider` |
| `GRAPH.DESTINATION_NAME_MISSING` | avertissement | `packages/engine-graph/src/checks-structure.ts` · `missingDestinationNameFindings` |  | Une destination est dénommée dans chaque langue active | D2.2, `LAYOUT.LANG_VARIANT_MISSING` | `inscrire` |
| `GRAPH.DESTINATION_NODE_WRONG_KIND` | avertissement | `packages/engine-graph/src/validate-directory.ts` · `destNodeWrongKindFindings` |  | M01.S4 — une destination est rattachée à une empreinte et à un nœud d'accès | N1.3, règle M01.S4 | `inscrire` |
| `GRAPH.DESTINATION_UNREACHABLE` | bloquant | `packages/engine-graph/src/validate-graph.ts` · `unreachableDestinationFindings` |  | Toute destination est atteignable depuis une entrée | A7.1 — `validateGraph` : zones inatteignables, destinations non reliées | `inscrire` |
| `GRAPH.DIRECTORY_NAME_EMPTY` | bloquant | `packages/engine-graph/src/validate-directory.ts` · `emptyNameFindings` |  | Une dénomination n'est pas vide | aucune | `décider` |
| `GRAPH.DIRECTORY_NAME_MISSING` | avertissement | `packages/engine-graph/src/validate-directory.ts` · `missingNameFindings` |  | Une destination est dénommée dans chaque langue active | D2.2, `LAYOUT.LANG_VARIANT_MISSING` | `inscrire` |
| `GRAPH.DIRECTORY_NAME_ORPHAN` | avertissement | `packages/engine-graph/src/validate-directory.ts` · `orphanNameFindings` |  | `destination_name.destination_id` désigne une destination existante | A5.4 — la relation y est déclarée | `inscrire` |
| `GRAPH.NO_ENTRANCE` | bloquant | `packages/engine-graph/src/validate-graph.ts` · `unreachableFromEntranceFindings` |  | Un site porte au moins une entrée | aucune — A7.1 présuppose une entrée sans l'exiger | `décider` |
| `GRAPH.PROFILE_NOT_ACCESSIBLE` | bloquant | `packages/engine-graph/src/audit.ts` · `auditAccessibility` |  | `auditAccessibility(graph, profile)` s'exécute sur un profil accessible | A7.1 | `inscrire` |
| `GRAPH.QUANTITY_CROSS_CHECK_FAILED` | bloquant | `packages/engine-graph/src/compute-quantities.ts` · `computeQuantities` |  | Le quantitatif recoupe la nomenclature | aucune — T-2.13 pose le quantitatif, pas le recoupement | `décider` |
| `GRAPH.QUANTITY_NODE_NOT_FOUND` | avertissement | `packages/engine-graph/src/compute-quantities.ts` · `computeQuantities` |  | `support.node_id` désigne un nœud existant | A5.6 — la relation y est déclarée | `inscrire` |
| `GRAPH.RESOLVE_NODE_NOT_FOUND` | bloquant | `packages/engine-graph/src/resolve-face.ts` · `resolveFaceContent` |  | Le nœud passé à la résolution de contenu existe | aucune | `décider` |
| `GRAPH.ROUTE_NODE_NOT_FOUND` | bloquant | `packages/engine-graph/src/compute-route.ts` · `computeRoute` |  | Les nœuds passés à `computeRoute` existent | aucune | `décider` |
| `GRAPH.ROUTE_UNREACHABLE` | bloquant | `packages/engine-graph/src/compute-route.ts` · `computeRoute` |  | `computeRoute` ne trouve aucun chemin | A7.1, `computeRoute` — le refus n'y est pas dit | `décider` |
| `GRAPH.VERTICAL_LINK_MISALIGNED` | bloquant | `packages/engine-graph/src/checks-structure.ts` · `verticalLinkMisalignedFindings` | `atelier-QC-12` | QC-12 — liaison verticale non alignée entre niveaux | aucune — **tranché** : retenu tel quel, ascenseurs et escaliers droits seulement, tolérance D1.5, bloquant | `inscrire` |
| `IMPORT.EMPTY_FILE` | bloquant | `packages/engine-graph/src/import-occupancy.ts` · `importOccupancy` (+1 autre) |  | Un fichier d'import porte au moins une ligne | aucune — D2.2 porte `FILE_TOO_LARGE`, `FORMAT_UNSUPPORTED`, `PAGE_REQUIRED` | `décider` |
| `LAYOUT.EVAC_EMPTY_LEVEL` | avertissement | `packages/engine-layout/src/render-evacuation-plan.ts` · `renderEvacuationPlan` |  | Aucun résultat vide présenté comme un succès | M7, règle 11 | `inscrire` |
| `LAYOUT.EVAC_LEVEL_NOT_FOUND` | bloquant | `packages/engine-layout/src/render-evacuation-plan.ts` · `renderEvacuationPlan` |  | `renderEvacuationPlan(level, graph, rulesPack)` | A7.4 — le refus n'y est pas dit | `décider` |
| `LAYOUT.EVAC_NO_EXITS` | avertissement | `packages/engine-layout/src/render-evacuation-plan.ts` · `renderEvacuationPlan` |  | Aucun résultat vide présenté comme un succès | M7, règle 11 | `inscrire` |
| `LAYOUT.EVAC_NO_ROUTES` | avertissement | `packages/engine-layout/src/render-evacuation-plan.ts` · `renderEvacuationPlan` |  | Aucun résultat vide présenté comme un succès | M7, règle 11 | `inscrire` |
| `LAYOUT.FACT_CONTRADICTED` | bloquant | `packages/engine-graph/src/audit-site-facts.ts` · `auditSiteFacts` | `atelier-M3` | M3 / QC-05 — texte contraire à un fait du site | aucune | `décider` |
| `LAYOUT.FLOOR_PLAN_EMPTY_LEVEL` | avertissement | `packages/engine-layout/src/render-floor-plan.ts` · `renderFloorPlan` |  | Aucun résultat vide présenté comme un succès | M7, règle 11 | `inscrire` |
| `LAYOUT.FLOOR_PLAN_LEVEL_NOT_FOUND` | bloquant | `packages/engine-layout/src/render-floor-plan.ts` · `renderFloorPlan` |  | Rendu d'un plan de sol pour un niveau | A7.2 — le refus n'y est pas dit | `décider` |
| `LAYOUT.FORBIDDEN_CHARACTER` | bloquant | `packages/engine-graph/src/audit-typography.ts` · `auditTypography` | `atelier-QC-06` | QC-06 / P7 — caractère interdit dans un texte de livrable | aucune | `décider` |
| `LAYOUT.ISO_EMPTY_LEVELS` | avertissement | `packages/engine-iso/src/render-iso.ts` · `renderIsoView` |  | Aucun résultat vide présenté comme un succès | M7, règle 11 | `inscrire` |
| `LAYOUT.ISO_LEVEL_NOT_FOUND` | bloquant | `packages/engine-iso/src/render-iso.ts` · `renderIsoView` |  | `renderIsometric(scene, activeLevel, mode)` | A7.3 — le refus n'y est pas dit | `décider` |
| `LAYOUT.MOUNTING_OUT_OF_RANGE` | bloquant | `packages/rules/src/rule-checks.ts` · `checkMountingHeight` |  | Hauteur d'implantation, valeur du paquet de règles | A1.2, INV-5 — la hauteur d'implantation y est nommée ; D3.3 | `inscrire` |
| `LAYOUT.ORIENTED_PLAN_EMPTY_LEVEL` | avertissement | `packages/engine-layout/src/render-oriented-plan.ts` · `renderOrientedPlan` |  | Aucun résultat vide présenté comme un succès | M7, règle 11 | `inscrire` |
| `LAYOUT.ORIENTED_PLAN_LEVEL_NOT_FOUND` | bloquant | `packages/engine-layout/src/render-oriented-plan.ts` · `renderOrientedPlan` |  | `renderOrientedMap(support, scene, graph)` | A7.4 — le refus n'y est pas dit | `décider` |
| `LAYOUT.SENTENCE_TOO_LONG` | avertissement | `packages/engine-graph/src/audit-sentence-length.ts` · `auditSentenceLength` | `atelier-QC-20` | QC-20 — phrase de plus de 25 mots dans un cartouche ou une note | aucune | `décider` |
| `LAYOUT.SOURCE_DISCREPANCY_OPEN` | avertissement | `packages/engine-graph/src/audit-source-claims.ts` · `auditSourceClaims` | `atelier-M16` | M16 — registre des écarts et des points à traiter | aucune | `décider` |
| `LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS` | bloquant | `packages/rules/src/rule-checks.ts` · `checkStrokeToHeight` |  | Rapport épaisseur de trait sur hauteur de caractère | aucune — INV-5 nomme quatre valeurs normatives, pas celle-ci | `décider` |
| `LAYOUT.TEMPLATE_BINDING_UNSUPPORTED` | bloquant | `packages/engine-graph/src/compile-template.ts` · `compileTemplate` |  | D8.2 — schéma de gabarit, liaisons de bloc | D8.2 | `inscrire` |
| `LAYOUT.TEMPLATE_INVALID` | bloquant | `packages/engine-graph/src/compile-template.ts` · `invalidFindings` |  | D8.1 — un gabarit est une donnée, conforme à son schéma | D8.1 ; D8.2 | `inscrire` |
| `PACKAGE.ABSOLUTE_PATH` | bloquant | `packages/engine-package/src/assemble-kiosk-package.ts` · `assembleKioskPackage` |  | D10.1 — aucun chemin absolu dans le paquet | D10.1 | `inscrire` |
| `PACKAGE.DUPLICATE_ID` | bloquant | `packages/engine-package/src/assemble-package.ts` · `assemblePackage` |  | Un identifiant par artefact du paquet | aucune | `décider` |
| `PACKAGE.DUPLICATE_PATH` | bloquant | `packages/engine-package/src/assemble-delivery-archive.ts` · `duplicate` (+2 autres) |  | Un chemin par fichier de l'arborescence | D10.1 | `inscrire` |
| `PACKAGE.EMPTY_ARTIFACT` | avertissement (catalogue : bloquant) | `packages/engine-package/src/assemble-package.ts` · `validateArtifact` |  | Un artefact du paquet porte du contenu | aucune | `décider` |
| `PACKAGE.FILE_MISSING` | bloquant | `packages/engine-package/src/assemble-kiosk-package.ts` · `missingFileFindings` |  | D10.1 — arborescence requise du paquet de borne | D10.1 | `inscrire` |
| `PACKAGE.INTEGRITY_MISMATCH` | bloquant | `packages/engine-package/src/update-protocol.ts` · `verifyAgainstManifest` |  | D10.4 — un fichier téléchargé conforme au manifeste | D10.4 | `inscrire` |
| `PARK.CAPACITY_EXCEEDED` | bloquant | `packages/engine-graph/src/audit-parking.ts` · `auditParking` | `atelier-M2` | M2 — places numérisées et capacité annoncée | aucune ; le domaine `PARK` est hors de la liste de D2.1 | `décider` |
| `PARK.CAPACITY_UNEXPLAINED` | bloquant | `packages/engine-graph/src/audit-parking.ts` · `auditParking` | `atelier-M2` | M2 — places numérisées et capacité annoncée | aucune ; domaine `PARK` hors D2.1 | `décider` |
| `PARK.PROPOSAL_AS_EXISTING` | bloquant | `packages/engine-graph/src/audit-parking.ts` · `auditParking` | `atelier-P1` | P1 — une proposition ne s'affiche jamais comme un existant | aucune ; domaine `PARK` hors D2.1 | `décider` |
| `PARK.SOURCE_MISSING` | bloquant | `packages/engine-graph/src/audit-parking.ts` · `sourceFinding` | `atelier-M2` | P1 — tout objet porte une source et un statut | aucune ; domaine `PARK` hors D2.1 | `décider` |
| `RULES.FILE_MISSING` | bloquant | `packages/rules/src/loader.ts` · `readFileFinding` (+1 autre) |  | D3.1 — un manifeste et un ou plusieurs fichiers de règles | D3.1 ; D3.2 | `inscrire` |
| `RULES.FILE_NOT_LISTED` | bloquant | `packages/rules/src/pack-directory.ts` · `loadPackDirectoryParsed` |  | D3.2 — le manifeste liste les fichiers du paquet | D3.1 ; D3.2 | `inscrire` |
| `RULES.INVALID_JSON` | bloquant | `packages/rules/src/loader.ts` · `loadRulesPack` (+3 autres) |  | D3.1 — fichiers de règles au format JSON | D3.1 | `inscrire` |
| `RULES.OVERLAY_LESS_RESTRICTIVE` | bloquant | `packages/rules/src/overlay.ts` · `mergeCountryOverlay` |  | D3.6 — une règle pays moins contraignante est rejetée au chargement, avec un code dédié | D3.6 — le code dédié y est demandé | `inscrire` |
| `RULES.OVERLAY_NOT_COMPARABLE` | avertissement | `packages/rules/src/overlay.ts` · `mergeCountryOverlay` |  | D3.6 — la surcouche durcit, jamais l'inverse | D3.6 — le cas non comparable n'y est pas tranché | `décider` |
| `RULES.VALIDATION_ERROR` | bloquant | `packages/rules/src/loader.ts` · `loadRulesPack` (+5 autres) |  | D3.4 — une règle sans `sourceRef` fait refuser le paquet entier | D3.3 ; D3.4 | `inscrire` |
| `WAYFIND.FACE_TEMPLATE_MISSING` | bloquant | `packages/engine-graph/src/compose-face.ts` · `composeFace` (+1 autre) | `H2.5` | Une face de typologie a son gabarit | A5.6 ; D8.1 | `inscrire` |
| `WAYFIND.LINE_MALFORMED` | bloquant | `packages/engine-graph/src/compose-face.ts` · `destinationEntries` | `H2.5` | H2.5 — propriétés exigées d'une ligne du tableau des messages | H2.5 | `inscrire` |
| `WAYFIND.LINE_MISSING` | bloquant | `packages/engine-graph/src/compose-face.ts` · `resolveFaceFromSchedule` | `H2.5` | H2.5 — le contenu d'une face est résolu depuis le tableau des messages | H2.5 ; A1.2, INV-2 | `inscrire` |
| `WAYFIND.SUPPORT_TYPE_UNKNOWN` | bloquant | `packages/engine-graph/src/compose-face.ts` · `composeFace` (+1 autre) | `H2.5` | `support.typology` désigne une typologie existante | A5.6 — la relation y est déclarée | `inscrire` |

## Ce que cet inventaire ne dit pas

Il ne dit pas si un code est juste, seulement s'il a une exigence derrière lui. Un
code dont l'exigence figure au consolidé peut être mal appliqué, et la colonne
« avis » ne le verrait pas.

Il ne suit pas les codes que le consolidé porte et que le dépôt applique déjà : ceux
là ne sont pas de la dette, et ne sont donc pas ici.
