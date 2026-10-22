-- A6.2 et M07.C2 : le rôle `vendor` voit le seul lot qui lui est rattaché.
--
-- « Lecture des exécutions du seul lot qui lui est rattaché, dépôt
-- d'épreuves. » « Sa visibilité est limitée par rattachement explicite, pas
-- par organisation. » Jusqu'ici, faute de rattachement, le `vendor` ne voyait
-- rien (0075).
--
-- Décision D-3 de l'utilisateur, le 22/10/2026 : `vendor_id` (partie H,
-- `fabrication_lot`, `cost_reference`, `vendor_offer`) désigne un fabricant,
-- entité de l'organisation, et non un compte. Un fabricant garde ainsi son
-- historique quand ses employés changent. Les comptes au rôle `vendor` lui
-- sont rattachés par `vendor_member`.
--
-- Ce que voit un `vendor` rattaché, et rien d'autre :
--   - son fabricant et ses propres rattachements ;
--   - les lots de son fabricant (`fabrication_lot.vendor_id`) ;
--   - les lignes `lot_support` de ces lots, leurs supports et leurs faces ;
--   - les versions approuvées de ces supports, qui sont les exécutions
--     (M07.C1 : un lot ne contient que des versions approuvées) ;
--   - les épreuves de ces faces.
-- Il n'écrit qu'une chose : une épreuve en attente sur une face de son lot.
--
-- Le fabricant et ses rattachements s'écrivent par trois fonctions réservées
-- à l'`admin`, comme les membres (0075) : rattacher un compte à un lot est
-- ouvrir un droit. La partie L ne range ces deux tables sous aucun module.
--
-- Additive : deux tables neuves et une colonne facultative, aucune ligne
-- existante touchée (A2.2, point 7).

CREATE TABLE azimut.vendor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_org_id_id_key UNIQUE (org_id, id)
);
CREATE INDEX idx_vendor_org ON azimut.vendor(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.vendor
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

CREATE TABLE azimut.vendor_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_member_vendor_id_fkey FOREIGN KEY (org_id, vendor_id)
    REFERENCES azimut.vendor (org_id, id) ON DELETE CASCADE,
  CONSTRAINT vendor_member_unique UNIQUE (org_id, vendor_id, user_id)
);
CREATE INDEX idx_vendor_member_user ON azimut.vendor_member(user_id);

ALTER TABLE azimut.fabrication_lot ADD COLUMN vendor_id uuid;
ALTER TABLE azimut.fabrication_lot ADD CONSTRAINT fabrication_lot_vendor_id_fkey
  FOREIGN KEY (org_id, vendor_id) REFERENCES azimut.vendor (org_id, id) ON DELETE RESTRICT;
CREATE INDEX idx_fabrication_lot_vendor ON azimut.fabrication_lot(vendor_id);

-- ── Cloisonnement (A6.1) ──────────────────────────────────────────────────

ALTER TABLE azimut.vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.vendor FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.vendor_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.vendor_member FORCE ROW LEVEL SECURITY;

CREATE POLICY vendor_org_policy ON azimut.vendor
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY vendor_member_org_policy ON azimut.vendor_member
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

-- Aucune écriture directe : les trois fonctions plus bas.
GRANT SELECT ON azimut.vendor, azimut.vendor_member TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.vendor, azimut.vendor_member FROM authenticated;

-- ── Politiques par rôle ───────────────────────────────────────────────────
--
-- Le rattachement d'un `vendor` se lit en chaîne, chaque maillon sous les
-- politiques de l'appelant : ses rattachements, puis les lots de son
-- fabricant, puis les lignes de ces lots, leurs supports, leurs faces. Aucun
-- maillon ne relit le précédent : la chaîne ne boucle pas. La condition
-- `org_id` tient la branche aux seules organisations où l'appelant est
-- `vendor`, et un rôle par organisation (`membership` unique) ne laisse pas un
-- autre rôle de la même organisation l'emprunter.

CREATE POLICY role_read ON azimut.vendor_member AS RESTRICTIVE FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin','auditor']))
         OR user_id = azimut.current_user_id());
CREATE POLICY role_insert ON azimut.vendor_member AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
CREATE POLICY role_update ON azimut.vendor_member AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
CREATE POLICY role_delete ON azimut.vendor_member AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));

CREATE POLICY role_insert ON azimut.vendor AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
CREATE POLICY role_update ON azimut.vendor AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
CREATE POLICY role_delete ON azimut.vendor AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));

DO $$
DECLARE
  r record;
  readers text := 'org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY[''admin'',''designer'',''owner_rep'',''operator'',''auditor'']))';
  as_vendor text := 'org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY[''vendor'']))';
  mine text := '(SELECT vm.vendor_id FROM azimut.vendor_member vm WHERE vm.user_id = azimut.current_user_id())';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('vendor',          'id IN ' || mine),
      ('fabrication_lot', 'vendor_id IN ' || mine),
      ('lot_support',     'lot_id IN (SELECT l.id FROM azimut.fabrication_lot l)'),
      ('support',         'id IN (SELECT ls.support_id FROM azimut.lot_support ls)'),
      ('support_face',    'support_id IN (SELECT s.id FROM azimut.support s)'),
      ('support_version', 'state = ''approved'' AND support_id IN (SELECT s.id FROM azimut.support s)'),
      ('proof',           'face_id IN (SELECT f.id FROM azimut.support_face f)')
    ) AS v(tbl, scope)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS role_read ON azimut.%I', r.tbl);
    EXECUTE format(
      'CREATE POLICY role_read ON azimut.%I AS RESTRICTIVE FOR SELECT TO authenticated '
      'USING (%s OR (%s AND %s))', r.tbl, readers, as_vendor, r.scope);
  END LOOP;
END;
$$;

-- Le dépôt d'épreuve : une épreuve en attente, sans décision, sur une face de
-- son lot. La décision reste à la validation (0076).
DROP POLICY role_insert ON azimut.proof;
CREATE POLICY role_insert ON azimut.proof AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin','designer','operator']))
    OR (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['vendor']))
        AND face_id IN (SELECT f.id FROM azimut.support_face f)
        AND status = 'pending' AND reviewer_id IS NULL AND reviewed_at IS NULL));

-- ── Les trois fonctions d'administration ──────────────────────────────────
--
-- Même propriétaire et même refus que les fonctions de membres (0075) :
-- `EDIT.WRITE_REFUSED`, que le fabricant existe ou non.

GRANT SELECT, INSERT ON azimut.vendor TO azimut_membership_admin;
GRANT SELECT, INSERT, DELETE ON azimut.vendor_member TO azimut_membership_admin;
CREATE POLICY vendor_membership_admin_all ON azimut.vendor
  FOR ALL TO azimut_membership_admin USING (true) WITH CHECK (true);
CREATE POLICY vendor_member_membership_admin_all ON azimut.vendor_member
  FOR ALL TO azimut_membership_admin USING (true) WITH CHECK (true);

CREATE FUNCTION azimut.create_vendor(p_org uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT azimut.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO azimut.vendor(org_id, name) VALUES (p_org, p_name) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Seul un compte au rôle `vendor` dans l'organisation du fabricant s'y
-- rattache : un rattachement ne donne jamais plus que ce rôle.
CREATE FUNCTION azimut.attach_vendor_member(p_vendor uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT v.org_id INTO v_org FROM azimut.vendor v WHERE v.id = p_vendor;
  IF v_org IS NULL OR NOT azimut.is_org_admin(v_org) OR NOT EXISTS (
    SELECT 1 FROM azimut.membership m
    WHERE m.org_id = v_org AND m.user_id = p_user AND m.role = 'vendor'
  ) THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO azimut.vendor_member(org_id, vendor_id, user_id)
    VALUES (v_org, p_vendor, p_user)
    ON CONFLICT (org_id, vendor_id, user_id) DO NOTHING;
END;
$$;

CREATE FUNCTION azimut.detach_vendor_member(p_vendor uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT v.org_id INTO v_org FROM azimut.vendor v WHERE v.id = p_vendor;
  IF v_org IS NULL OR NOT azimut.is_org_admin(v_org) THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  DELETE FROM azimut.vendor_member vm WHERE vm.vendor_id = p_vendor AND vm.user_id = p_user;
END;
$$;

GRANT CREATE ON SCHEMA azimut TO azimut_membership_admin;
ALTER FUNCTION azimut.create_vendor(uuid, text) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.attach_vendor_member(uuid, uuid) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.detach_vendor_member(uuid, uuid) OWNER TO azimut_membership_admin;
REVOKE CREATE ON SCHEMA azimut FROM azimut_membership_admin;

REVOKE ALL ON FUNCTION azimut.create_vendor(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.attach_vendor_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.detach_vendor_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.create_vendor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.attach_vendor_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.detach_vendor_member(uuid, uuid) TO authenticated;
