-- Retour de 0070 : le travail ne porte plus son demandeur. La colonne
-- disparaît avec ses valeurs ; le service de compilation retombe sans
-- identité et ne lit plus rien sous cloisonnement forcé.
DROP TRIGGER IF EXISTS guard_job_requested_by ON azimut.job;
DROP FUNCTION IF EXISTS azimut.block_job_requester_change();
DROP POLICY IF EXISTS job_requested_by_self ON azimut.job;
ALTER TABLE azimut.job DROP COLUMN IF EXISTS requested_by;
