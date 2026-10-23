-- Retour de 0075 : les politiques par rôle disparaissent, et `membership`
-- retrouve la politique de 0025.
--
-- Ce retour rouvre l'auto-inscription que 0075 ferme : il n'a sa place que
-- sur une base de développement. Il échoue, et doit échouer, si un membre
-- porte le rôle `marketing` : la contrainte de 0002 ne l'admet pas, et le
-- retour ne retire aucune ligne (A2.2, point 7).
--
-- Le rôle `azimut_membership_admin` est de grappe : il reste, sans droit ni
-- fonction, comme les rôles de 0071.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'azimut' AND policyname IN ('role_read','role_insert','role_update','role_delete')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS role_read ON azimut.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS role_insert ON azimut.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS role_update ON azimut.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS role_delete ON azimut.%I', t);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS org_membership_admin_select ON azimut.organization;
DROP POLICY IF EXISTS org_membership_admin_insert ON azimut.organization;
DROP POLICY IF EXISTS membership_admin_all ON azimut.membership;

DROP POLICY IF EXISTS org_update ON azimut.organization;
CREATE POLICY org_insert ON azimut.organization
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY org_update ON azimut.organization
  FOR UPDATE TO authenticated
  USING (id IN (SELECT azimut.user_org_ids()));
GRANT INSERT, DELETE, TRUNCATE ON azimut.organization TO authenticated;

DROP POLICY IF EXISTS membership_read ON azimut.membership;
CREATE POLICY membership_own_rows ON azimut.membership
  FOR ALL TO authenticated
  USING (user_id = azimut.current_user_id())
  WITH CHECK (user_id = azimut.current_user_id());
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON azimut.membership TO authenticated;

DROP FUNCTION IF EXISTS azimut.remove_member(uuid, uuid);
DROP FUNCTION IF EXISTS azimut.set_member(uuid, uuid, text);
DROP FUNCTION IF EXISTS azimut.guard_last_admin(uuid, uuid);
DROP FUNCTION IF EXISTS azimut.is_org_admin(uuid);
DROP FUNCTION IF EXISTS azimut.create_organization(text, text);
DROP FUNCTION IF EXISTS azimut.user_org_ids_with_role(text[]);

REVOKE ALL ON azimut.membership FROM azimut_membership_admin;
REVOKE ALL ON azimut.organization FROM azimut_membership_admin;
REVOKE USAGE ON SCHEMA azimut FROM azimut_membership_admin;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    REVOKE USAGE ON SCHEMA auth FROM azimut_membership_admin;
  END IF;
END;
$$;

ALTER TABLE azimut.membership DROP CONSTRAINT membership_role_check;
ALTER TABLE azimut.membership ADD CONSTRAINT membership_role_check
  CHECK (role IN ('admin','designer','owner_rep','vendor','operator','auditor'));
