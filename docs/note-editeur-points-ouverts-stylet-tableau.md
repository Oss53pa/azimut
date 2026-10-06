# Note à l'éditeur du cahier : quatre points sans réponse dans le texte

Note d'arrêt au titre de A2.2. Chaque point a été rencontré en écrivant du
code. Aucune issue n'est appliquée avant la décision de l'éditeur. Le travail
qui en dépend est arrêté ; le reste avance.

## 1. Le profil de parcours d'un tableau des messages (M02.W6, R12, A7.1)

**Constat.** Le tableau des messages est unique par site :
`message_schedule` ne porte pas de colonne de profil. Le moteur, lui, génère
pour un seul profil, et le profil sert deux fois :

- `deriveDecisionPoints(site, profile, …)` donne les points de décision,
  c'est-à-dire les lignes qui existent ;
- `resolveFaceContent(…, profile, …)` appelle `computeRoute` pour chaque
  destination d'une face, ce qui donne la direction de la flèche et la
  distance.

Le cahier ne dit pas pour quel profil le tableau d'un site est généré. La
partie H veut le jalonnement « pour chaque parcours et chaque profil ». La vue
héritée prend le premier profil de la liste, ce qui figerait un choix
arbitraire en base.

**Ce qui a été envisagé avec l'utilisatrice.** Unir les points de décision de
tous les profils règle la première moitié : les lignes. Pas la seconde : deux
profils peuvent atteindre la même destination par deux chemins différents,
l'escalier pour l'un et l'ascenseur pour l'autre. Une même face devrait alors
porter deux directions pour une destination, et le texte ne dit pas laquelle
afficher ni comment montrer les deux.

**Trois issues :**

1. Un profil de référence par site, qui donne les directions et distances, et
   l'union des profils pour les points de décision. Demande de désigner ce
   profil en base (migration additive).
2. Une entrée par chemin quand les chemins divergent, la variante accessible
   marquée. Change le contenu des lignes et la mise en page.
3. Un tableau par profil. Demande une colonne de profil sur
   `message_schedule` et revoit l'approbation, qui porterait sur plusieurs
   tableaux.

**Arrêté en attendant.** La moitié génération de l'écran R : générer, générer
à nouveau, émettre pour revue.

## 2. La suppression d'un nœud ou d'une arête (M4, J1.2)

**Constat.** J1.2 donne le geste « trait barrant une forme : suppression de la
forme ». Il est fait pour les empreintes. M4 ne spécifie aucune suppression de
nœud ni d'arête : ni geste, ni commande, ni effet. Or retirer un élément du
graphe touche la validation de complétude (M02.W11) et marque des lignes
périmées (M02.W8).

**Question.** La suppression dans le graphe est-elle permise ? Si oui, avec
quelles règles : arêtes attenantes, liaisons verticales, points de décision,
supports implantés sur le nœud ?

## 3. Le menu de l'appui long (J1.5)

**Constat.** J1.5 donne « appui long pour le menu contextuel » sans dire ce que
le menu contient, dans aucun atelier.

**Question.** Quelles entrées, et par atelier ?

## 4. Le geste à deux doigts pendant le tracé (J1.5)

**Constat.** J1.5 contient deux phrases incompatibles :

- « Deux doigts pour déplacer et zoomer pendant que le stylet dessine » ;
- « rejet de la paume actif dès qu'un stylet est détecté, tout contact tactile
  étant alors ignoré ».

Pendant que le stylet dessine, un contact tactile est donc à la fois un geste
de navigation et un contact ignoré.

**Appliqué en attendant.** Ni l'une ni l'autre. Le doigt ne trace pas (G3.1),
la paume est ignorée pendant que le stylet est actif (G3.4), et la navigation
se fait à la molette, au bouton du milieu, à l'espace ou aux boutons.
