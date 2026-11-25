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

## B1 à B5, faits le 25 novembre 2026

**Base (0085).** `graph_revision` compte toute écriture d'un nœud, d'une arête
ou d'une liaison verticale, par déclencheurs, et porte la dernière révision
validée par le service avec le passage qui l'atteste. Seul le service peut
l'enregistrer : `record_service_validation` exige une session du service
(`session_is_compiler`, rôle de connexion, que `SET ROLE` ne change pas). Une
garde refuse en `PT412` (HTTP 412) la soumission `draft` → `in_review` tant que
la révision validée n'est pas la révision actuelle avec un passage réussi. Les
passages écrits par des postes restent en base et ne comptent plus (QB3).
Aucune table existante n'est modifiée ; `graph_validation` est inchangée.

**Service (B3).** Le travail `audit_site` est branché dans le service : il lit
le site et la révision de son graphe dans un même instantané (REPEATABLE READ,
lecture seule), sous l'identité du demandeur, fait l'audit, valide le graphe,
calcule l'empreinte, inscrit le passage et l'enregistre
(`apps/compiler/src/audit-site-job.ts`, `packages/db/src/service-validation.ts`).

**Poste (B5).** Sous une session ouverte, « Lancer la validation » demande le
travail au service, en suit l'état, relit le passage du service et relit la
session (`app/useServiceValidation.ts`) ; l'écran dit si la demande est en
file, en cours, sans réponse après deux minutes, ou en échec. Sans base, le
calcul reste au poste (M8, partie M, critère 3). Un refus 412 se dit
`GRAPH.NOT_VALIDATED`, le code de R12.

**Éprouvé.** Base : 7 essais (`m02-w11-barriere`), qui mordent : sans la garde,
quatre refus tombent. Service : 4 essais de bout en bout (`audit-site-job`),
dont l'ouverture de la soumission après le passage et sa fermeture après une
modification du graphe. Navigateur, service lancé en local contre la base du
banc : la demande part, le travail réussit, l'écran affiche le passage du
service en 2,5 secondes environ.

## À savoir avant toute fusion vers `master`

**Le service de compilation n'est déployé nulle part.** La chaîne ne publie que
le studio (Cloudflare) ; le service Node que A3 prévoit (`apps/compiler`) n'a
ni hôte ni étape de déploiement dans ce dépôt. Sans lui, aucun travail n'est
traité, et la garde de 0085 ferme la soumission de tout tableau des messages.
Cette branche ne doit pas rejoindre `master` avant que le service tourne
contre la base de production. Les travaux existants (paquets de borne,
livrables) sont dans le même cas.
