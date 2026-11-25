-- M02.W11 tenue par la base : révision du graphe, validation par le service,
-- garde sur la soumission du tableau des messages.
--
-- M02.W11 : « Le tableau des messages ne peut être émis pour revue que si la
-- validation de complétude du graphe est passée, c'est-à-dire si le dernier
-- enregistrement de `graph_validation` du site est passé et porte l'empreinte
-- du graphe actuel. » R12 place la condition sur `draft` → `in_review`.
--
-- Jusqu'ici, la condition n'était tenue qu'au poste, et `graph_validation`
-- était écrite par le poste lui-même : la base ne pouvait pas en croire le
-- « passé ». Décisions d'Oss53pa du 24 novembre 2026, consignées dans
-- `docs/decoupage-barriere-validation.md` :
--   QB0 — la validation est faite par le service, et une garde en base refuse
--         la soumission sans passage réussi du service valant pour le graphe
--         actuel ;
--   QB1 — une table `graph_revision`, tenue par déclencheurs ; aucune table
--         existante n'est modifiée ;
--   QB3 — les passages écrits par des postes restent en base mais ne
--         comptent plus ;
--   QB4 — la garde ne contrôle que la soumission.
--
-- La base ne sait pas calculer l'empreinte (TypeScript). Elle tient donc un
-- compteur de révision du graphe de chaque site, incrémenté à toute écriture
-- d'un nœud, d'une arête ou d'une liaison verticale — les trois parties de
-- l'empreinte. Le service enregistre la révision qu'il a validée ; la garde
-- compare. La même table porte le passage du service qui l'atteste : la
-- validation par le service ne demande aucune colonne nouvelle ailleurs.
--
-- Additive : une table neuve, des fonctions et des déclencheurs neufs. Aucune
-- ligne existante n'est lue ni transformée (A2.2, point 7). Les tableaux déjà
-- en revue ne sont pas touchés : la garde ne joue qu'à la soumission.

-- ── 1. La table ────────────────────────────────────────────────────────────

CREATE TABLE azimut.graph_revision (
  site_id uuid PRIMARY KEY REFERENCES azimut.site(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  -- La dernière révision que le service a validée, et le passage qui
  -- l'atteste. Écrits par le service seul.
  validated_revision bigint CHECK (validated_revision >= 0),
  -- Sans clé étrangère : `graph_validation` est en insertion seule, une ligne
  -- citée ne peut pas disparaître, et `record_service_validation` vérifie que
  -- le passage existe et porte sur ce site. Une clé ferait échouer le vidage
  -- de `graph_validation` avant sa propre garde, avec un autre motif.
  validation_id uuid,
  CONSTRAINT graph_revision_validated_not_ahead
    CHECK (validated_revision IS NULL OR validated_revision <= revision),
  CONSTRAINT graph_revision_validation_pair
    CHECK ((validated_revision IS NULL) = (validation_id IS NULL))
);

CREATE INDEX idx_graph_revision_org ON azimut.graph_revision(org_id);

-- ── 2. Cloisonnement : lecture par les membres, écriture par la base seule ─
--
-- Aucun poste n'écrit cette table. Les déclencheurs et la fonction du service
-- s'y annoncent par un réglage de transaction, sur le modèle du garde de
-- `command_journal` (0078) ; aucune fonction exposée ne le pose.

ALTER TABLE azimut.graph_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.graph_revision FORCE ROW LEVEL SECURITY;

CREATE POLICY graph_revision_org_select ON azimut.graph_revision
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY graph_revision_writer ON azimut.graph_revision
  FOR ALL
  USING (current_setting('azimut.graph_revision_writer', true) = 'on')
  WITH CHECK (current_setting('azimut.graph_revision_writer', true) = 'on');

CREATE POLICY graph_revision_auditor_no_insert ON azimut.graph_revision
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              OR current_setting('azimut.graph_revision_writer', true) = 'on');
CREATE POLICY graph_revision_auditor_no_update ON azimut.graph_revision
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
         OR current_setting('azimut.graph_revision_writer', true) = 'on')
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              OR current_setting('azimut.graph_revision_writer', true) = 'on');
CREATE POLICY graph_revision_auditor_no_delete ON azimut.graph_revision
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY graph_revision_marketing_no_access ON azimut.graph_revision
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
         OR current_setting('azimut.graph_revision_writer', true) = 'on')
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
              OR current_setting('azimut.graph_revision_writer', true) = 'on');
CREATE POLICY graph_revision_mfa_required ON azimut.graph_revision
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa())
         OR current_setting('azimut.graph_revision_writer', true) = 'on')
  WITH CHECK (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa())
              OR current_setting('azimut.graph_revision_writer', true) = 'on');

GRANT SELECT ON azimut.graph_revision TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.graph_revision FROM authenticated;

-- ── 3. Incrémenter la révision à toute écriture du graphe ───────────────────
--
-- Le site d'une ligne : nœud → niveau → bâtiment ; arête par son nœud
-- d'origine ; liaison verticale par son arête. Une suppression propagée en
-- cascade peut trouver le parent déjà retiré : le déclencheur du parent a
-- alors incrémenté le site, et celui de l'enfant ne fait rien. La fonction
-- s'exécute avec les droits du propriétaire : un poste n'a aucun droit
-- d'écriture sur la table.

CREATE FUNCTION azimut.site_of_node(p_node uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT b.site_id FROM azimut.node n
  JOIN azimut.level l ON l.id = n.level_id
  JOIN azimut.building b ON b.id = l.building_id
  WHERE n.id = p_node;
$$;

CREATE FUNCTION azimut.site_of_level(p_level uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT b.site_id FROM azimut.level l
  JOIN azimut.building b ON b.id = l.building_id
  WHERE l.id = p_level;
$$;

CREATE FUNCTION azimut.bump_graph_revision(p_site uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_site IS NULL THEN
    RETURN;
  END IF;
  SELECT s.org_id INTO v_org FROM azimut.site s WHERE s.id = p_site;
  IF v_org IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('azimut.graph_revision_writer', 'on', true);
  INSERT INTO azimut.graph_revision(site_id, org_id, revision, changed_at)
  VALUES (p_site, v_org, 1, now())
  ON CONFLICT (site_id) DO UPDATE
    SET revision = azimut.graph_revision.revision + 1, changed_at = now();
  PERFORM set_config('azimut.graph_revision_writer', '', true);
END;
$$;

CREATE FUNCTION azimut.graph_revision_on_node()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM azimut.bump_graph_revision(azimut.site_of_level(OLD.level_id));
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'INSERT' OR NEW.level_id IS DISTINCT FROM OLD.level_id THEN
      PERFORM azimut.bump_graph_revision(azimut.site_of_level(NEW.level_id));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.graph_revision_on_edge()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM azimut.bump_graph_revision(azimut.site_of_node(OLD.from_node_id));
  ELSE
    PERFORM azimut.bump_graph_revision(azimut.site_of_node(NEW.from_node_id));
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.graph_revision_on_vertical_link()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_edge uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.edge_id ELSE NEW.edge_id END;
BEGIN
  PERFORM azimut.bump_graph_revision(azimut.site_of_node(
    (SELECT e.from_node_id FROM azimut.edge e WHERE e.id = v_edge)));
  RETURN NULL;
END;
$$;

CREATE TRIGGER graph_revision_on_node
  AFTER INSERT OR UPDATE OR DELETE ON azimut.node
  FOR EACH ROW EXECUTE FUNCTION azimut.graph_revision_on_node();
CREATE TRIGGER graph_revision_on_edge
  AFTER INSERT OR UPDATE OR DELETE ON azimut.edge
  FOR EACH ROW EXECUTE FUNCTION azimut.graph_revision_on_edge();
CREATE TRIGGER graph_revision_on_vertical_link
  AFTER INSERT OR UPDATE OR DELETE ON azimut.vertical_link
  FOR EACH ROW EXECUTE FUNCTION azimut.graph_revision_on_vertical_link();

REVOKE ALL ON FUNCTION azimut.site_of_node(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.site_of_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.bump_graph_revision(uuid) FROM PUBLIC;

-- ── 4. Le passage du service ───────────────────────────────────────────────
--
-- Appelée par le service seul (`session_is_compiler`, 0077), après qu'il a
-- inscrit son passage dans `graph_validation`. `p_revision` est la révision
-- qu'il a lue avec le site qu'il a validé, dans le même instantané : si le
-- graphe a bougé depuis, la révision enregistrée est en retard, et la garde
-- le verra. Un passage d'un autre site, ou plus ancien que celui déjà
-- enregistré, est refusé.

CREATE FUNCTION azimut.record_service_validation(p_site uuid, p_revision bigint, p_validation uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT azimut.session_is_compiler() THEN
    RAISE EXCEPTION 'validation recorded by the compiler service only' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM azimut.graph_validation v WHERE v.id = p_validation AND v.site_id = p_site) THEN
    RAISE EXCEPTION 'validation of another site' USING ERRCODE = '23514';
  END IF;
  SELECT s.org_id INTO v_org FROM azimut.site s WHERE s.id = p_site;
  PERFORM set_config('azimut.graph_revision_writer', 'on', true);
  INSERT INTO azimut.graph_revision(site_id, org_id, revision, changed_at, validated_revision, validation_id)
  VALUES (p_site, v_org, p_revision, now(), p_revision, p_validation)
  ON CONFLICT (site_id) DO UPDATE
    SET validated_revision = EXCLUDED.validated_revision, validation_id = EXCLUDED.validation_id
    WHERE azimut.graph_revision.validated_revision IS NULL
       OR azimut.graph_revision.validated_revision <= EXCLUDED.validated_revision;
  PERFORM set_config('azimut.graph_revision_writer', '', true);
END;
$$;

REVOKE ALL ON FUNCTION azimut.record_service_validation(uuid, bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.record_service_validation(uuid, bigint, uuid) TO azimut_compiler;

-- ── 5. La garde de la soumission (QB4) ─────────────────────────────────────
--
-- `draft` → `in_review` exige que la révision validée par le service soit la
-- révision actuelle du graphe, et que son passage soit réussi. Le refus porte
-- l'état `PT412` (condition préalable non remplie), que PostgREST rend en 412.

CREATE FUNCTION azimut.guard_schedule_submission()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.state = 'draft' AND NEW.state = 'in_review' AND NOT EXISTS (
    SELECT 1 FROM azimut.graph_revision r
    JOIN azimut.graph_validation v ON v.id = r.validation_id
    WHERE r.site_id = NEW.site_id
      AND r.validated_revision = r.revision
      AND v.passed
  ) THEN
    RAISE EXCEPTION 'graph not validated for its current revision' USING ERRCODE = 'PT412';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_schedule_submission
  BEFORE UPDATE OF state ON azimut.message_schedule
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_schedule_submission();

REVOKE ALL ON FUNCTION azimut.guard_schedule_submission() FROM PUBLIC;
