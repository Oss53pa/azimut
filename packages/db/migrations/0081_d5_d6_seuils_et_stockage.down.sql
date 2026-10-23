-- Retour de 0081 : les seuils retournent dans le code, et les espaces de
-- stockage perdent leurs politiques. Les espaces eux-mêmes, et les fichiers
-- qu'ils portent, ne sont pas retirés : ce serait détruire des données
-- (A2.2, point 7). Base de développement seulement.

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS azimut_storage_read ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS azimut_storage_insert ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS azimut_storage_delete ON storage.objects';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS azimut.install_storage();
DROP FUNCTION IF EXISTS azimut.security_settings(uuid);
DROP FUNCTION IF EXISTS azimut.security_setting_value(uuid, text);
DROP TABLE IF EXISTS azimut.org_security_setting;
DROP FUNCTION IF EXISTS azimut.guard_org_security_setting();
DROP TABLE IF EXISTS azimut.security_setting;
