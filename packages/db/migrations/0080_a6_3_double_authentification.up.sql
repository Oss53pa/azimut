-- A6.3 et O3 : la double authentification est exigée en base pour `admin` et
-- `owner_rep`, et l'identité d'une requête de l'API ne se falsifie plus.
--
-- Ce qui change :
--
-- 1. L'identité. `current_user_id()` lisait d'abord le réglage de session
--    `azimut.current_user_id`, puis `auth.uid()`. Une connexion directe qui
--    portait aussi un jeton pouvait donc parler au nom d'un autre. Désormais :
--      - une requête de l'API porte ses revendications dans
--        `request.jwt.claims` (PostgREST les pose à chaque requête) ;
--        l'identité est alors leur `sub`, et le réglage de session est ignoré ;
--      - sans revendications, la connexion est directe : elle a les
--        identifiants de la base, c'est le service de compilation ou un outil
--        d'exploitation, et le réglage de session fait foi.
--    La lecture ne passe plus par `auth.uid()` : plus aucune dépendance au
--    schéma `auth` de la plateforme (A2.4), donc plus besoin du privilège de
--    0079, qui est retiré.
-- 2. La force de la session. `session_is_strong()` est vraie pour une
--    connexion directe, et pour une requête de l'API dont le jeton porte
--    `aal = aal2`, c'est-à-dire une connexion confirmée par un second facteur.
-- 3. Le rôle `admin` ou `owner_rep` ne compte, dans une organisation, que
--    sous une session forte. En `aal1`, un tel membre ne lit ni n'écrit rien
--    de son organisation : il ne voit que sa propre inscription, ce qui
--    suffit au studio pour lui demander d'enrôler ou de vérifier son second
--    facteur (O3 : « ne peut rien faire d'autre que l'enrôler »). Créer une
--    organisation, dont on devient `admin`, exige aussi une session forte.
--
-- Additive : aucune ligne n'est touchée (A2.2, point 7).

CREATE FUNCTION azimut.request_claims()
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

CREATE OR REPLACE FUNCTION azimut.current_user_id()
RETURNS uuid
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  claims jsonb := azimut.request_claims();
BEGIN
  IF claims IS NOT NULL THEN
    RETURN nullif(claims ->> 'sub', '')::uuid;
  END IF;
  RETURN nullif(current_setting('azimut.current_user_id', true), '')::uuid;
END;
$$;

CREATE FUNCTION azimut.session_is_strong()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT azimut.request_claims() IS NULL
      OR azimut.request_claims() ->> 'aal' = 'aal2'
$$;

-- Les rôles qui exigent le second facteur, et le filtre qui les applique.
CREATE FUNCTION azimut.membership_is_effective(p_role text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT p_role NOT IN ('admin', 'owner_rep') OR azimut.session_is_strong()
$$;

CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership
  WHERE user_id = azimut.current_user_id() AND azimut.membership_is_effective(role);
$$;

CREATE OR REPLACE FUNCTION azimut.user_org_ids_with_role(p_roles text[])
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.org_id FROM azimut.membership m
  WHERE m.user_id = azimut.current_user_id() AND m.role = ANY (p_roles)
    AND azimut.membership_is_effective(m.role)
$$;

CREATE OR REPLACE FUNCTION azimut.is_org_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT azimut.session_is_strong() AND EXISTS (
    SELECT 1 FROM azimut.membership m
    WHERE m.org_id = p_org AND m.user_id = azimut.current_user_id() AND m.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION azimut.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid := azimut.current_user_id();
  v_org uuid;
BEGIN
  IF v_me IS NULL OR NOT azimut.session_is_strong() THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO azimut.organization (name, slug) VALUES (p_name, p_slug)
  RETURNING id INTO v_org;
  INSERT INTO azimut.membership (org_id, user_id, role) VALUES (v_org, v_me, 'admin');
  RETURN v_org;
END;
$$;
