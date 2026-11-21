# Découpage du lot d'authentification

Note de découpage au sens de G1.2. Elle répond à la décision Q9 d'Oss53pa
(21 novembre 2026, `decoupage-s6-edition-simultanee.md`) : l'authentification
passe avant la suite de S6. Elle ne modifie pas le cahier et n'ajoute aucune
règle.

Établie le 21 novembre 2026, sur `09030ae`.

---

## 1. Ce que le cahier demande

| Source | Exigence |
| --- | --- |
| A3 | « Authentification : Supabase Auth » |
| T-0.5 | Supabase Auth, table des membres, sept rôles de A6.2. Un utilisateur sans organisation ne voit rien. Changement de rôle journalisé |
| A6.3 | Double authentification obligatoire pour `admin` et `owner_rep`. OWASP ASVS niveau 2 |
| O3 | Invitation par lien à usage unique et durée limitée ; activation avec enrôlement de la double authentification, sans laquelle le compte ne peut rien faire d'autre ; réinitialisation journalisée ; désactivation, jamais suppression ; le dernier administrateur ne se destitue pas |
| L4.1 | Administration et invitations, placées à l'incrément 4 |
| A3.4 | Tout doit fonctionner sur une installation Supabase autonome, et la CI doit le vérifier |

G1.3 classe « Authentification et rôles » en taille S. Ce classement datait
d'avant O3, qui ajoute à lui seul l'invitation, l'activation, la
réinitialisation et le départ. [Probable] Avec O3, l'ensemble est XL et doit
être découpé.

---

## 2. Existant constaté

| Élément | État |
| --- | --- |
| Identité en base | `azimut.current_user_id()` lit un réglage de session, sinon `auth.uid()` (0024) |
| Cloisonnement | En place, éprouvé par PostgREST avec des jetons signés par le banc (`postgrest-harness.ts`) |
| Écriture de `membership` | Retirée au rôle applicatif (0075). Un rattachement est un acte d'exploitation |
| Rôle `marketing` | Listé en A5.1, **absent** de la contrainte `membership.role` posée en 0002 |
| Journal des changements de rôle | Absent. Aucun code n'écrit `audit_log` en base |
| Poste | Aucune connexion. Clé publique en guise de jeton, organisation et rôle écrits en dur (`apps/studio/src/app/session-identity.ts`) |
| Client d'authentification | Aucun : ni `@supabase/supabase-js`, ni `@supabase/auth-js` |
| CI | PostgreSQL et PostgREST seulement, aucun service d'authentification |

---

## 3. Lots

| Lot | Objet | Taille | Dépend de | État |
| --- | --- | --- | --- | --- |
| AUTH.0 | Aligner la contrainte des rôles sur A5.1 (`marketing`) | S | — | Fait, migration 0079 |
| AUTH.1 | Journal des changements de rôle en base | M | — | Bloqué, QA5 |
| AUTH.2 | Service d'authentification en CI, sur installation autonome | M | — | Fait |
| AUTH.3 | Connexion et déconnexion au poste ; jeton porté par toutes les requêtes | M | AUTH.2 | Fait |
| AUTH.4 | Identité, organisation et rôle lus de la session, à la place de `session-identity.ts` | M | AUTH.3 | Fait |
| AUTH.5 | Double authentification exigée **en base** pour `admin` et `owner_rep` | M | AUTH.2 | Fait, migration 0080 |
| AUTH.6 | Enrôlement et vérification de la double authentification au poste | M | AUTH.3, AUTH.5 | Fait |
| AUTH.7 | Invitation, activation, réinitialisation, désactivation (O3) | L | AUTH.4 | Après AUTH.4, QA3 tranchée |

Les lots AUTH.0 à AUTH.6 suffisent à débloquer S6.4, S6.6b et S6.7. AUTH.7
peut suivre, comme le cahier le place à l'incrément 4 avec L4.1.

### AUTH.0, fait le 21 novembre 2026

Migration `0079_a6_2_marketing_role`. Ajouter le rôle sans plus lui aurait
donné, sous le cloisonnement générique, les droits d'un `designer`. A6.2 dit
au contraire « aucun accès aux autres modules », et le module de P9 n'existe
pas. Le rôle entre donc avec un refus total : une politique restrictive par
table portant `org_id`, et sur les cinq tables en insertion seule, le refus
porté par leurs politiques de lecture et d'insertion, comme pour l'`auditor`
en 0076. Seule la lecture de ses propres rattachements lui reste. Les droits
de P9 se poseront avec ce module.

### AUTH.2, fait le 21 novembre 2026

Le service d'authentification de Supabase, version 2.177.0, empreinte
vérifiée, entre en CI. `scripts/monter-base-authentification.sh` monte une
seconde base, `azimut_auth` : le service y migre son schéma `auth`, puis le
corpus s'applique sans le préalable de `bootstrap-standalone.sql`, avec lequel
ce schéma ne cohabite pas. Les 83 migrations passent sur ce schéma réel.

L'essai `auth-2-connexion-reelle` obtient un jeton du service et le présente
à PostgREST : le jeton porte l'identité, le rôle et le niveau d'assurance
(`aal`) ; cette identité ne voit que son organisation ; sans jeton, rien ne se
lit ; une phrase de passe fausse n'obtient rien. Vérifié aussi à la main : une
écriture par `apply_journaled_commands` sous ce jeton inscrit l'identifiant
réel comme auteur.

Non vérifié : l'exécution de ces étapes par la CI elle-même. Le script et la
suite ont tourné ici, contre les mêmes binaires.

### AUTH.3, fait le 21 novembre 2026

`@supabase/auth-js` 2.119.0, inscrit au registre. Avec
`VITE_AZIMUT_AUTH_URL`, l'atelier demande une connexion avant tout écran
(`apps/studio/src/auth/AuthGate.tsx`) ; sans elle, il reste en mode local, et
les essais de bout en bout parcourent ce mode. Toutes les requêtes — lectures,
émetteurs, journal — présentent le jeton de la session au lieu de la clé
publiable (`access-token.ts`). La session se garde dans le stockage de
l'onglet et meurt avec lui. Un refus du service se dit d'un seul message ;
une requête qui n'aboutit pas se dit « service injoignable », sans accuser la
saisie.

Éprouvé par le code de l'atelier contre le vrai service et le vrai PostgREST,
puis dans un navigateur : connexion, site lu, session gardée au rechargement,
déconnexion.

**À savoir pour le déploiement.** Sans passerelle devant lui, le service
autonome refuse à la requête préalable CORS les en-têtes que le client envoie.
Il faut lui donner `GOTRUE_CORS_ALLOWED_HEADERS=apikey,x-client-info,x-supabase-api-version`.
Dans une installation Supabase complète, la passerelle s'en charge.

### AUTH.4, fait le 21 novembre 2026

Les écrans écrivent sous l'organisation et le rôle du rattachement de
l'utilisateur, lus dans `membership` (`auth/identity.ts`,
`auth/IdentityGate.tsx`). Sans rattachement, l'écran le dit et n'ouvre rien
(T-0.5). Avec un seul, il est retenu d'office ; avec plusieurs, l'utilisateur
choisit et peut revenir sur son choix. Les valeurs écrites en dur ne servent
plus qu'au mode local.

**Limite connue.** Un utilisateur de plusieurs organisations voit dans la
liste des sites ceux de toutes ses organisations, et la base refusera toute
écriture sur un site d'une autre organisation que celle choisie. Filtrer la
liste par l'organisation choisie relève de L4.1, multi-organisations complet,
placé à l'incrément 4.

### AUTH.6, fait le 21 novembre 2026

Un `admin` ou un `owner_rep` connecté passe par l'écran du second facteur
avant l'atelier (`auth/MfaGate.tsx`) : sans facteur, il en enrôle un, TOTP,
par code QR ou clé saisie à la main ; avec un facteur, il saisit son code. Le
jeton `aal2` que délivre alors le service devient le jeton de toutes les
requêtes. Les autres rôles ne voient pas cet écran. Le code QR est rendu par
une balise d'image, jamais inséré comme balisage.

Éprouvé contre le vrai service, puis dans un navigateur : écran affiché,
code QR chargé, code faux refusé, code calculé depuis la clé affichée
accepté, site lu ensuite.

Le nom d'une organisation où le membre est `admin` ne se lit pas en `aal1`
(0080) ; l'écran de choix d'organisation affiche alors « organisation
protégée par le second facteur ».

### AUTH.5, pourquoi en base

O3 : « Un compte de ces rôles sans double authentification enrôlée ne peut
rien faire d'autre que l'enrôler. » Un garde dans l'interface se contourne en
appelant PostgREST directement. Le jeton d'une session porte son niveau
d'assurance. Une politique restrictive sur chaque table portant `org_id` peut
donc refuser toute lecture et toute écriture aux membres `admin` ou
`owner_rep` dont la session n'a pas le second facteur. C'est le même motif
que les politiques de l'`auditor` en 0076.

**Fait le 21 novembre 2026**, migration `0080_a6_3_mfa_required`.
`session_meets_mfa()` lit le niveau d'assurance du jeton que PostgREST pose ;
`org_ids_lacking_mfa()` rend les organisations où la session est `admin` ou
`owner_rep` sans second facteur ; chaque table portant `org_id` les refuse.
Une session serveur, qui pose elle-même `azimut.current_user_id`, n'y est
pas tenue : elle n'a pas de jeton et peut déjà se donner toute identité.

Éprouvé avec le vrai service : un `admin` en `aal1` ne lit rien ; il enrôle
un facteur TOTP, le vérifie, et son jeton `aal2` lui rend son organisation.

---

## 4. Questions à trancher (A2.2)

**QA1. Client d'authentification, A2.2 cas 4.** Deux voies :

- `@supabase/auth-js`, client officiel, sans le reste de `supabase-js`. C'est
  une dépendance nouvelle et distribuée, qui passe par la procédure de D16 et
  le registre des dépendances. Le code sensible (rafraîchissement du jeton,
  facteurs, défis) est éprouvé ailleurs ;
- des appels `fetch` à l'API REST du service, sans dépendance. Ce code
  sensible serait écrit et maintenu ici.

Recommandation : `@supabase/auth-js`. Le code de sécurité écrit à la main est
le risque qu'ASVS demande d'éviter.

**QA2. Service d'authentification en CI, A3.4.** A3.4 exige que la CI vérifie
l'installation autonome. Il faut ajouter le conteneur du service
d'authentification de Supabase, avec une version figée et vérifiée comme
PostgREST. Sans lui, AUTH.3 à AUTH.7 ne s'éprouvent nulle part.

**QA3. Où vivent les actes d'administration, A2.2 cas 2.** Inviter,
désactiver ou réinitialiser passe par l'API d'administration du service, qui
exige la clé de service. Cette clé ne peut pas aller au navigateur. Trois
voies :

- une fonction serveur Supabase (Edge Function), disponible en installation
  autonome et prévue par A3 pour les tâches courtes. Recommandée ;
- le service de compilation, auquel A3 ne donne que l'orchestration des
  moteurs ;
- des actes d'exploitation scriptés, sans écran, jusqu'à L4.1.

**QA4. Auteur d'un changement de rôle fait par l'exploitation, A2.2 cas 3.**
Depuis 0075, un rattachement ne s'écrit que sous le rôle propriétaire, sans
utilisateur courant. Or `audit_log` refuse une entrée qui n'est pas au nom de
l'utilisateur courant (0076). Un déclencheur sur `membership` ne peut donc
pas journaliser un changement fait par l'exploitation. Deux voies : exiger
que l'exploitation pose son identité avant d'écrire, ce qui refuse tout
changement anonyme ; ou admettre au journal un auteur vide pour les seuls
actes d'exploitation, marqués comme tels.

---

## 4 bis. Décisions d'Oss53pa, 21 novembre 2026

| Question | Décision |
| --- | --- |
| QA1 | `@supabase/auth-js`, version figée, inscrit au registre des dépendances |
| QA2 | Le service d'authentification de Supabase entre en CI, version et empreinte figées |
| QA3 | Les actes d'administration d'O3 vivent dans une fonction serveur Supabase ; la clé de service ne quitte pas le serveur |
| QA4 | Tout changement de rattachement exige l'identité de son auteur ; un changement anonyme est refusé en base |

**QA5. Le journal des rôles contre les décors d'essai, apparu le 21 novembre
2026.** Journaliser chaque changement de `membership` dans `audit_log`, table
en insertion seule, a deux effets que QA4 ne tranchait pas :

- 21 fichiers d'essai rattachent ou retirent des membres sans poser
  d'identité. Avec l'identité exigée, tous échouent ;
- plusieurs suites committent leur décor puis le retirent (`a10-4`,
  `write-path`, d'autres). Chaque retrait de membre laisserait au journal une
  ligne que rien ne peut supprimer, et `deleteOrgFixture`, qui refuse de
  retirer une organisation dont une table en insertion seule porte encore des
  lignes, échouerait ensuite à chaque exécution.

Il faut donc soit faire passer toutes ces suites en transactions annulées,
ce qui revient à réécrire les décors de 21 fichiers, soit réserver le journal
aux changements faits sous le rôle applicatif, ce qui laisse les actes
d'exploitation non journalisés, soit attendre la fonction serveur de QA3 : elle
deviendrait alors la seule voie d'écriture de `membership`, et c'est elle qui
journaliserait.

## 5. Ce que cette note ne fait pas

Elle ne donne aucune durée (G1.1). Elle ne tranche aucune question de la
section 4. AUTH.0 était le seul lot qui ne demandait aucune décision ; il est
fait.
