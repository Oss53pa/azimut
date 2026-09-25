# Jeux de démonstration du dépôt de référence

Les fichiers `reference-worksite.ts`, `reference-budget.ts`,
`reference-inspection.ts`, `reference-advertising.ts` et `reference-tenant.ts`
portent un jeu de données **synthétique** pour les modules 05 à 09. Ils tiennent
la place des tables de la famille C (migrations 0042 à 0046) quand aucune base
n'est configurée ; sur une base, les écrans lisent les tables.

Trois règles tiennent cette frontière :

1. **Aucune donnée client réelle.** Les noms d'annonceurs, de fabricants et de
   locataires sont inventés. Aucun plan, aucune charte, aucun contrat réel.
2. **Aucun calcul métier ici.** Les contrôles restent dans `domain/` et dans les
   moteurs : ces fichiers ne font que fournir les entrées que ces contrôles
   attendent déjà. Ce qui se compte (supports d'un lot, constats d'une tournée)
   n'y est pas stocké.
3. **Les types sont ceux du modèle.** Les jeux s'écrivent dans les types de
   `core-model` que la base remplit ; un écran n'a qu'un chemin de lecture.

L'interface le dit : un écran servi par le dépôt de référence porte la mention
« jeu de démonstration ».
