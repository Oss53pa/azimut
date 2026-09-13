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

Le cahier des charges principal et ses parties A à D ne sont pas dans ce dépôt. Le modèle de données, les contrats des moteurs et les tâches y sont définis, et il faut les demander plutôt que les reconstituer.

Les compléments présents dans `docs/` :

| Document | Objet |
| --- | --- |
| `docs/partie-e-edition-vectorielle.md` | Édition, capacités vectorielles, couche d'habillage. Contextes d'édition, quantification, modèle de commande, magnétisme, sélection accessible. |
| `docs/partie-f-interface-design.md` | Interface et système de design. Jetons de thème, échelles d'espacement et typographiques, contraste, ombrage isométrique, chrome de la borne. |
| `docs/partie-g-resolution-points-ouverts.md` | Méthode de chiffrage sans durées, budget de rendu adaptatif, saisie tactile et stylet, présence simultanée, métriques de police, chaîne colorimétrique. |
| `docs/partie-h-modules-manquants.md` | Carte complète des modules et tableau des messages, qui s'intercale entre le graphe et la composition. |
| `docs/partie-i-atelier-dessin.md` | Atelier de dessin, chaîne de transformation d'un plan en document fini, assistances, droits par module. |
| `docs/partie-j-stylet-pictogrammes.md` | Saisie à l'encre, couche d'esquisse, annotation de révision, éditeur de pictogrammes, bibliothèques à trois étages. |
| `docs/partie-k-registre-points-ouverts.md` | Registre consolidé des points ouverts. Remplace et fait seul foi contre les huit listes antérieures (C5, D18, E19, F19, G10, H14, I7, J10). |

Chacun de ces documents déclare prendre le même rang que la partie A dans l'ordre de préséance. En cas de contradiction entre deux d'entre eux, le plus récent tranche lorsqu'il le dit explicitement — la partie J lève ainsi une exclusion posée par la partie G, la partie K fait seule foi sur les points ouverts — et sinon la procédure d'arrêt de A2.2 s'applique.
