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
| AUTH.1 | Journal des changements de rôle en base | S | — | Bloqué, QA4 |
| AUTH.2 | Service d'authentification en CI, sur installation autonome | M | — | Bloqué, QA2 |
| AUTH.3 | Connexion et déconnexion au poste ; jeton porté par toutes les requêtes | M | AUTH.2 | Bloqué, QA1 |
| AUTH.4 | Identité, organisation et rôle lus de la session, à la place de `session-identity.ts` | M | AUTH.3 | Après AUTH.3 |
| AUTH.5 | Double authentification exigée **en base** pour `admin` et `owner_rep` | M | AUTH.2 | Après AUTH.2 |
| AUTH.6 | Enrôlement et vérification de la double authentification au poste | M | AUTH.3, AUTH.5 | Après AUTH.5 |
| AUTH.7 | Invitation, activation, réinitialisation, désactivation (O3) | L | AUTH.4 | Bloqué, QA3 |

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

### AUTH.5, pourquoi en base

O3 : « Un compte de ces rôles sans double authentification enrôlée ne peut
rien faire d'autre que l'enrôler. » Un garde dans l'interface se contourne en
appelant PostgREST directement. Le jeton d'une session porte son niveau
d'assurance. Une politique restrictive sur chaque table portant `org_id` peut
donc refuser toute lecture et toute écriture aux membres `admin` ou
`owner_rep` dont la session n'a pas le second facteur. C'est le même motif
que les politiques de l'`auditor` en 0076.

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

## 5. Ce que cette note ne fait pas

Elle ne donne aucune durée (G1.1). Elle ne tranche aucune question de la
section 4. AUTH.0 était le seul lot qui ne demandait aucune décision ; il est
fait.
