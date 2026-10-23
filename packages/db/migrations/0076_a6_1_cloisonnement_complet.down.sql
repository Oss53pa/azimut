-- Retour de 0076 : les clés étrangères redeviennent simples, les signatures
-- se fournissent de nouveau, la validation retrouve son déclencheur de 0009 et
-- le registre ses droits de 0025.
--
-- Ce retour rouvre les fuites que 0076 ferme : il n'a sa place que sur une
-- base de développement. Il ne retire aucune ligne.
--
-- Le rôle `azimut_proof_review` est de grappe : il reste, sans droit ni
-- fonction, comme les rôles de 0071 et 0075.

-- ── 5. Le registre des migrations ─────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('azimut._migrations') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON azimut._migrations TO authenticated;
  END IF;
  IF to_regclass('azimut._migrations_id_seq') IS NOT NULL THEN
    GRANT USAGE, SELECT ON SEQUENCE azimut._migrations_id_seq TO authenticated;
  END IF;
END;
$$;

-- ── 4. Les gardes ─────────────────────────────────────────────────────────

ALTER FUNCTION azimut.block_approval_modification() SECURITY DEFINER RESET search_path;
ALTER FUNCTION azimut.guard_support_version_frozen_hash() SECURITY DEFINER RESET search_path;

-- ── 3. La validation ──────────────────────────────────────────────────────

ALTER FUNCTION azimut.apply_approval_to_proof() OWNER TO azimut;
CREATE OR REPLACE FUNCTION azimut.apply_approval_to_proof()
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
ALTER FUNCTION azimut.apply_approval_to_proof() RESET search_path;
GRANT EXECUTE ON FUNCTION azimut.apply_approval_to_proof() TO PUBLIC;

DROP POLICY IF EXISTS proof_review_update ON azimut.proof;
DROP POLICY IF EXISTS proof_review_select ON azimut.proof;
REVOKE ALL ON azimut.proof FROM azimut_proof_review;
REVOKE USAGE ON SCHEMA azimut FROM azimut_proof_review;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    REVOKE USAGE ON SCHEMA auth FROM azimut_proof_review;
  END IF;
END;
$$;

-- ── 2. Signatures ─────────────────────────────────────────────────────────

DROP TRIGGER review_annotation_sign ON azimut.review_annotation;
CREATE OR REPLACE FUNCTION azimut.review_annotation_sign() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = 'open' THEN
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
  ELSIF OLD.state = 'open' THEN
    NEW.resolved_by := azimut.current_user_id();
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION azimut.review_annotation_sign() RESET search_path;
CREATE TRIGGER review_annotation_sign BEFORE UPDATE OF state ON azimut.review_annotation
  FOR EACH ROW EXECUTE FUNCTION azimut.review_annotation_sign();

DROP TRIGGER IF EXISTS stamp_owner_id ON azimut.sketch_layer;
DROP TRIGGER IF EXISTS stamp_author_id ON azimut.review_annotation_reply;
DROP TRIGGER IF EXISTS stamp_author_id ON azimut.review_annotation;
DROP TRIGGER IF EXISTS stamp_reviewer_id ON azimut.approval;
DROP FUNCTION IF EXISTS azimut.stamp_current_user();

-- ── 1. Clés étrangères ────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
  v_action text;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, c.confrelid::regclass AS ref,
           a.attname AS col, c.confdeltype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[2]
    WHERE c.connamespace = 'azimut'::regnamespace AND c.contype = 'f'
      AND obj_description(c.oid, 'pg_constraint') = 'A6.1 (0076) : clé composite par organisation'
    ORDER BY c.conrelid::regclass::text, c.conname
  LOOP
    v_action := CASE r.confdeltype
      WHEN 'c' THEN 'CASCADE'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s (id) ON DELETE %s',
      r.tbl, r.conname, r.col, r.ref, v_action);
  END LOOP;

  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.connamespace = 'azimut'::regnamespace AND c.contype = 'u'
      AND obj_description(c.oid, 'pg_constraint') = 'A6.1 (0076) : cible des clés composites par organisation'
    ORDER BY c.conrelid::regclass::text
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END;
$$;
