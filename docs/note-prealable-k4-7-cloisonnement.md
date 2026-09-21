# Note — préalable K4 nº 7 : cloisonnement sur agrégats et jointures profondes

**Statut : préalable fermé, avec quatre défauts à corriger avant la tranche 1.**

Livrable du sujet « Cloisonnement sur agrégats et jointures profondes », registre
partie K, section K3.3, niveau de blocage **P** — bloque avant la première ligne
de code. Conformément à K3.3, le livrable est cette note, pas du code.

---

## 1. Ce qui a été fait

Une grappe PostgreSQL 16 a été montée localement, hors de tout projet réel et
hors de toute donnée client. Les **27 migrations** du dépôt y ont été appliquées
dans l'ordre lexicographique : 55 tables, 55 politiques de sécurité par ligne.

Deux organisations fictives ont été amorcées, étanches par construction, avec des
volumes délibérément dissemblables pour qu'une fuite se voie dans un agrégat :

| Organisation | Sites | Arêtes | Somme des longueurs |
| --- | --- | --- | --- |
| Org A | 1 | 1 | 5 m |
| Org B | 1 | 3 | 27 m |

Douze formes de requête ont été exécutées, choisies pour couvrir exactement ce que
le sujet nomme — les agrégats et les jointures profondes — et les voies par
lesquelles un cloisonnement par ligne se contourne d'ordinaire.

---

## 2. Résultat principal : le cloisonnement tient

Sous le rôle `authenticated`, avec la revendication d'identité d'un utilisateur
membre de la seule Org A, les douze formes sont correctement cloisonnées.

| Forme | Attendu (Org A) | Obtenu | |
| --- | --- | --- | --- |
| Sélection simple | 1 site | 1 (« Site A ») | ✓ |
| Agrégat `COUNT` | 1 arête | 1 | ✓ |
| Agrégat `SUM` | 5 m | 5 | ✓ |
| Agrégat sans clause de restriction | 1 organisation | 1 | ✓ |
| Jointure à 3 niveaux | 1 | 1 | ✓ |
| **Jointure à 5 niveaux avec `SUM`** | **5 m** | **5** | ✓ |
| Sous-requête corrélée `EXISTS` | 1 | 1 | ✓ |
| Expression de table récursive | 2 nœuds | 2 | ✓ |
| Fonction de fenêtrage | rang max 1 | 1 | ✓ |
| `UNION ALL` sur deux tables | 2 | 2 | ✓ |
| Jointure vers l'annuaire des comptes | 1 | 1 | ✓ |
| Agrégat par organisation | « Org A » | « Org A » | ✓ |

La jointure à cinq niveaux suivie d'une somme est la forme que le sujet visait :
elle rend 5 et non 32. Aucune forme n'a laissé fuir une ligne de l'Org B.

**Le préalable est donc fermé sur sa question.** Les agrégats et les jointures
profondes ne franchissent pas la frontière d'organisation.

---

## 3. Mais ce résultat n'est pas celui du dépôt : quatre défauts

Le résultat ci-dessus vaut *sous le rôle `authenticated`*. Quatre constats, chacun
vérifié sur la même base, font qu'aujourd'hui le dépôt n'est pas dans cet état.

### 3.1 Le propriétaire des tables voit tout — et c'est ainsi que l'application se connecte

52 des 55 tables ont la sécurité par ligne activée mais **non forcée**
(`FORCE ROW LEVEL SECURITY` absent), et les 55 appartiennent au rôle `azimut`.
En PostgreSQL, le propriétaire d'une table contourne les politiques tant que
`FORCE` n'est pas posé.

La même sonde, exécutée sans changer de rôle, donne :

| Forme | Sous `authenticated` | Sous le propriétaire |
| --- | --- | --- |
| Sélection de sites | 1 — « Site A » | **2 — « Site A, Site B »** |
| `SUM` des longueurs | 5 | **32** |
| Jointure à 5 niveaux | 1 | **4** |
| Agrégat par organisation | « Org A » | **« Org A, Org B »** |

`packages/db/src/connection.ts` ouvre la connexion depuis une seule chaîne, sans
changement de rôle et sans propagation de l'identité de l'utilisateur agissant.
Rien n'y prend jamais le rôle `authenticated`, et rien n'y renseigne la
revendication que `auth.uid()` lit. **En l'état, le cloisonnement est inerte.**

### 3.2 Aucune migration ne porte de droit

Il n'y a **pas un seul `GRANT`** dans les 27 migrations. Le rôle `authenticated`,
auquel toutes les politiques sont adressées, n'a aucun droit sur le schéma.
Les politiques ne sont donc jamais exercées en installation autonome : elles
décrivent une intention que rien n'applique.

### 3.3 Trois tables n'ont aucune politique, et elles portent `org_id`

| Table | Créée par | Sécurité par ligne | Politiques |
| --- | --- | --- | --- |
| `approval` | `0009_approval_insert_only` | **non activée** | **0** |
| `support_typology` | `0015_a5_6_support_typology_version` | **non activée** | **0** |
| `support_version` | `0015_a5_6_support_typology_version` | **non activée** | **0** |

Les trois portent une colonne `org_id` : elles sont destinées à être cloisonnées.
Elles ne le sont pas, et pas même sous `authenticated`.

La cause est structurelle, pas accidentelle. La migration `0007` active la
sécurité par ligne sur les tables qui existaient alors, nommément. Toute table
créée après doit s'en charger elle-même. `0010`, `0018`, `0019`, `0020` et `0021`
l'ont fait ; `0009` et `0015` l'ont oublié. Le dispositif est en adhésion
volontaire, là où il devrait être par défaut.

### 3.4 Trois clés étrangères pointent vers la plateforme d'hébergement

| Fichier | Ligne | Référence |
| --- | --- | --- |
| `0002_a5_1_organization_access.up.sql` | 26 | `membership.user_id → auth.users(id)` |
| `0006_a5_5_to_a5_10_remaining.up.sql` | 100 | `proof.reviewer_id → auth.users(id)` |
| `0006_a5_5_to_a5_10_remaining.up.sql` | 292 | `audit_log.actor_id → auth.users(id)` |

`auth.users` n'existe pas en installation autonome. L'essai n'a pu appliquer les
migrations qu'après avoir fabriqué cette table : neuf migrations sur vingt-sept
échouaient sans elle, en cascade. C'est un manquement à A2.4, « Utiliser une
fonctionnalité de la plateforme d'hébergement non disponible en installation
autonome », et il est dans le socle, là où la tranche 1 doit écrire.

---

## 4. Constat annexe : critère 9 de T-2.14a, à moitié acquis

La même base a permis d'éprouver le critère d'acceptation nº 9 de la tâche
T-2.14a — « une tentative de modification et une tentative de suppression d'une
ligne d'approbation échouent au niveau de la base, avec le rôle d'administration ».

| Tentative, avec le rôle propriétaire | Résultat |
| --- | --- |
| `UPDATE` d'une ligne d'approbation | **refusée** — « approval records are insert-only and cannot be modified or deleted » |
| `DELETE` d'une ligne d'approbation | **refusée** — même message |
| `TRUNCATE` de la table | **acceptée — la table est vidée** |

Les deux déclencheurs posés par `0009` sont des déclencheurs par ligne. `TRUNCATE`
ne les déclenche pas. L'insertion seule n'est donc pas garantie au niveau de la
base, contrairement à ce que la consigne exige. Il y manque un déclencheur
d'instruction `BEFORE TRUNCATE`.

---

## 5. Ce qu'il faut faire, et quand

Rien de ceci n'invalide un choix de socle : c'est ce que K3.3 voulait savoir avant
la première ligne de code, et la réponse est non. La sécurité par ligne de
PostgreSQL tient sur les agrégats et les jointures profondes. Le socle reste.

Les quatre défauts sont des corrections, à porter au **lot 1.1 de la tranche 1**,
avant toute écriture — puisque écrire sans cloisonnement effectif reviendrait à
construire le chemin d'écriture par-dessus une frontière ouverte.

1. `FORCE ROW LEVEL SECURITY` sur les 55 tables, et un test qui échoue si une
   table du schéma ne l'a pas.
2. Les droits du rôle `authenticated`, portés par une migration.
3. La sécurité par ligne et une politique sur `approval`, `support_typology` et
   `support_version` ; puis un test qui parcourt le catalogue et échoue dès
   qu'une table portant `org_id` n'a pas de politique — pour que l'oubli de
   `0009` et `0015` ne puisse pas se répéter.
4. L'identité de l'utilisateur agissant propagée jusqu'à `auth.uid()`, et le rôle
   `authenticated` pris par la connexion applicative.
5. Les trois clés étrangères vers `auth.users` remplacées par une table de
   comptes propre au produit (A2.4).
6. Un déclencheur `BEFORE TRUNCATE` sur `approval`, et le critère 9 de T-2.14a
   éprouvé par un test.

Les douze formes de requête de cette note constituent le canevas du test de
non-régression correspondant.

---

## 6. Reproductibilité

L'essai s'est tenu sur PostgreSQL 16.13, sur une grappe locale jetable, avec deux
organisations fictives. Aucune donnée client, aucun projet réel, aucune chaîne de
connexion. L'échafaudage `auth.users` et `auth.uid()` a été fabriqué pour l'essai
et n'est pas versé au dépôt — le fabriquer est précisément le constat du § 3.4.
