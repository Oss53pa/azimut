-- A6.1 et A2.4 : l'identité de l'appelant se lit sous le propriétaire de la
-- fonction qui la rend.
--
-- `current_user_id()` (0024) lit le réglage de session, puis, à défaut,
-- `auth.uid()` quand une plateforme le fournit. Les fonctions privilégiées
-- appartiennent à des rôles sans connexion (0071, 0075, 0076, 0077), et
-- `current_user_id()` s'exécutait sous ces rôles. Sur une plateforme dont le
-- schéma `auth` appartient à un autre administrateur, le propriétaire des
-- tables peut lire `auth.uid()` mais ne peut pas en céder l'usage : constaté
-- sur l'hébergement Supabase le 22/10/2026 (usage sans droit de cession). Une
-- requête venue de l'API, sans réglage de session, échouait alors dans ces
-- fonctions sur « permission denied for schema auth ».
--
-- La fonction devient SECURITY DEFINER. Elle ne lit aucune table et ne rend
-- que l'identité de la requête en cours : le réglage de session ou les
-- revendications du jeton, qui appartiennent à la session, pas au
-- propriétaire. Son chemin de recherche reste vide.
--
-- Additive : le corps est inchangé, aucune ligne n'est touchée (A2.2,
-- point 7).

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
