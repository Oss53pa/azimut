#!/usr/bin/env bash
# AUTH.2 — monte une base d'essai dont le schéma `auth` est celui du service
# d'authentification de Supabase, et non le schéma réduit de
# `bootstrap-standalone.sql`.
#
# Décision QA2 d'Oss53pa (21 novembre 2026, `docs/decoupage-authentification.md`) :
# le service entre en CI, pour que la connexion réelle s'éprouve sur une
# installation autonome (A3.4). Les deux schémas ne cohabitent pas : le
# service crée sa propre table `auth.users`, et la table réduite du préalable
# l'en empêcherait. Cette base est donc distincte de celle des autres essais.
#
# L'ordre est celui d'une installation qui fournit `auth` : le service migre
# d'abord son schéma, puis le corpus d'Azimut s'applique, sans le préalable.
#
# Usage : monter-base-authentification.sh <binaire du service> <hôte:port>
# Le serveur doit accepter `postgres` sans mot de passe, comme celui de la CI.
# Aucun mot de passe ni secret n'est écrit ici (A2.4).
set -euo pipefail

binary="$1"
server="$2"
database="azimut_auth"
admin="postgres://postgres@${server}/postgres"
owner="postgres://azimut@${server}/${database}"

psql "$admin" -v ON_ERROR_STOP=1 -q <<SQL
DROP DATABASE IF EXISTS ${database};
DO \$\$
BEGIN
  -- Le rôle propriétaire du schéma du service, comme dans une installation
  -- Supabase. Il ne porte aucun droit sur le schéma d'Azimut.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN NOINHERIT;
  END IF;
END;
\$\$;
CREATE DATABASE ${database} OWNER azimut;
SQL
psql "postgres://postgres@${server}/${database}" -v ON_ERROR_STOP=1 -q \
  -c 'CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin'

# Les migrations du service sont livrées avec son binaire, à côté de lui.
GOTRUE_DB_DRIVER=postgres \
DATABASE_URL="postgres://supabase_auth_admin@${server}/${database}?search_path=auth" \
GOTRUE_DB_MIGRATIONS_PATH="$(dirname "$binary")/migrations" \
GOTRUE_JWT_SECRET=migration-seulement \
API_EXTERNAL_URL=http://127.0.0.1 \
GOTRUE_SITE_URL=http://127.0.0.1 \
  "$binary" migrate > /dev/null

# Ce dont le corpus a besoin dans le schéma du service : 0002 et 0006 posent
# des clés vers `auth.users`, que 0024 retire ; `current_user_id()` appelle
# `auth.uid()` en repli.
psql "postgres://supabase_auth_admin@${server}/${database}" -v ON_ERROR_STOP=1 -q \
  -c 'GRANT USAGE ON SCHEMA auth TO azimut, authenticated, anon' \
  -c 'GRANT REFERENCES ON auth.users TO azimut' \
  -c 'GRANT EXECUTE ON FUNCTION auth.uid() TO azimut, authenticated, anon'

for f in packages/db/migrations/0*.up.sql; do
  psql "$owner" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done
psql "$owner" -v ON_ERROR_STOP=1 -q -c 'GRANT USAGE ON SCHEMA azimut TO anon'

echo "Base ${database} montée : schéma auth du service, puis $(ls packages/db/migrations/0*.up.sql | wc -l) migrations."
