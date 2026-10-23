-- Lot 9 de l'audit (A12.3) : le journal écrit par la base, et lui seul.
--
-- 1. `audit_log` n'est plus écrit par l'application : `authenticated` perd
--    l'insertion, qui permettait de forger une entrée et son auteur. Le
--    journal est écrit par les déclencheurs ci-dessous, sous un rôle
--    propriétaire sans connexion, `azimut_audit`, qui ne peut qu'y insérer.
--    L'auteur est toujours l'identité de la requête (`current_user_id()`).
-- 2. Les cinq événements minimaux d'A12.3, chacun par son déclencheur :
--     - validation ou rejet d'un bon à tirer : insertion dans `approval` ;
--     - changement de paquet de règles rattaché à un site : insertion,
--       modification ou retrait dans `site_rules_binding` ;
--     - publication d'un paquet de borne : insertion dans `kiosk_package` ;
--     - suppression logique d'une entité : `deleted_at` qui prend une valeur
--       (et sa levée, qui la rétablit) ;
--     - changement de rôle d'un membre : modification de `membership.role`.
-- 3. Les valeurs journalisées sont nommées colonne par colonne : identifiants,
--    états, rôles, empreintes. Aucun texte libre (commentaire, motif), aucun
--    secret, aucun jeton n'y entre.
--
-- Additive : un rôle, des fonctions et des déclencheurs neufs ; un droit
-- retiré (A2.2, point 7).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_audit') THEN
    CREATE ROLE azimut_audit NOLOGIN;
  END IF;
END;
$$;

REVOKE INSERT ON azimut.audit_log FROM authenticated;

GRANT USAGE ON SCHEMA azimut TO azimut_audit;
GRANT INSERT (org_id, actor_id, action, entity, entity_id, before, after, occurred_at)
  ON azimut.audit_log TO azimut_audit;
CREATE POLICY audit_writer_insert ON azimut.audit_log
  FOR INSERT TO azimut_audit
  WITH CHECK (true);

-- L'écriture d'une entrée. Réservée aux déclencheurs : personne d'autre ne
-- l'exécute. L'heure est celle de l'événement (`clock_timestamp()`), et non
-- celle du début de la transaction : deux événements d'une même transaction
-- gardent leur ordre.
CREATE FUNCTION azimut.write_audit(
  p_org uuid, p_action text, p_entity text, p_entity_id uuid, p_before jsonb, p_after jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO azimut.audit_log (org_id, actor_id, action, entity, entity_id, before, after, occurred_at)
  VALUES (p_org, azimut.current_user_id(), p_action, p_entity, p_entity_id, p_before, p_after,
          clock_timestamp())
$$;
REVOKE ALL ON FUNCTION azimut.write_audit(uuid, text, text, uuid, jsonb, jsonb) FROM PUBLIC;

CREATE FUNCTION azimut.audit_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.write_audit(NEW.org_id, 'proof.' || NEW.decision, 'proof', NEW.proof_id, NULL,
    jsonb_build_object('approval_id', NEW.id, 'decision', NEW.decision, 'reviewer_id', NEW.reviewer_id));
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.audit_rules_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_before jsonb := CASE WHEN TG_OP <> 'INSERT'
    THEN jsonb_build_object('rules_pack_id', OLD.rules_pack_id, 'role', OLD.role) END;
  row_after jsonb := CASE WHEN TG_OP <> 'DELETE'
    THEN jsonb_build_object('rules_pack_id', NEW.rules_pack_id, 'role', NEW.role) END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM azimut.write_audit(OLD.org_id, 'site.rules_binding_changed', 'site', OLD.site_id, row_before, NULL);
  ELSE
    PERFORM azimut.write_audit(NEW.org_id, 'site.rules_binding_changed', 'site', NEW.site_id, row_before, row_after);
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.audit_kiosk_package() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.write_audit(NEW.org_id, 'kiosk_package.published', 'kiosk_package', NEW.id, NULL,
    jsonb_build_object('site_id', NEW.site_id, 'version', NEW.version, 'content_hash', NEW.content_hash));
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.audit_soft_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.write_audit(NEW.org_id,
    CASE WHEN NEW.deleted_at IS NULL THEN 'entity.restored' ELSE 'entity.soft_deleted' END,
    TG_TABLE_NAME, NEW.id,
    jsonb_build_object('deleted_at', OLD.deleted_at), jsonb_build_object('deleted_at', NEW.deleted_at));
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.audit_membership_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.write_audit(NEW.org_id, 'membership.role_changed', 'membership', NEW.id,
    jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role),
    jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
  RETURN NULL;
END;
$$;

-- Les six fonctions appartiennent au rôle d'écriture du journal. Leur
-- exécution n'est accordée à personne : un déclencheur n'a pas besoin du
-- droit d'exécuter sa fonction.
GRANT CREATE ON SCHEMA azimut TO azimut_audit;
ALTER FUNCTION azimut.write_audit(uuid, text, text, uuid, jsonb, jsonb) OWNER TO azimut_audit;
ALTER FUNCTION azimut.audit_approval() OWNER TO azimut_audit;
ALTER FUNCTION azimut.audit_rules_binding() OWNER TO azimut_audit;
ALTER FUNCTION azimut.audit_kiosk_package() OWNER TO azimut_audit;
ALTER FUNCTION azimut.audit_soft_delete() OWNER TO azimut_audit;
ALTER FUNCTION azimut.audit_membership_role() OWNER TO azimut_audit;
REVOKE CREATE ON SCHEMA azimut FROM azimut_audit;
REVOKE ALL ON FUNCTION azimut.audit_approval() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.audit_rules_binding() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.audit_kiosk_package() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.audit_soft_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.audit_membership_role() FROM PUBLIC;

CREATE TRIGGER audit_event AFTER INSERT ON azimut.approval
  FOR EACH ROW EXECUTE FUNCTION azimut.audit_approval();
CREATE TRIGGER audit_event AFTER INSERT OR UPDATE OR DELETE ON azimut.site_rules_binding
  FOR EACH ROW EXECUTE FUNCTION azimut.audit_rules_binding();
CREATE TRIGGER audit_event AFTER INSERT ON azimut.kiosk_package
  FOR EACH ROW EXECUTE FUNCTION azimut.audit_kiosk_package();
CREATE TRIGGER audit_event AFTER UPDATE OF role ON azimut.membership
  FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION azimut.audit_membership_role();

-- Chaque table qui porte une suppression logique, aujourd'hui et demain :
-- `audit-events.db.test.ts` signale celle qui n'a pas le déclencheur.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND c.relkind = 'r' AND a.attname = 'deleted_at' AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE TRIGGER audit_soft_delete AFTER UPDATE OF deleted_at ON azimut.%I '
      'FOR EACH ROW WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) '
      'EXECUTE FUNCTION azimut.audit_soft_delete()', t);
  END LOOP;
END $$;
