#!/usr/bin/env bash
# T-0.3 — « une migration est réversible à l'aller et au retour ».
#
# Sur une base neuve et jetable : toutes les migrations à l'aller, un
# instantané du schéma, toutes au retour dans l'ordre inverse, de nouveau
# toutes à l'aller, un second instantané. Les deux doivent être identiques,
# ligne à ligne (`scripts/schema-snapshot.sql`). Un retour qui échoue, ou qui
# laisse une trace, fait échouer le script.
#
# Usage : scripts/migrations-aller-retour.sh <url-admin> <url-proprietaire-sans-base>
#   ex. : scripts/migrations-aller-retour.sh postgres://postgres@127.0.0.1:54332 postgres://azimut@127.0.0.1:54332
# Le rôle propriétaire doit exister et n'être pas superutilisateur.
set -euo pipefail
admin="$1"
owner="$2"
base_name=azimut_aller_retour
owner_role="${owner#postgres://}"; owner_role="${owner_role%%@*}"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

psql "$admin/postgres" -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $base_name" >/dev/null 2>&1
psql "$admin/postgres" -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE $base_name OWNER $owner_role" >/dev/null
base="$owner/$base_name"

run() { psql "$base" -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"$work/err" || { echo "ÉCHEC : $1"; tail -3 "$work/err"; exit 1; }; }
up() { for f in $(ls "$root"/packages/db/migrations/0*.up.sql | sort); do run "$f"; done; }
down() { for f in $(ls "$root"/packages/db/migrations/0*.down.sql | sort -r); do run "$f"; done; }
snapshot() { psql "$base" -Atq -v ON_ERROR_STOP=1 -f "$root/scripts/schema-snapshot.sql" > "$1"; }

run "$root/packages/db/migrations/bootstrap-standalone.sql"
up
snapshot "$work/aller.txt"
down
up
snapshot "$work/retour.txt"
psql "$admin/postgres" -q -c "DROP DATABASE IF EXISTS $base_name" >/dev/null 2>&1

if ! diff -u "$work/aller.txt" "$work/retour.txt"; then
  echo "Le schéma diffère après un aller-retour complet des migrations."
  exit 1
fi
echo "Aller-retour des migrations : schéma identique, $(wc -l < "$work/aller.txt") éléments comparés."
