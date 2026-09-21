-- A2.4 — retirer la dépendance à la plateforme d'hébergement.
--
-- « Utiliser une fonctionnalité de la plateforme d'hébergement non disponible
-- en installation autonome » est une interdiction permanente. Le socle en
-- portait deux :
--
--   · trois clés étrangères vers `auth.users`, table propre à la plateforme.
--     Neuf migrations sur vingt-sept échouaient sans elle, en cascade, sur une
--     base autonome — vérifié, note du préalable K4 nº 7 ;
--   · la fonction `auth.uid()`, dont dépend toute politique de cloisonnement.
--
-- A5.1 spécifie `membership (id, org_id, user_id, role, created_at)` et ne
-- donne aucune cible à `user_id`. Retirer ces renvois aligne donc le schéma
-- sur le cahier, au lieu de l'en écarter, et n'invente aucune table de
-- comptes — ce qui relèverait de A2.2-2.
--
-- Aucune ligne n'est touchée : retirer une contrainte ne transforme pas une
-- donnée (A2.2-7). Les colonnes, leur type et leur caractère obligatoire sont
-- inchangés.

ALTER TABLE azimut.membership DROP CONSTRAINT IF EXISTS membership_user_id_fkey;
ALTER TABLE azimut.proof      DROP CONSTRAINT IF EXISTS proof_reviewer_id_fkey;
ALTER TABLE azimut.audit_log  DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;

-- L'utilisateur courant, sans la plateforme.
--
-- A6.1 dit « l'utilisateur courant » sans en fixer le moyen. Le moyen retenu
-- est un réglage de session, que la connexion applicative pose à chaque
-- transaction. La plateforme reste acceptée quand elle est là : si le réglage
-- est absent et que `auth.uid()` existe, c'est elle qui répond.
--
-- Sans réglage et sans plateforme, la fonction rend NULL : `user_org_ids()`
-- ne rend alors aucune organisation et les politiques ne laissent rien voir.
-- Le défaut est fermé, jamais ouvert.
CREATE OR REPLACE FUNCTION azimut.current_user_id()
RETURNS uuid
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  from_session text := nullif(current_setting('azimut.current_user_id', true), '');
  from_platform uuid;
BEGIN
  IF from_session IS NOT NULL THEN
    RETURN from_session::uuid;
  END IF;

  BEGIN
    EXECUTE 'SELECT auth.uid()' INTO from_platform;
  EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
    RETURN NULL;
  END;

  RETURN from_platform;
END;
$$;

-- `user_org_ids()` cesse d'appeler la plateforme directement.
CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership WHERE user_id = azimut.current_user_id();
$$;
