# Azimut — Règles de conduite

Ce fichier contient ce que la section C2 du cahier des charges lui assigne, et
rien de plus : les cinq invariants, les interdictions permanentes, les quatre
commandes de vérification, les cas d'arrêt obligatoire, le format de rapport de
fin de tâche, et le renvoi vers le cahier des charges pour tout le reste.

Il ne duplique ni le modèle de données ni les tâches. Un fichier de conduite qui
se met à contenir de la spécification cesse d'être lu.

## Invariants (A1.2)

Ces cinq règles ne se négocient dans aucune tâche. Toute proposition qui les
contredit est refusée, quelle qu'en soit la justification technique.

**INV-1. Source unique, rendus dérivés.**
Le site est modélisé une fois. Le plan technique, la vue isométrique, la vue en
plan simplifié, les plans muraux orientés, les panneaux, le parcours animé, le
quantitatif et le paquet de borne sont tous calculés depuis les mêmes données.
Aucun livrable n'est dessiné à la main. Aucune donnée n'est dupliquée pour les
besoins d'un rendu.

**INV-2. Un panneau est une vue, pas un dessin.**
Le contenu d'une face de support est résolu depuis le tableau des messages au
moment du rendu, et le tableau des messages est lui-même généré depuis le
graphe, le plan de jalonnement et l'annuaire (partie H, règle M02.W6 de la partie
N). Le contenu n'est jamais saisi librement, sauf pour les blocs explicitement
typés comme libres.

**INV-3. Le registre de sécurité est cloisonné.**
Aucune charte client ne peut modifier une couleur, une géométrie, un
pictogramme ou une proportion relevant du registre de sécurité. Le moteur
refuse l'opération et lève une erreur. Il n'avertit pas, il ne dégrade pas, il
refuse.

**INV-4. Le rendu est déterministe.**
Deux compilations d'un même état de données produisent des fichiers strictement
identiques, octet pour octet. Voir A9.

**INV-5. Aucune valeur réglementaire dans le code.**
Toute constante d'origine normative (hauteur de caractère minimale, ratio de
contraste, dimension de pictogramme, hauteur d'implantation) provient d'un
paquet de règles versionné, chargé en donnée. Écrire une telle valeur dans le
code source est une faute bloquante. Voir A2.4.

## Interdictions permanentes (A2.4)

- Écrire en dur une valeur d'origine normative. Voir INV-5.
- Écrire en dur une couleur hors du fichier de jetons de thème. Voir A11.
- Introduire une source d'indéterminisme dans un moteur. Voir A9.
- Contourner le cloisonnement par organisation, y compris en test.
- Committer un secret, une clé, une chaîne de connexion, un jeton.
- Committer une donnée client réelle, un plan réel, une charte réelle.
- Désactiver une règle de lint, ignorer un test, marquer un test en attente pour faire passer une tâche.
- Utiliser une fonctionnalité de la plateforme d'hébergement non disponible en installation autonome. Voir A3.4.
- Créer un fichier de plus de 400 lignes sans découpage.
- Employer `any` en TypeScript. `unknown` puis restriction de type.

## Vérification avant annonce (A2.3)

Une tâche n'est jamais annoncée terminée sans que les commandes suivantes aient
été exécutées et soient passées, dans cet ordre :

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:visual
```

Le rapport de fin de tâche indique la sortie réelle de ces commandes, pas un
résumé. Si une commande échoue, la tâche n'est pas terminée. Annoncer terminé
sans avoir exécuté les tests est la faute la plus grave prévue par le cahier
des charges.

Ce qui n'a pas pu être vérifié est indiqué explicitement, avec la raison.

## Arrêt obligatoire et demande (A2.2)

L'agent s'arrête et demande, au lieu de décider, dans les cas suivants :

1. Une valeur réglementaire, une norme ou un seuil manque et devrait venir d'un paquet de règles.
2. La tâche exige un choix de modèle de données non prévu en A5.
3. Deux exigences du cahier des charges se contredisent.
4. Une bibliothèque tierce nouvelle semble nécessaire.
5. Le respect d'un invariant A1.2 rend la tâche impossible telle qu'écrite.
6. Une donnée client réelle, un plan ou une charte serait nécessaire pour tester.
7. Une migration de base détruirait ou transformerait des données existantes.

Dans ces cas, l'agent produit une note courte décrivant l'alternative et attend.
Il ne choisit pas l'option qui lui semble raisonnable.

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

## Renvoi

Pour tout le reste — modèle de données, contrats des moteurs, conventions,
formats, algorithmes, écrans, modules, tâches, registre des points ouverts — le
**cahier des charges de développement consolidé** fait seul foi. Il porte les
parties A à Q et les annexes T et Z, et il se lit en commençant par sa section
A0.

Deux règles de ce document gouvernent la façon de s'en servir :

**Document unique.** La version consolidée remplace les seize documents
antérieurs. Ils ne font plus foi et ne doivent plus être consultés. Ceux qui
subsistent sous `docs/` sont conservés pour l'historique ; les lire pour
trancher une question est une faute.

**Aucune préséance à arbitrer.** Les corrections décidées au fil des versions
ont été reportées dans les sections qu'elles modifient, et chaque table n'a
qu'une seule définition. Une contradiction trouvée entre deux passages est un
défaut du document : l'agent s'arrête, la signale selon A2.2, et n'applique
aucune des deux versions.

L'annexe Z du document liste les corrections apportées à la consolidation.
Avant de reprendre du code écrit sous les documents antérieurs, la confronter à
cette annexe.
