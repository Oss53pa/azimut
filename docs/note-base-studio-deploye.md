# Note de mise en place : brancher le studio déployé sur une base

Note de décision au titre de A2.2. Rien n'est créé tant que les choix de la
section « À décider » ne sont pas faits.

## État actuel

Le studio est publié comme site statique, par le job « Déploiement
Cloudflare » de la CI. Il lit sa source de données à la construction
(`apps/studio/src/data/config.ts`), dans deux variables :
`VITE_AZIMUT_API_URL` et `VITE_AZIMUT_API_KEY`. Elles ne sont pas posées, donc
le studio sert les sites de référence et le signale.

Poser ces deux variables ne suffit pas. Le cloisonnement (A6.1, FORCE depuis
0025) ne laisse voir une ligne qu'à un utilisateur identifié et membre de son
organisation. Une clé d'API seule correspond au rôle `anon`, qui ne voit
rien. Le studio n'a pas d'écran de connexion, donc il ne peut transmettre
aucune identité.

## Ce que le cahier impose

- A3.1 et A3.2 : PostgreSQL via Supabase pour la base, l'authentification
  (Supabase Auth) et le stockage des artefacts.
- A3.4 : rester déployable sur une installation Supabase autonome. Aucune
  fonction gérée non réimplantable.
- A6.3 : double authentification obligatoire pour `admin` et `owner_rep`.
  Chiffrement en transit et au repos. Aucun secret dans le dépôt.

## Ce qui est déjà prêt

- Les 75 migrations s'appliquent sur une base vide, essayées par la CI à
  chaque poussée.
- L'identité : `azimut.current_user_id()` lit d'abord le réglage de session,
  puis `auth.uid()` quand la plateforme le fournit. Sous Supabase, la
  revendication `sub` du jeton suffit. L'étanchéité par PostgREST est éprouvée
  (`a10-4-etancheite-postgrest.db.test.ts`).
- Les rôles du service de compilation (0071) sont créés par la migration
  quand le rôle qui migre peut créer des rôles. Sur Supabase, `postgres` le
  peut.

## Ce qu'il reste à faire, dans l'ordre

1. **Installation.** Créer le projet ou l'instance, puis appliquer les
   migrations dans l'ordre de `ORDRE.md`. `bootstrap-standalone.sql` ne
   s'exécute que sur une base sans schéma `auth`, donc jamais sur Supabase.
2. **Référentiels.** `pnpm seed:reference` (pays de Q9).
3. **Écran de connexion du studio.** Il ouvre une session Supabase Auth, avec
   la double authentification pour les rôles qui l'exigent, puis transmet le
   jeton à chaque requête PostgREST. C'est du code à écrire, avec ses essais.
   Il faut aussi trancher par A2.2, cas 4, entre le client officiel et des
   appels HTTP directs.
4. **Rattachements.** Créer la première organisation et la première
   inscription de son administrateur.
5. **Variables de construction.** Poser `VITE_AZIMUT_API_URL` et
   `VITE_AZIMUT_API_KEY` (la clé publique `anon`, jamais la clé de service)
   dans les secrets de la CI, et non dans le dépôt.
6. **Service de compilation.** Lui donner une connexion membre de
   `azimut_compiler` et de `authenticated`, et de rien d'autre, puis un
   répertoire de paquets (`apps/compiler/src/service.ts`).

## À décider

- **L'installation.** Projet Supabase géré, avec sa région de résidence des
  données, ou installation autonome chez le client (A3.4).
- **Le client d'authentification du studio.** Bibliothèque officielle ou
  appels HTTP directs (A2.2, cas 4).
- **L'hébergement du service de compilation**, conteneurisé selon A3.1, et
  la manière de l'exécuter (voir le rapport de la tâche du point d'entrée).
