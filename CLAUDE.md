# Azimut — Règles de conduite

## Invariants (A1.2)

1. **Source unique, rendus dérivés.** Le site est modélisé une fois. Tous les livrables sont calculés depuis les mêmes données. Aucun livrable n'est dessiné à la main. Aucune donnée n'est dupliquée pour les besoins d'un rendu.
2. **Un panneau est une vue, pas un dessin.** Le contenu d'une face de support est résolu depuis le graphe et l'annuaire au moment du rendu. Il n'est jamais saisi librement, sauf pour les blocs explicitement typés comme libres.
3. **Le registre de sécurité est cloisonné.** Aucune charte client ne peut modifier une couleur, une géométrie, un pictogramme ou une proportion relevant du registre de sécurité. Le moteur refuse l'opération et lève une erreur.
4. **Le rendu est déterministe.** Deux compilations d'un même état de données produisent des fichiers strictement identiques, octet pour octet.
5. **Aucune valeur réglementaire dans le code.** Toute constante d'origine normative provient d'un paquet de règles versionné, chargé en donnée.

## Interdictions permanentes (A2.4)

- Écrire en dur une valeur d'origine normative.
- Écrire en dur une couleur hors du fichier de jetons de thème.
- Introduire une source d'indéterminisme dans un moteur.
- Contourner le cloisonnement par organisation, y compris en test.
- Committer un secret, une clé, une chaîne de connexion, un jeton.
- Committer une donnée client réelle, un plan réel, une charte réelle.
- Désactiver une règle de lint, ignorer un test, marquer un test en attente pour faire passer une tâche.
- Utiliser une fonctionnalité de la plateforme d'hébergement non disponible en installation autonome.
- Créer un fichier de plus de 400 lignes sans découpage.
- Employer `any` en TypeScript. `unknown` puis restriction de type.

## Vérification avant annonce (A2.3)

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:visual
```

Les quatre commandes doivent passer, dans cet ordre, avant d'annoncer une tâche terminée. Le rapport de fin de tâche indique la sortie réelle.

## Arrêt obligatoire (A2.2)

L'agent s'arrête et demande dans les cas suivants :

1. Une valeur réglementaire, une norme ou un seuil manque et devrait venir d'un paquet de règles.
2. La tâche exige un choix de modèle de données non prévu.
3. Deux exigences se contredisent.
4. Une bibliothèque tierce nouvelle semble nécessaire.
5. Le respect d'un invariant rend la tâche impossible telle qu'écrite.
6. Une donnée client réelle serait nécessaire pour tester.
7. Une migration de base détruirait ou transformerait des données existantes.

## Rapport de fin de tâche (A2.6)

```
Tâche : <identifiant>
Fait : <liste des changements réels>
Fichiers touchés : <liste>
Vérifications : <sortie des 4 commandes>
Constaté, non traité : <liste ou "rien">
Décisions prises : <liste ou "aucune">
Non vérifié : <liste ou "rien">
```

## Référence complète

Le cahier des charges principal (parties A, B, C) et son complément (partie D) sont désormais dans le dépôt, sous `docs/`. Ils font foi sur le modèle de données, les contrats des moteurs, les tâches et les conventions ; on ne les reconstitue pas, on les lit. Toute divergence du code existant avec ces documents relève de la procédure d'arrêt A2.2 (contradiction) et doit être signalée, pas résolue en silence.

Documents de référence présents dans `docs/` :

| Document | Objet |
| --- | --- |
| `docs/cahier-des-charges.md` | Cahier des charges principal, parties A, B, C. Invariants, modèle de données (A5), contrats des moteurs (A7), tâches (B), annexes (C). Fait foi. |
| `docs/partie-d-conventions-formats-algorithmes.md` | Complément, partie D. Conventions, formats et algorithmes : repère et arrondis (D1), catalogue d'anomalies (D2), format des paquets de règles et résolution de portée (D3), formats d'import (D4), projection isométrique (D5), empreintes (D7), langage de gabarit (D8), machines à états (D9), paquet de borne (D10), nommage (D11), i18n (D12), et points ouverts (D18). |
| `docs/partie-e-edition-vectorielle.md` | Édition, capacités vectorielles, couche d'habillage. Contextes d'édition, quantification, modèle de commande, magnétisme, sélection accessible. |
| `docs/partie-f-interface-design.md` | Interface et système de design. Jetons de thème, échelles d'espacement et typographiques, contraste, ombrage isométrique, chrome de la borne. |
| `docs/partie-g-resolution-points-ouverts.md` | Méthode de chiffrage sans durées, budget de rendu adaptatif, saisie tactile et stylet, présence simultanée, métriques de police, chaîne colorimétrique. |
| `docs/partie-h-modules-manquants.md` | Carte complète des modules et tableau des messages, qui s'intercale entre le graphe et la composition. |
| `docs/partie-i-atelier-dessin.md` | Atelier de dessin, chaîne de transformation d'un plan en document fini, assistances, droits par module. |
| `docs/partie-j-stylet-pictogrammes.md` | Saisie à l'encre, couche d'esquisse, annotation de révision, éditeur de pictogrammes, bibliothèques à trois étages. |
| `docs/partie-k-registre-points-ouverts.md` | Registre consolidé des points ouverts. Remplace et fait seul foi contre les huit listes antérieures (C5, D18, E19, F19, G10, H14, I7, J10). |
| `docs/partie-l-fiches-modules-integration.md` | Fiches de modules et modèle d'intégration. Propriété des données module par module, quatre règles d'intégration (L1), couches (L2), chaînes de propagation (L4), événements (L5), dégradation par module non souscrit (L6). **Modifie A5.6** : la scission de propriété de `support` entre wayfinding et signalétique (L0) est prioritaire sur elle. |
| `docs/partie-n-cahier-detaille-modules.md` | Cahier des charges détaillé des douze modules. Champs, règles métier numérotées et opposables (S, W, P, G, R, T, C, E, B, F, X, A), contrôles, écrans, critères d'acceptation. S'appuie sur L pour la propriété et sur M pour les écrans. |
| `docs/complement-atelier-plans-parcours-signaletique.md` | Complément « atelier de plans, parcours et signalétique », remis le 17 septembre 2026. Chaîne de production en huit étapes, modules M1 à M17, treize principes opposables P1 à P13, contrôles QC-01 à QC-22, écrans ECR-AZ-01 à ECR-AZ-20. **Ne fait pas foi contre les parties A à N** : il les contredit sur neuf points, relevés au chapitre « Contradictions relevées au versement » du document. **Tranché le 17 septembre 2026** : le complément est une évolution du produit des parties A à N, pas un produit distinct — son vocabulaire et son architecture ne remplacent donc pas les leurs. Ce qu'il apporte, ce sont des capacités absentes du socle, et le document dit lesquelles sont implémentées et lesquelles attendent encore une décision. |

`docs/cahier-des-charges.md` porte la partie A elle-même. Les compléments (partie D, puis parties E à N) déclarent chacun prendre le même rang que la partie A dans l'ordre de préséance. Le complément « atelier » fait exception : il ne déclare pas ce rang et ne l'a pas reçu, il est versé pour être lu, pas pour trancher. En cas de contradiction entre deux d'entre eux, le plus récent tranche lorsqu'il le dit explicitement — la partie J lève ainsi une exclusion posée par la partie G, la partie K fait seule foi sur les points ouverts, la partie L modifie A5.6 sur la propriété de `support` — et sinon la procédure d'arrêt de A2.2 s'applique.

**Une règle numérotée de la partie N est opposable** (N0) : elle se cite dans une revue de code et dans un test. Écrire `W4` ou `G5` dans un commentaire ou un nom de test désigne la règle, pas une intention.

### Partie M : absente du dépôt

Les parties L et N s'appuient sur une **partie M** — règles d'écran (M7), tranche d'écrans du socle, contrôles géométriques — qui n'a pas été versée dans `docs/`. Tant qu'elle manque :

- les renvois à M dans L et N ne sont pas vérifiables ;
- les onze règles de M7, citées comme la norme à laquelle tout nouvel écran se conforme, ne sont pas lisibles ;
- les écrans déjà construits l'ont été d'après deux maquettes (« Tranche M — Cinq écrans » et « Les Douze Modules ») et non d'après le texte de M.

Réclamer la partie M avant de spécifier un nouvel écran relève de A2.2.

**Collision de codes depuis le 17 septembre 2026.** Le complément « atelier » emploie `M1` à `M17` comme codes de ses propres modules, où `M7` désigne un générateur de plans. Le jeton `M7` a donc deux sens selon le document qui le porte. Comme une règle numérotée se cite en revue et en test (N0), un `M...` écrit seul dans un commentaire, un nom de test ou un message de commit est ambigu et n'est pas recevable : préciser « M7 (partie M) » ou « M7 (complément atelier) ». La même précaution vaut pour `R1` à `R6` du complément, qui entrent en collision avec les quatre règles d'intégration `R1` à `R4` de la partie L1.

**Troisième collision, relevée le 19 septembre 2026 : `P1` à `P7`.** Les treize principes opposables `P1` à `P13` du complément « atelier » portent les mêmes jetons que les sept règles métier `P1` à `P7` du module 03 de la partie N (N3.2), et n'en disent pas la même chose. `P1` désigne, selon le document, « tout objet porte une source et un statut » ou « les pondérations sont déclarées, jamais devinées ». La règle ci-dessus s'applique telle quelle : écrire « P1 (complément atelier) » ou « P1 (partie N) ». Les jetons `P8` à `P13` n'appartiennent qu'au complément et ne sont pas ambigus ; les préciser reste préférable, puisqu'une règle ajoutée à N3.2 les rendrait ambigus à son tour. Dans un champ `ruleRef`, la forme retenue est `atelier-P1`, déjà employée par `audit-parking.ts`.
