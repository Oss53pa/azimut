DROP TRIGGER IF EXISTS after_approval_insert ON azimut.approval;
DROP FUNCTION IF EXISTS azimut.apply_approval_to_proof();
DROP TRIGGER IF EXISTS guard_approval_delete ON azimut.approval;
DROP TRIGGER IF EXISTS guard_approval_update ON azimut.approval;
DROP FUNCTION IF EXISTS azimut.block_approval_modification();
DROP TABLE IF EXISTS azimut.approval;
