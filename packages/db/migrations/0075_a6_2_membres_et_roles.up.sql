-- A6.2 et T-0.5 : les membres et les rôles s'appliquent en base.
--
-- Avant cette migration, la politique `membership_own_rows` (0025) admettait
-- toute ligne dont `user_id` était l'utilisateur courant : n'importe quel
-- connecté pouvait s'inscrire dans une organisation qui n'était pas la sienne,
-- au rôle de son choix, `admin` compris. Et aucune politique ne lisait
-- `membership.role` : les sept rôles d'A6.2 n'avaient aucun effet.
--
-- Ce qui change :
--
-- 1. Aucune écriture directe dans `membership`. Inscrire, changer un rôle et
--    retirer un membre passent par trois fonctions, réservées à l'`admin` de
--    l'organisation, avec la garde du dernier administrateur (O3,
--    ACCOUNT.LAST_ADMIN). Créer une organisation passe par une quatrième, qui
--    inscrit son créateur comme premier `admin`.
-- 2. Une organisation ne se modifie que par son `admin`.
-- 3. Le septième rôle, `marketing`, entre dans la contrainte (A5.1).
-- 4. Des politiques restrictives par rôle, sur toutes les tables portant
--    `org_id`, s'ajoutent aux politiques d'organisation : elles ne relâchent
--    rien, elles ne font que retrancher. Elles appliquent seulement ce
--    qu'A6.2 dit sans ambiguïté :
--      - `auditor` lit tout, journaux compris, et n'écrit rien ;
--      - `owner_rep` lit tout et n'écrit que la validation et l'annotation ;
--      - `designer` ne valide pas ;
--      - seul l'`admin` écrit les chartes et les membres ;
--      - `vendor` ne voit rien tant que le rattachement à son lot n'existe pas
--        (sa visibilité est « par rattachement explicite, pas par
--        organisation ») ;
--      - `marketing` ne voit rien : aucune table de son module n'existe encore.
--    La répartition des autres tables entre `designer` et `operator` n'est pas
--    écrite dans le cahier par table : elle reste ouverte, les deux écrivent.
--
-- Pourquoi un rôle propriétaire. Comme pour la file des travaux (0071), une
-- fonction SECURITY DEFINER possédée par le propriétaire des tables ne
-- verrait rien sous FORCE : elle ne pourrait ni vérifier qu'un appelant est
-- administrateur d'une organisation dont il voit les lignes, ni inscrire le
-- premier administrateur d'une organisation vide. Les fonctions appartiennent
-- donc à `azimut_membership_admin`, rôle sans connexion, auquel seules
-- s'adressent ses politiques, et que personne n'endosse.
--
-- Additive : aucune ligne existante n'est modifiée ni retirée (A2.2, point 7).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_membership_admin') THEN
    CREATE ROLE azimut_membership_admin NOLOGIN;
  END IF;
END;
$$;

-- ── 3. Le septième rôle ───────────────────────────────────────────────────

ALTER TABLE azimut.membership DROP CONSTRAINT membership_role_check;
ALTER TABLE azimut.membership ADD CONSTRAINT membership_role_check
  CHECK (role IN ('admin','designer','owner_rep','vendor','operator','auditor','marketing'));

-- ── Les organisations où l'utilisateur courant tient un rôle donné ────────
--
-- Chemin de recherche vide, lecture des seules lignes de l'utilisateur
-- courant. Elle appartient au rôle propriétaire (plus bas) et non au
-- propriétaire des tables : la politique de lecture de `membership` l'appelle,
-- et sous le propriétaire des tables elle relirait `membership` à travers
-- cette même politique, sans fin.
CREATE FUNCTION azimut.user_org_ids_with_role(p_roles text[])
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.org_id FROM azimut.membership m
  WHERE m.user_id = azimut.current_user_id() AND m.role = ANY (p_roles)
$$;

-- ── 1. `membership` : lecture seule pour l'application ────────────────────
--
-- Chacun lit ses propres lignes ; l'`admin` et l'`auditor` lisent celles de
-- leur organisation (A6.2 : l'admin gère les utilisateurs, l'auditeur lit
-- tout).
DROP POLICY membership_own_rows ON azimut.membership;

CREATE POLICY membership_read ON azimut.membership
  FOR SELECT TO authenticated
  USING (
    user_id = azimut.current_user_id()
    OR org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin','auditor']))
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.membership FROM authenticated;

-- ── 2. `organization` : création par fonction, modification par l'admin ───

DROP POLICY org_insert ON azimut.organization;
DROP POLICY org_update ON azimut.organization;
CREATE POLICY org_update ON azimut.organization
  FOR UPDATE TO authenticated
  USING (id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])))
  WITH CHECK (id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
REVOKE INSERT, DELETE, TRUNCATE ON azimut.organization FROM authenticated;

-- ── Ce que le rôle propriétaire des fonctions voit ───────────────────────

GRANT USAGE ON SCHEMA azimut TO azimut_membership_admin;

-- `current_user_id()` lit `auth.uid()` quand la plateforme le fournit : le
-- rôle propriétaire doit pouvoir l'atteindre, comme `authenticated`. Sur une
-- installation sans schéma `auth`, il n'y a rien à accorder. Si le rôle qui
-- migre n'a pas le droit de l'accorder, la migration le signale au lieu
-- d'échouer, et le pas se fait à la main (ORDRE.md) ; d'ici là, les fonctions
-- refusent au lieu d'ouvrir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    GRANT USAGE ON SCHEMA auth TO azimut_membership_admin;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'GRANT USAGE ON SCHEMA auth TO azimut_membership_admin refusé : à exécuter par un rôle d''administration (ORDRE.md, 0075).';
END;
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.membership TO azimut_membership_admin;
GRANT SELECT, INSERT ON azimut.organization TO azimut_membership_admin;

CREATE POLICY membership_admin_all ON azimut.membership
  FOR ALL TO azimut_membership_admin USING (true) WITH CHECK (true);
CREATE POLICY org_membership_admin_insert ON azimut.organization
  FOR INSERT TO azimut_membership_admin WITH CHECK (true);
CREATE POLICY org_membership_admin_select ON azimut.organization
  FOR SELECT TO azimut_membership_admin USING (true);

-- ── Les quatre fonctions ──────────────────────────────────────────────────
--
-- Le refus est le même qu'une organisation existe ou non, et que l'appelant y
-- soit membre ou non : `EDIT.WRITE_REFUSED`, sans autre détail. Un refus qui
-- différerait révélerait l'existence d'une organisation d'autrui (A6.1).

CREATE FUNCTION azimut.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid := azimut.current_user_id();
  v_org uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO azimut.organization (name, slug) VALUES (p_name, p_slug)
  RETURNING id INTO v_org;
  INSERT INTO azimut.membership (org_id, user_id, role) VALUES (v_org, v_me, 'admin');
  RETURN v_org;
END;
$$;

-- Vrai si l'utilisateur courant est `admin` de l'organisation. Lue par le
-- rôle propriétaire, donc sur toutes les lignes, mais elle ne répond que pour
-- l'utilisateur courant : elle n'apprend rien d'autrui.
CREATE FUNCTION azimut.is_org_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM azimut.membership m
    WHERE m.org_id = p_org AND m.user_id = azimut.current_user_id() AND m.role = 'admin'
  )
$$;

-- Le dernier administrateur ne peut ni être retiré ni changer de rôle (O3).
CREATE FUNCTION azimut.guard_last_admin(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM azimut.membership m
    WHERE m.org_id = p_org AND m.user_id = p_user AND m.role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM azimut.membership m
    WHERE m.org_id = p_org AND m.role = 'admin' AND m.user_id <> p_user
  ) THEN
    RAISE EXCEPTION 'ACCOUNT.LAST_ADMIN' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Inscrire un membre, ou changer son rôle. Réservé à l'`admin`.
CREATE FUNCTION azimut.set_member(p_org uuid, p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT azimut.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  IF p_role <> 'admin' THEN
    PERFORM azimut.guard_last_admin(p_org, p_user);
  END IF;
  INSERT INTO azimut.membership (org_id, user_id, role) VALUES (p_org, p_user, p_role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- Retirer un membre. Réservé à l'`admin`.
CREATE FUNCTION azimut.remove_member(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT azimut.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  PERFORM azimut.guard_last_admin(p_org, p_user);
  DELETE FROM azimut.membership WHERE org_id = p_org AND user_id = p_user;
END;
$$;

-- ── Propriété et droits d'exécution ───────────────────────────────────────
--
-- Comme en 0071 : le droit de créer dans le schéma ne sert qu'au changement
-- de propriétaire, et il est retiré aussitôt.
GRANT CREATE ON SCHEMA azimut TO azimut_membership_admin;
ALTER FUNCTION azimut.user_org_ids_with_role(text[]) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.create_organization(text, text) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.is_org_admin(uuid) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.guard_last_admin(uuid, uuid) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.set_member(uuid, uuid, text) OWNER TO azimut_membership_admin;
ALTER FUNCTION azimut.remove_member(uuid, uuid) OWNER TO azimut_membership_admin;
REVOKE CREATE ON SCHEMA azimut FROM azimut_membership_admin;

REVOKE ALL ON FUNCTION azimut.user_org_ids_with_role(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.create_organization(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.is_org_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.guard_last_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.set_member(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.remove_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.user_org_ids_with_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.create_organization(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.set_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.remove_member(uuid, uuid) TO authenticated;
-- `is_org_admin` et `guard_last_admin` ne sont appelées que par les deux
-- fonctions ci-dessus, qui tournent sous le même propriétaire.

-- ── 4. Politiques restrictives par rôle ───────────────────────────────────
--
-- Une politique RESTRICTIVE se combine par ET avec les politiques ordinaires :
-- celles d'organisation continuent de s'appliquer, et celles-ci ne peuvent
-- que retrancher. Toute table portant `org_id`, sauf `membership` traitée
-- plus haut, en reçoit quatre : lecture, insertion, modification, suppression.
-- Les quatre tables en insertion seule d'A12.3 n'en reçoivent que deux,
-- lecture et insertion : aucune politique, même restrictive, n'y nomme la
-- modification ni la suppression.
--
-- Une table nouvelle portant `org_id` doit les recevoir dans sa migration
-- (A13.3) ; l'essai `a6-2-roles.db.test.ts` échoue sinon.
DO $$
DECLARE
  t text;
  readers text[] := ARRAY['admin','designer','owner_rep','operator','auditor'];
  writers text[];
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'azimut' AND c.column_name = 'org_id'
      AND tb.table_type = 'BASE TABLE' AND c.table_name <> 'membership'
    ORDER BY c.table_name
  LOOP
    writers := CASE
      -- Validation des bons à tirer : `owner_rep` ; l'`admin` peut « tout ».
      WHEN t = 'approval' THEN ARRAY['admin','owner_rep']
      -- Décision sur le tableau des messages : `owner_rep` seul, celui qui
      -- génère ne peut pas approuver (partie R).
      WHEN t = 'message_schedule_approval' THEN ARRAY['owner_rep']
      -- Annotation de revue (partie R) : admin, designer, owner_rep.
      WHEN t IN ('review_annotation','review_annotation_reply')
        THEN ARRAY['admin','designer','owner_rep']
      -- Chartes et lexique : l'`admin` seul (A6.2, « y compris chartes »).
      WHEN t IN ('charter','charter_color','charter_typeface','charter_rule','lexicon_term')
        THEN ARRAY['admin']
      -- Le journal d'audit reçoit les actions de tous ceux qui écrivent.
      WHEN t = 'audit_log' THEN ARRAY['admin','designer','owner_rep','operator']
      ELSE ARRAY['admin','designer','operator']
    END;

    EXECUTE format(
      'CREATE POLICY role_read ON azimut.%I AS RESTRICTIVE FOR SELECT TO authenticated '
      'USING (org_id IN (SELECT azimut.user_org_ids_with_role(%L)))', t, readers);
    EXECUTE format(
      'CREATE POLICY role_insert ON azimut.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      'WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(%L)))', t, writers);
    CONTINUE WHEN t IN ('audit_log','approval','graph_validation','message_schedule_approval');
    EXECUTE format(
      'CREATE POLICY role_update ON azimut.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      'USING (org_id IN (SELECT azimut.user_org_ids_with_role(%L))) '
      'WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(%L)))', t, writers, writers);
    EXECUTE format(
      'CREATE POLICY role_delete ON azimut.%I AS RESTRICTIVE FOR DELETE TO authenticated '
      'USING (org_id IN (SELECT azimut.user_org_ids_with_role(%L)))', t, writers);
  END LOOP;
END;
$$;
