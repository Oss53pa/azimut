-- Retour de 0071 : le service n'a plus de chemin de prise. Aucune ligne
-- n'est touchée. Les deux rôles restent : ils sont de grappe, partagés par
-- les autres bases du serveur, et peuvent y être employés.
DROP FUNCTION IF EXISTS azimut.job_abandon(uuid, timestamptz, text);
DROP FUNCTION IF EXISTS azimut.job_stalled(timestamptz, double precision);
DROP FUNCTION IF EXISTS azimut.job_claim(timestamptz, integer[]);
DROP POLICY IF EXISTS job_dispatch_update ON azimut.job;
DROP POLICY IF EXISTS job_dispatch_select ON azimut.job;
REVOKE ALL ON azimut.job FROM azimut_job_dispatch;
REVOKE ALL ON SCHEMA azimut FROM azimut_job_dispatch;
REVOKE ALL ON SCHEMA azimut FROM azimut_compiler;
