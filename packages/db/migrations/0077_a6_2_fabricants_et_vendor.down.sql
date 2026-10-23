-- Retour de 0077 : le `vendor` ne voit de nouveau plus rien, et les
-- fabricants disparaissent avec leurs rattachements.
--
-- Ce retour est destructif s'il existe des fabricants : il retire leurs
-- lignes et `fabrication_lot.vendor_id`. Il n'a sa place que sur une base de
-- développement (A2.2, point 7).

DROP FUNCTION IF EXISTS azimut.detach_vendor_member(uuid, uuid);
DROP FUNCTION IF EXISTS azimut.attach_vendor_member(uuid, uuid);
DROP FUNCTION IF EXISTS azimut.create_vendor(uuid, text);

DROP POLICY role_insert ON azimut.proof;
CREATE POLICY role_insert ON azimut.proof AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin','designer','operator'])));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fabrication_lot','lot_support','support','support_face','support_version','proof'] LOOP
    EXECUTE format('DROP POLICY role_read ON azimut.%I', t);
    EXECUTE format(
      'CREATE POLICY role_read ON azimut.%I AS RESTRICTIVE FOR SELECT TO authenticated '
      'USING (org_id IN (SELECT azimut.user_org_ids_with_role(%L)))',
      t, ARRAY['admin','designer','owner_rep','operator','auditor']);
  END LOOP;
END;
$$;

DROP INDEX IF EXISTS azimut.idx_fabrication_lot_vendor;
ALTER TABLE azimut.fabrication_lot DROP CONSTRAINT IF EXISTS fabrication_lot_vendor_id_fkey;
ALTER TABLE azimut.fabrication_lot DROP COLUMN IF EXISTS vendor_id;

REVOKE ALL ON azimut.vendor_member FROM azimut_membership_admin;
REVOKE ALL ON azimut.vendor FROM azimut_membership_admin;
-- Ensemble : la politique de lecture de `vendor` lit `vendor_member`.
DROP TABLE IF EXISTS azimut.vendor_member, azimut.vendor;
