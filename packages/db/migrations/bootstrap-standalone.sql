-- Préalable d'installation autonome. N'est PAS une migration du corpus.
--
-- À exécuter une fois, avant `0001`, sur une base neuve qui n'est pas hébergée
-- par une plateforme fournissant un schéma `auth`. Sur une plateforme qui en
-- fournit un, ne rien exécuter : ce fichier ne doit jamais toucher la table de
-- comptes d'un hébergeur.
--
-- Pourquoi il existe. Les migrations `0002` et `0006` créent trois clés
-- étrangères vers `auth.users`. La migration `0024` les retire, au titre de
-- A2.4, mais elle passe après : sur une base neuve, `0002` échoue avant que
-- `0024` n'ait la parole. Réécrire `0002` et `0006` corrigerait la cause, mais
-- ce sont des migrations déjà appliquées, et les modifier ferait diverger toute
-- base à jour de son registre d'application.
--
-- Ce fichier crée donc le strict nécessaire pour que le corpus s'applique de
-- bout en bout. Après `0024`, plus aucune clé étrangère ne pointe vers cette
-- table : elle peut être supprimée, et la dernière ligne, commentée, le fait.

CREATE SCHEMA IF NOT EXISTS auth;

-- Le minimum auquel `0002` et `0006` se réfèrent. Aucune donnée n'y entre :
-- `membership.user_id` reste un uuid libre, conformément à A5.1.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);

-- `0007` définit le cloisonnement en appelant `auth.uid()`. Une installation
-- autonome n'a pas cette fonction ; `0024` la remplace par
-- `azimut.current_user_id()`, mais elle aussi passe après. Ce relais rend
-- l'identité de session, exactement comme le fera `azimut.current_user_id()` :
-- entre `0007` et `0024`, le cloisonnement fonctionne donc déjà.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('azimut.current_user_id', true), '')::uuid $$;

-- Le rôle auquel toutes les politiques de cloisonnement sont adressées.
-- Une plateforme le fournit ; une installation autonome le crée ici.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END;
$$;

-- Après application de `0024`, à exécuter pour effacer la dernière trace de la
-- plateforme sur une installation autonome :
--
--   DROP FUNCTION IF EXISTS auth.uid();
--   DROP TABLE IF EXISTS auth.users;
--   DROP SCHEMA IF EXISTS auth;
