# Jeu de démonstration

Ces fichiers portent un jeu de données **synthétique** pour les modules 05 à 10,
dont les entités ne sont pas encore au modèle A5 : emplacements publicitaires,
contrats, lots de fabrication, tournées, coûts de référence, sites du
portefeuille.

Trois règles tiennent cette frontière :

1. **Aucune donnée client réelle.** Les noms d'annonceurs, de fabricants et de
   sites sont inventés. Aucun plan, aucune charte, aucun contrat réel.
2. **Aucun calcul métier ici.** Les contrôles restent dans `domain/` et dans les
   moteurs : ces fichiers ne font que fournir les entrées que ces contrôles
   attendent déjà.
3. **Les types déclarés sont des modèles de vue, pas le modèle de données.**
   Ils décrivent ce qu'un écran affiche. Leur passage au modèle A5 — et donc à
   la base — relève d'une décision de modélisation qui n'est pas prise ici.

L'interface le dit : chaque écran servi par ce jeu porte la mention
« jeu de démonstration ».
