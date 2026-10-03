-- A6.1 — un travail porte l'identité de son demandeur.
--
-- Le service de compilation lit la base sous cloisonnement forcé (0025). Sans
-- identité, il ne voit rien : `loadSiteData` levait « organization not
-- found » sur toute base réelle. Option retenue par l'utilisatrice : le
-- travail porte son demandeur, et le service lit sous l'identité de celui-ci,
-- comme le chemin d'écriture écrit sous la sienne. Aucune politique nouvelle
-- n'élargit ce qu'un rôle voit : le service voit exactement ce que voit le
-- demandeur.
--
-- Trois gardes, sans lesquelles cette option ouvrirait une brèche entre
-- organisations :
--
--   1. Le demandeur est posé par la base : par défaut l'utilisateur courant,
--      et une politique restrictive refuse toute insertion qui en nommerait un
--      autre. Sans elle, un membre de A créerait un travail au nom d'un
--      utilisateur de B, et le service lirait B pour le compte de A.
--   2. Le demandeur ne change plus après l'insertion : un déclencheur le
--      refuse, pour tout rôle.
--   3. Le service vérifie que le site lu appartient à l'organisation du
--      travail (`loadSiteData`).
--
-- Additive : la colonne est facultative, aucune ligne existante n'est
-- transformée (A2.2, point 7). Un travail antérieur, sans demandeur, est
-- refusé par le service au lieu d'être exécuté sous une identité devinée.

ALTER TABLE azimut.job
  ADD COLUMN requested_by uuid DEFAULT azimut.current_user_id();

CREATE POLICY job_requested_by_self ON azimut.job
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = azimut.current_user_id());

CREATE FUNCTION azimut.block_job_requester_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
    RAISE EXCEPTION 'job.requested_by is fixed at insertion and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_job_requested_by
  BEFORE UPDATE OF requested_by ON azimut.job
  FOR EACH ROW EXECUTE FUNCTION azimut.block_job_requester_change();
