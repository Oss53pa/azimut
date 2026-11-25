# Barrière de validation tenue par la base

Note de travail, ouverte le 24 novembre 2026. Elle ne fait pas foi : le
cahier des charges consolidé (`docs/cahier-des-charges.md`) seul fait foi.

## Le constat

M02.W11 : « Le tableau des messages ne peut être émis pour revue que si la
validation de complétude du graphe est passée, c'est-à-dire si le dernier
enregistrement de `graph_validation` du site est passé et porte l'empreinte du
graphe actuel. » R12 (ligne 7773) place cette condition sur la transition
`draft` → `in_review`.

Elle n'est tenue qu'au poste :

1. aucune garde en base sur `message_schedule.state` : un client qui écrit la
   table directement soumet un tableau sur un graphe jamais validé ;
2. `graph_validation` est écrite par le poste lui-même : son « passé » et son
   empreinte sont ce que le poste déclare. La base ne peut pas les vérifier, la
   validation et l'empreinte n'existant qu'en TypeScript.

Constaté en S6.5 (`docs/decoupage-s6-edition-simultanee.md`), où l'édition
simultanée rend la course réelle : un poste valide, un autre modifie, le
premier soumet.

## Décision d'Oss53pa

| Question | Décision |
| --- | --- |
| QB0 | La validation est faite par le service : le poste la demande, le service rejoue `validateGraph` et l'empreinte, et lui seul écrit `graph_validation`. Une garde en base refuse la soumission sans passage réussi du service, valant pour le graphe actuel |

## Ce qui manque à la base pour tenir la garde

La base ne sait pas calculer l'empreinte. Pour savoir qu'un passage vaut pour
le graphe actuel, il lui faut une donnée qu'elle tient elle-même : un compteur
de révision du graphe du site, incrémenté par la base à chaque écriture d'un
nœud, d'une arête ou d'une liaison verticale (les trois parties de
l'empreinte, `compute-hashes.ts`). Le service enregistre la révision qu'il a
lue avec le site qu'il a validé ; la garde compare.

## Lots

| Lot | Objet | Taille | Dépend de |
| --- | --- | --- | --- |
| B1 | Révision du graphe par site, tenue par la base (déclencheurs sur `node`, `edge`, `vertical_link`) | S | QB1 |
| B2 | `graph_validation` écrite par le service seul ; la révision validée y est enregistrée | S | B1, QB3 |
| B3 | Travail du service : charger le site et sa révision dans un même instantané, valider, calculer l'empreinte, écrire le passage | M | B2, QB2 |
| B4 | Garde en base sur les transitions du tableau des messages | S | B2, QB4 |
| B5 | Poste : « Lancer la validation » demande le travail et en suit l'issue ; l'écriture directe disparaît | M | B3 |

## Questions (A2.2), réponses d'Oss53pa du 24 novembre 2026

| Question | Décision |
| --- | --- |
| QB1 | Une table `graph_revision (site_id, org_id, revision, changed_at)`, tenue par déclencheurs ; aucune table existante n'est modifiée. Absente de A5, signalée à l'éditeur |
| QB2 | Le travail `audit_site`, déjà dans A5.10 et qui rejoue déjà `validateGraph`, écrit en plus le passage de `graph_validation`. Aucune nature nouvelle |
| QB3 | Sans préférence d'Oss53pa. Retenu, comme conséquence de QB0 : les passages écrits par des postes restent en base (insertion seule, rien n'est détruit) mais ne comptent plus ; seul un passage du service ouvre la soumission. Chaque site en cours sera revalidé une fois |
| QB4 | La garde ne contrôle que la soumission, `draft` → `in_review`, comme M02.W11 et R12 |
