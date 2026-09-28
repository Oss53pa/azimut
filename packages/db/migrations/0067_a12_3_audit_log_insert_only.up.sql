-- A12.3 et M00.PL3 — `audit_log` en insertion seule, garanti en base.
--
-- « Aucune modification et aucune suppression ne sont possibles, pour aucun
-- rôle, administration comprise. » Jusqu'ici le journal n'en avait que le
-- nom : 0007 lui avait posé une politique FOR ALL, 0025 accordait UPDATE et
-- DELETE à tout le schéma, et aucun déclencheur ne le gardait. 0025 l'avait
-- porté en constaté, non traité.
--
-- Trois barrages, comme pour `approval` et `graph_validation` : la politique
-- ne permet que la lecture et l'insertion, le rôle applicatif n'a plus les
-- droits de modification, de suppression ni de vidage, et des déclencheurs
-- refusent les trois voies au rôle propriétaire lui-même.
--
-- La seule voie de suppression prévue est la purge de fin de contrat d'O15,
-- procédure de la plateforme qui n'existe pas encore. Elle se posera sur ces
-- barrages le jour venu, en les nommant.
--
-- Aucune ligne n'est modifiée : la migration ne touche qu'aux droits, aux
-- politiques et aux déclencheurs.

DROP POLICY IF EXISTS audit_log_org_policy ON azimut.audit_log;

CREATE POLICY audit_log_org_select ON azimut.audit_log
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY audit_log_org_insert ON azimut.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

REVOKE UPDATE, DELETE, TRUNCATE ON azimut.audit_log FROM authenticated;

CREATE FUNCTION azimut.block_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log records are insert-only and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER guard_audit_log_update
  BEFORE UPDATE ON azimut.audit_log
  FOR EACH ROW EXECUTE FUNCTION azimut.block_audit_log_modification();

CREATE TRIGGER guard_audit_log_delete
  BEFORE DELETE ON azimut.audit_log
  FOR EACH ROW EXECUTE FUNCTION azimut.block_audit_log_modification();

CREATE FUNCTION azimut.block_audit_log_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log records are insert-only and cannot be truncated';
END;
$$;

CREATE TRIGGER guard_audit_log_truncate
  BEFORE TRUNCATE ON azimut.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION azimut.block_audit_log_truncate();
