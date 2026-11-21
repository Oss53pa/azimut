# S6.0 — Transport de la propagation des commandes

Note d'exploration au sens de G1.2 : le livrable est une note, pas du code.
Elle prépare la question Q4 de `decoupage-s6-edition-simultanee.md` et ne la
tranche pas. Le choix revient à Oss53pa, et à l'éditeur s'il exige une
dépendance nouvelle (A2.2, cas 4 ; D16).

Établie le 21 novembre 2026. Les niveaux de confiance suivent la convention
[Confirmé] (vu dans le dépôt ou le texte), [Probable] (déduction fiable,
non mesurée), [Supposition].

---

## 1. Ce que le transport doit tenir

| Exigence | Source |
| --- | --- |
| Ne propager que des commandes validées | S-19 |
| Aucune commande perdue, aucune appliquée deux fois après une coupure | S6.6 |
| Ordre identique pour tous les postes d'un même niveau | A9, S6.3 |
| Aucune commande d'une autre organisation reçue ni détectable | A6.1 |
| Autorisation en base, jamais seulement dans l'interface | règle permanente |
| Fonctionne sur une installation Supabase autonome, vérifié par la CI | A3.4 |
| Point d'entrée exposé : limitation de débit, seuils en configuration | règle permanente |

---

## 2. Constats sur le dépôt

- [Confirmé] La CI ne monte pas une pile Supabase complète. Elle lance
  `postgres:16` et un PostgREST téléchargé (`.github/workflows/ci.yml`). Aucun
  service de diffusion n'y tourne.
- [Confirmé] Le studio parle à la base par PostgREST et `fetch`. Il n'a aucun
  client Supabase (`apps/studio/package.json`).
- [Confirmé] `packages/db` dépend déjà de `postgres` (postgres.js), autorisé et
  figé. Cette bibliothèque sait écouter `LISTEN`.
- [Confirmé] Le service de compilation n'expose aucun point d'entrée HTTP. Il
  consomme une file en base (`apps/compiler/src/db-queue.ts`), et A3 le
  limite à l'orchestration des moteurs.
- [Confirmé] `supabase/config.toml` active `[realtime]`, mais seulement pour
  l'environnement local de la CLI Supabase.

---

## 3. Le constat qui change la question

[Probable] Aucune des trois voies ci-dessous ne garantit à elle seule la
livraison sans perte. Le service de diffusion Supabase ne rejoue pas ce qui a
été émis pendant une coupure. `NOTIFY` ne retient rien pour un écouteur
déconnecté. Une interrogation périodique ne perd rien, mais seulement parce
qu'elle relit une source durable.

La garantie vient donc du **journal S6.2**, avec un numéro d'ordre par niveau :
un poste demande « tout ce qui suit le numéro *n* », par PostgREST, sous les
politiques de cloisonnement. Le transport ne transporte plus de commande : il
**sonne**, pour dire qu'il y a du nouveau. Perdre une sonnerie coûte un délai,
jamais une commande.

Cette architecture règle trois exigences sans dépendre du transport :

- reprise après coupure : relire depuis le dernier numéro appliqué ;
- doublon : un numéro déjà appliqué est ignoré ;
- cloisonnement : la lecture passe par la base et ses politiques, comme toute
  lecture.

Le choix du transport ne porte alors plus que sur la latence, le coût et la
conformité à A3.4.

---

## 4. Les trois voies

### Voie A — service de diffusion de Supabase (Realtime)

- [Probable] Le service est libre et fait partie de la distribution autonome.
  A3.4 ne l'exclut donc pas en principe.
- [Confirmé] La CI ne le fait pas tourner. A3.4 exige que la CI le vérifie.
  Il faudrait y ajouter le conteneur du service et sa configuration de
  réplication logique.
- [Confirmé] Le studio n'a pas de client pour ce service. Il faudrait soit une
  bibliothèque nouvelle (`@supabase/realtime-js` ou `@supabase/supabase-js`),
  soit une implantation à la main de son protocole sur WebSocket.
- [Probable] Le mode « changements de la base » repose sur la réplication
  logique, qui demande `wal_level = logical` et une publication dédiée. Le
  cloisonnement de ce mode s'appuie sur les politiques de la table, ce qui
  respecte la règle d'autorisation en base.
- [Supposition] Le mode « diffusion » sans persistance exigerait des
  politiques propres au service, dont la présence dans la version autonome
  reste à vérifier.

Coût : une dépendance nouvelle, un conteneur de plus en CI, un réglage de la
base. Latence : la plus faible des trois.

### Voie B — `LISTEN` relayé par un service

- [Confirmé] postgres.js, déjà autorisé, écoute `LISTEN` côté serveur.
- [Confirmé] La charge utile de `NOTIFY` est bornée à 8 000 octets. Une
  commande peut atteindre 1 048 576 caractères (`MAX_WIRE_COMMAND_LENGTH`).
  La notification ne peut donc porter qu'un numéro, ce qui rejoint la
  section 3.
- [Probable] Côté navigateur, les événements envoyés par le serveur
  (`EventSource`) suffisent, sans bibliothèque. Côté serveur, `node:http`
  suffit.
- [Confirmé] Ce serait le premier point d'entrée HTTP du service de
  compilation, ou un service nouveau. Il faut alors une limitation de débit
  et une authentification.
- [Probable] Le relais doit savoir à qui il sonne. S'il le décide lui-même,
  l'autorisation sort de la base. Pour l'éviter, il ne sonne qu'un identifiant
  de niveau, sans contenu, à un poste qui a d'abord prouvé par PostgREST, sous
  son jeton, qu'il lit ce niveau.
- [Probable] Une connexion d'écoute doit être une session directe : un
  regroupeur de connexions en mode transaction ne relaie pas `LISTEN`.

Coût : aucune dépendance nouvelle, mais un point d'entrée exposé de plus, à
sécuriser. Il entre dans la CI actuelle, qui a Postgres. Latence : faible.

### Voie C — interrogation périodique du journal

- [Confirmé] PostgREST et `fetch` suffisent, déjà en place au studio comme en
  CI.
- [Probable] Elle n'ajoute ni dépendance, ni service, ni point d'entrée. Le
  cloisonnement reste entièrement celui des politiques.
- [Probable] La latence vaut au plus l'intervalle d'interrogation, une
  constante nommée et réglable, sans origine normative.
- [Probable] La charge reste faible au regard de G4.1, qui décrit le besoin
  réel : « une à deux personnes modélisent un site ». Deux postes qui
  interrogent chaque seconde font deux requêtes par seconde par niveau ouvert.

Coût : le plus bas. Latence : la plus haute, bornée par l'intervalle.

---

## 5. Comparaison

| Critère | A. Realtime | B. LISTEN relayé | C. Interrogation |
| --- | --- | --- | --- |
| Dépendance nouvelle | oui (Q4) | non | non |
| Vérifiable par la CI actuelle | non, conteneur à ajouter | oui | oui |
| Point d'entrée exposé nouveau | non (celui de Supabase) | oui | non |
| Autorisation | politiques de la table | à déléguer à la base, voir 4.B | politiques de la table |
| Reprise sans perte | par le journal | par le journal | par le journal |
| Latence | basse | basse | intervalle |
| Réglage de la base | réplication logique | aucun | aucun |

---

## 6. Recommandation, à arbitrer

Commencer par la **voie C**, avec une sonnerie remplaçable.

- [Probable] Elle satisfait toutes les exigences de la section 1 sans
  dépendance, sans service et sans point d'entrée nouveaux. C'est aussi la
  seule qui ne demande rien de plus à la CI de A3.4.
- [Probable] La sonnerie se déclare comme une interface. La voie A ou la voie
  B pourra la remplacer plus tard sans toucher au journal ni au moteur S6.3,
  si la latence mesurée déçoit.

Le risque de cette recommandation : une latence perçue comme trop lente par
deux concepteurs qui travaillent côte à côte. Elle se mesure selon D13 sur le
premier site réel, et c'est cette mesure, pas une préférence, qui justifierait
de passer à A ou B.

---

## 7. Ce que cette note ne fait pas

- Elle ne mesure rien. Le conteneur de cette session n'a ni service Docker ni
  base locale, et la CI n'a pas de service de diffusion. Les latences et les
  comportements après coupure de la section 4 sont des déductions, pas des
  relevés.
- Elle ne tranche pas Q4.
- Elle ne débloque pas S6.6 : la voie retenue s'appuie sur le journal S6.2,
  qui attend Q1.
