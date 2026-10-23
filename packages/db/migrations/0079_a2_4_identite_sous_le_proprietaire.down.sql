-- Retour de 0079 : `current_user_id()` retrouve sa forme de 0024, exécutée
-- sous le rôle de l'appelant.

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
ALTER FUNCTION azimut.current_user_id() SECURITY INVOKER;
