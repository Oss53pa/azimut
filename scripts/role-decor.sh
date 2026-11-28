#!/usr/bin/env bash
# Question 6 de la matrice, décision d'Oss53pa (28 novembre 2026) — le rôle de
# décor du banc d'essai.
#
# Un essai sur base pose son décor (organisation, premier membre, lignes de
# départ) et le retire. Il le faisait sous le rôle propriétaire en levant un
# instant `FORCE ROW LEVEL SECURITY` : le schéma changeait alors de posture
# pour toutes les suites qui tournaient en même temps. CLAUDE.md interdit de
# contourner le cloisonnement, y compris en essai.
#
# Le décor passe désormais par un rôle à part, `azimut_fixture` :
#   · BYPASSRLS : il écrit le décor de n'importe quelle organisation sans que
#     le schéma change de posture ;
#   · aucun droit de structure : ni propriétaire, ni membre du propriétaire, il
#     ne peut ni lever FORCE, ni modifier une politique, ni créer un objet ;
#   · créé ici, par le montage du banc, jamais par une migration : il n'existe
#     dans aucune installation de production.
#
# Usage : role-decor.sh <URL d'administration sans base> <base>
# Le serveur doit accepter `postgres` sans mot de passe, comme celui de la CI.
# Aucun mot de passe ni secret n'est écrit ici (A2.4).
set -euo pipefail

admin="$1"
database="$2"

psql "${admin}/postgres" -v ON_ERROR_STOP=1 -q <<'SQL'
SET client_min_messages = warning;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_fixture') THEN
    CREATE ROLE azimut_fixture LOGIN NOINHERIT BYPASSRLS;
  END IF;
END;
$$;
SQL

# Les droits de données seuls, sur ce qui existe après les migrations.
psql "${admin}/${database}" -v ON_ERROR_STOP=1 -q <<'SQL'
SET client_min_messages = warning;
GRANT USAGE ON SCHEMA azimut TO azimut_fixture;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA azimut TO azimut_fixture;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA azimut TO azimut_fixture;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA azimut TO azimut_fixture;
-- A12.3 — aucune modification, suppression ni vidage des tables en insertion
-- seule, pour aucun rôle autre que le propriétaire. Elles se reconnaissent au
-- barrage de vidage qu'elles portent toutes ; aucune liste n'est recopiée ici.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT DISTINCT c.relname FROM pg_trigger g
    JOIN pg_class c ON c.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND NOT g.tgisinternal AND (g.tgtype & 32) = 32
  LOOP
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON azimut.%I FROM azimut_fixture', t);
  END LOOP;
END;
$$;
-- Le propriétaire bascule vers ce rôle le temps d’une instruction de décor
-- (`packages/db/src/fixture-role.ts`). Les attributs ne s’héritent pas : être
-- membre ne lui donne pas BYPASSRLS, seule la bascule explicite le porte.
GRANT azimut_fixture TO azimut;
SQL
