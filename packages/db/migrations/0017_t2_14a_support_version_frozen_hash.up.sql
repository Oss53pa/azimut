-- T-2.14a §5 : l'empreinte d'une version de support non-draft est figée.
-- Une version in_review, approved ou superseded conserve son content_hash ; il
-- ne se recalcule pas. Le changement d'état (approved → superseded) reste
-- permis, seule la modification de l'empreinte est refusée, au niveau de la
-- base et non par convention applicative.

CREATE FUNCTION azimut.guard_support_version_frozen_hash()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state <> 'draft'
     AND NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION
      'support_version: content_hash frozen while state is % (was %, attempted %)',
      OLD.state, OLD.content_hash, NEW.content_hash;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_support_version_frozen_hash
  BEFORE UPDATE ON azimut.support_version
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_support_version_frozen_hash();
