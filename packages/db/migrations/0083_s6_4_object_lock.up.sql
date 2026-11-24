-- S6.4 — le verrou ferme, tenu par la base.
--
-- S-20 : « Un objet en cours d'édition est verrouillé fermement pour les
-- autres pendant la session, et non plus seulement à titre consultatif. Le
-- verrou tombe à la fin du geste ou à l'expiration. »
--
-- Décisions d'Oss53pa consignées dans `docs/decoupage-s6-edition-simultanee.md` :
--   Q1 — `object_lock`, cloisonnée par organisation ;
--   Q2 — verrou ferme, refusé en base aux autres ; il tombe à la fin du geste
--        ou à une expiration courte renouvelée pendant le geste ; aucun
--        passage en force ;
--   Q5 — aucun code nouveau : le refus se dit `EDIT.OBJECT_LOCKED`.
--
-- Où se tient le refus. Le poste peut écrire une table par `apply_commands`,
-- par `apply_journaled_commands`, ou directement par PostgREST. Un contrôle
-- posé dans les deux fonctions laisserait passer le troisième chemin : « un
-- second client qui contourne l'interface passe outre ». Le refus est donc un
-- déclencheur BEFORE UPDATE OR DELETE, posé sur chaque table métier, qui
-- s'exécute quel que soit le chemin. Il lève l'état `PT423`, que PostgREST
-- rend en statut 423 : l'écran distingue un objet verrouillé d'une commande
-- périmée (409).
--
-- Ce que le verrou ne retient pas : une écriture sans utilisateur courant
-- (travaux du service, migrations). Le verrou départage des personnes ; il
-- n'arrête pas la plateforme.
--
-- Expiration : 60 secondes, renouvelées par le poste pendant le geste.
-- Constante technique, sans origine normative (décision Q2 : « courte »),
-- à mesurer selon D13. Un poste coupé ne bloque donc personne plus d'une
-- minute : c'est le recours que G4.2 et T-1.16 exigent, sans passage en
-- force.
--
-- La table ne figure ni en A5 ni en S9 ; elle est signalée à l'éditeur.
--
-- Additive : une table neuve, des fonctions et des déclencheurs neufs. Aucune
-- ligne existante n'est lue ni transformée (A2.2, point 7).

-- ── 1. La table ────────────────────────────────────────────────────────────

CREATE TABLE azimut.object_lock (
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  target_table text NOT NULL CHECK (target_table ~ '^[a-z][a-z_]{0,62}$'),
  target_id uuid NOT NULL,
  -- Sans renvoi vers `auth.users` (A2.4, 0024).
  holder_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (target_table, target_id),
  CONSTRAINT object_lock_expiry_after_acquisition CHECK (expires_at > acquired_at)
);

CREATE INDEX idx_object_lock_org ON azimut.object_lock(org_id);

-- ── 2. Cloisonnement (A6.1) et rôles (0076, 0079, 0080) ────────────────────
--
-- Les membres voient les verrous de leurs organisations : c'est ce qui permet
-- de dire qui tient l'objet. Chacun ne pose et ne lève que les siens.

ALTER TABLE azimut.object_lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.object_lock FORCE ROW LEVEL SECURITY;

CREATE POLICY object_lock_org_select ON azimut.object_lock
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY object_lock_own_insert ON azimut.object_lock
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()) AND holder_id = azimut.current_user_id());

-- Un verrou expiré peut être repris par un autre membre : la modification
-- porte sur une ligne expirée, ou sur la sienne.
CREATE POLICY object_lock_own_update ON azimut.object_lock
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND (holder_id = azimut.current_user_id() OR expires_at <= now()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()) AND holder_id = azimut.current_user_id());

CREATE POLICY object_lock_own_delete ON azimut.object_lock
  FOR DELETE TO authenticated
  USING (holder_id = azimut.current_user_id());

CREATE POLICY object_lock_auditor_no_insert ON azimut.object_lock
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY object_lock_auditor_no_update ON azimut.object_lock
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')))
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY object_lock_auditor_no_delete ON azimut.object_lock
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY object_lock_marketing_no_access ON azimut.object_lock
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')))
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
CREATE POLICY object_lock_mfa_required ON azimut.object_lock
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()))
  WITH CHECK (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.object_lock TO authenticated;
REVOKE TRUNCATE ON azimut.object_lock FROM authenticated;

-- ── 3. Le refus, quel que soit le chemin d'écriture ────────────────────────

-- La garde s'exécute avec les droits du propriétaire : un rôle de service qui
-- écrit une table métier n'a pas à lire `object_lock`, et ne doit pas échouer
-- pour cela. Les politiques de `object_lock` restent appliquées (FORCE) : la
-- garde ne voit que les verrous des organisations de l'utilisateur courant,
-- et rien sans utilisateur. L'utilisateur courant n'est consulté que si un
-- verrou vivant existe sur la ligne : sans réglage de session, la fonction
-- qui le donne se rabat sur la plateforme, que tous les rôles ne peuvent pas
-- interroger.

CREATE FUNCTION azimut.locked_by_other(p_table text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  v_holder uuid;
  v_me uuid;
BEGIN
  SELECT l.holder_id INTO v_holder FROM azimut.object_lock l
  WHERE l.target_table = p_table AND l.target_id = p_id AND l.expires_at > now();
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  v_me := azimut.current_user_id();
  RETURN v_me IS NOT NULL AND v_holder IS DISTINCT FROM v_me;
END;
$$;

CREATE FUNCTION azimut.guard_object_lock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF azimut.locked_by_other(TG_TABLE_NAME, OLD.id) THEN
    RAISE EXCEPTION 'objet verrouillé' USING ERRCODE = 'PT423';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION azimut.locked_by_other(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.guard_object_lock() FROM PUBLIC;

-- Sur chaque table que le poste peut modifier : celles qui portent `org_id`
-- et un identifiant `id`, et sur lesquelles le rôle `authenticated` a le
-- droit UPDATE ou DELETE. Les tables que le service écrit seul (0077) n'ont
-- rien à départager entre personnes. Hors aussi les tables d'état du poste.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND c.relkind IN ('r', 'p')
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'id' AND NOT a.attisdropped)
      AND (pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE')
           OR pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE'))
      AND c.relname NOT IN ('object_lock', 'level_presence')
      AND NOT c.relispartition
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE TRIGGER guard_object_lock BEFORE UPDATE OR DELETE ON azimut.%I '
      'FOR EACH ROW EXECUTE FUNCTION azimut.guard_object_lock()', t);
  END LOOP;
END;
$$;

-- ── 4. Poser, renouveler, lever ────────────────────────────────────────────
--
-- `acquire_object_lock` pose le verrou, ou le renouvelle s'il est déjà à
-- l'appelant, ou le reprend s'il a expiré. Tenu par un autre et vivant, il
-- refuse en `PT423`. L'objet doit exister et être visible de l'appelant ; un
-- objet invisible et un objet absent se refusent de la même façon (A6.1).
-- Sous les droits et les politiques de l'appelant.

CREATE FUNCTION azimut.acquire_object_lock(p_table text, p_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
  v_expires timestamptz := now() + interval '60 seconds';
  v_holder uuid;
BEGIN
  IF p_table IS NULL OR p_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger tr
    JOIN pg_catalog.pg_class c ON c.oid = tr.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND c.relname = p_table AND tr.tgname = 'guard_object_lock'
  ) THEN
    RAISE EXCEPTION 'verrou refusé' USING ERRCODE = '42501';
  END IF;

  EXECUTE format('SELECT org_id FROM azimut.%I WHERE id = $1', p_table) INTO v_org USING p_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'verrou refusé' USING ERRCODE = '42501';
  END IF;

  -- Deux poses simultanées du même objet se sérialisent ici.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_table || ':' || p_id::text, 6004));

  SELECT l.holder_id INTO v_holder FROM azimut.object_lock l
  WHERE l.target_table = p_table AND l.target_id = p_id AND l.expires_at > now();
  IF v_holder IS NOT NULL AND v_holder IS DISTINCT FROM azimut.current_user_id() THEN
    RAISE EXCEPTION 'objet verrouillé' USING ERRCODE = 'PT423';
  END IF;

  INSERT INTO azimut.object_lock(org_id, target_table, target_id, holder_id, acquired_at, expires_at)
  VALUES (v_org, p_table, p_id, azimut.current_user_id(), now(), v_expires)
  ON CONFLICT (target_table, target_id)
  DO UPDATE SET holder_id = EXCLUDED.holder_id, acquired_at = EXCLUDED.acquired_at,
                expires_at = EXCLUDED.expires_at, org_id = EXCLUDED.org_id;
  RETURN v_expires;
END;
$$;

CREATE FUNCTION azimut.release_object_lock(p_table text, p_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  DELETE FROM azimut.object_lock
  WHERE target_table = p_table AND target_id = p_id AND holder_id = azimut.current_user_id();
$$;

-- Les verrous vivants d'un site, avec ce qu'il faut pour nommer leur
-- détenteur (`member_label`, 0081). Lus par le poste pour marquer les objets
-- tenus par d'autres.
CREATE FUNCTION azimut.live_object_locks(p_org uuid)
RETURNS TABLE (target_table text, target_id uuid, holder_id uuid, display_name text, role text, expires_at timestamptz)
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT l.target_table, l.target_id, l.holder_id, lbl.display_name, lbl.role, l.expires_at
  FROM azimut.object_lock l
  CROSS JOIN LATERAL azimut.member_label(l.org_id, l.holder_id) AS lbl
  WHERE l.org_id = p_org AND l.expires_at > now()
  ORDER BY l.target_table, l.target_id;
$$;

REVOKE ALL ON FUNCTION azimut.acquire_object_lock(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.release_object_lock(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.live_object_locks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.acquire_object_lock(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.release_object_lock(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.live_object_locks(uuid) TO authenticated;
