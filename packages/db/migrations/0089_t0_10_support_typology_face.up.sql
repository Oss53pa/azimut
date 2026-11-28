-- T-0.10 — les faces d'une typologie de support. Décision d'Oss53pa du
-- 28 novembre 2026 (A2.2, point 2).
--
-- Le modèle porte, pour chaque typologie, ses faces : un côté et une taille par
-- défaut en millimètres (`SupportType.faces`). A5.6 ne leur donnait aucune
-- colonne, et le chargement d'un site depuis la base les rendait vides. Sur un
-- site lu en base, chaque typologie était alors refusée
-- (DATA.SUPPORT_FACE_COUNT_MISMATCH), le tableau des messages ne produisait
-- aucune ligne, et la composition retombait sur une taille de repli. L'essai
-- de chargement des sites de référence (T-0.10) l'a montré.
--
-- Une ligne par face, unique par côté dans sa typologie, possédée par le
-- module 04 comme la typologie elle-même.
--
-- Additive : aucune ligne existante n'est lue ni transformée (A2.2, point 7).
-- Une typologie écrite avant cette migration reste sans face, et le contrôle
-- continue de le dire jusqu'à ce qu'on les déclare.

CREATE TABLE azimut.support_typology_face (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  typology_id       uuid NOT NULL REFERENCES azimut.support_typology(id) ON DELETE CASCADE,
  side              text NOT NULL CHECK (side ~ '^[a-z][a-z_]{0,31}$'),
  default_width_mm  integer NOT NULL CHECK (default_width_mm > 0),
  default_height_mm integer NOT NULL CHECK (default_height_mm > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (typology_id, side)
);
CREATE INDEX idx_support_typology_face_org ON azimut.support_typology_face(org_id);

-- Une face appartient à l'organisation de sa typologie.
CREATE FUNCTION azimut.support_typology_face_attached()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM azimut.support_typology t WHERE t.id = NEW.typology_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'face de typologie rattachée hors de son organisation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_typology_face_attached
  BEFORE INSERT OR UPDATE OF org_id, typology_id ON azimut.support_typology_face
  FOR EACH ROW EXECUTE FUNCTION azimut.support_typology_face_attached();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.support_typology_face
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE TRIGGER guard_object_lock BEFORE UPDATE OR DELETE ON azimut.support_typology_face
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_object_lock();

-- Cloisonnement (A6.1, A6.2, 0076, 0079, 0080), comme `support_typology`.
ALTER TABLE azimut.support_typology_face ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_typology_face FORCE ROW LEVEL SECURITY;
CREATE POLICY support_typology_face_org_policy ON azimut.support_typology_face FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY support_typology_face_auditor_no_insert ON azimut.support_typology_face AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY support_typology_face_auditor_no_update ON azimut.support_typology_face AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))))
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY support_typology_face_auditor_no_delete ON azimut.support_typology_face AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY support_typology_face_marketing_no_access ON azimut.support_typology_face AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['marketing']))))
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['marketing']))));
CREATE POLICY support_typology_face_mfa_required ON azimut.support_typology_face AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (org_id IN (SELECT azimut.org_ids_lacking_mfa())))
  WITH CHECK (NOT (org_id IN (SELECT azimut.org_ids_lacking_mfa())));
GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.support_typology_face TO authenticated;
