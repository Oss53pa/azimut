-- Retour de 0080 : l'identité relit le réglage de session avant le jeton, et
-- le rôle `admin` ou `owner_rep` compte sans second facteur. Base de
-- développement seulement : ce retour rouvre ce que 0080 ferme.

CREATE OR REPLACE FUNCTION azimut.current_user_id()
RETURNS uuid
LANGUAGE plpgsql STABLE
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership WHERE user_id = azimut.current_user_id();
$$;

CREATE OR REPLACE FUNCTION azimut.user_org_ids_with_role(p_roles text[])
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.org_id FROM azimut.membership m
  WHERE m.user_id = azimut.current_user_id() AND m.role = ANY (p_roles)
$$;

CREATE OR REPLACE FUNCTION azimut.is_org_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
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
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO azimut.organization (name, slug) VALUES (p_name, p_slug)
  RETURNING id INTO v_org;
  INSERT INTO azimut.membership (org_id, user_id, role) VALUES (v_org, v_me, 'admin');
  RETURN v_org;
END;
$$;

DROP FUNCTION IF EXISTS azimut.membership_is_effective(text);
DROP FUNCTION IF EXISTS azimut.session_is_strong();
DROP FUNCTION IF EXISTS azimut.request_claims();
