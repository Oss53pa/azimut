-- INV-3 : registre de sécurité cloisonné
-- Un pictogramme du registre de sécurité ne peut être ni modifié ni supprimé.

CREATE OR REPLACE FUNCTION azimut.guard_safety_pictogram()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.registry = 'safety' THEN
    RAISE EXCEPTION 'INV-3: pictogramme du registre de sécurité en lecture seule (id=%)', OLD.id;
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_guard_safety_pictogram_update
  BEFORE UPDATE ON azimut.pictogram
  FOR EACH ROW
  WHEN (OLD.registry = 'safety')
  EXECUTE FUNCTION azimut.guard_safety_pictogram();

CREATE TRIGGER trg_guard_safety_pictogram_delete
  BEFORE DELETE ON azimut.pictogram
  FOR EACH ROW
  WHEN (OLD.registry = 'safety')
  EXECUTE FUNCTION azimut.guard_safety_pictogram();
