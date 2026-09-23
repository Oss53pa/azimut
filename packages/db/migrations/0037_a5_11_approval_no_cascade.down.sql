ALTER TABLE azimut.approval
  DROP CONSTRAINT approval_org_id_fkey,
  ADD CONSTRAINT approval_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE CASCADE;

ALTER TABLE azimut.approval
  DROP CONSTRAINT approval_proof_id_fkey,
  ADD CONSTRAINT approval_proof_id_fkey
    FOREIGN KEY (proof_id) REFERENCES azimut.proof(id) ON DELETE CASCADE;
