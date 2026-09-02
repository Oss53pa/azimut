-- T-2.14: Approval table — insert-only, no modification even by admin

CREATE TABLE azimut.approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  proof_id uuid NOT NULL REFERENCES azimut.proof(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_id uuid NOT NULL,
  comment text NOT NULL DEFAULT '',
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_org ON azimut.approval(org_id);
CREATE INDEX idx_approval_proof ON azimut.approval(proof_id);

-- Block UPDATE — insert-only enforcement
CREATE FUNCTION azimut.block_approval_modification()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'approval records are insert-only and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER guard_approval_update
  BEFORE UPDATE ON azimut.approval
  FOR EACH ROW EXECUTE FUNCTION azimut.block_approval_modification();

CREATE TRIGGER guard_approval_delete
  BEFORE DELETE ON azimut.approval
  FOR EACH ROW EXECUTE FUNCTION azimut.block_approval_modification();

-- Auto-update proof status when approval is inserted
CREATE FUNCTION azimut.apply_approval_to_proof()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE azimut.proof
    SET status = NEW.decision,
        reviewed_at = NEW.decided_at,
        reviewer_id = NEW.reviewer_id
    WHERE id = NEW.proof_id
      AND status = 'pending';
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_approval_insert
  AFTER INSERT ON azimut.approval
  FOR EACH ROW EXECUTE FUNCTION azimut.apply_approval_to_proof();
