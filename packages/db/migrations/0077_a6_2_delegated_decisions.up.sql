-- A6.2 — trois décisions de droits, tranchées par Oss53pa le 23 octobre 2026
-- (« applique la meilleure pratique »), sur trois points que le cahier des
-- charges laissait ouverts après 0076.
--
--   1. Bon à tirer : `owner_rep` seul. A6.2 donne à `admin` « tout dans son
--      organisation », mais R2 (partie R) pose pour le tableau des messages la
--      séparation « celui qui génère ne peut pas approuver ». La même
--      séparation vaut ici : la maîtrise d'ouvrage valide ce que la conception
--      produit. La règle la plus étroite est retenue ; l'élargir plus tard ne
--      coûte qu'une politique.
--
--   2. `vendor` : aucun accès, jusqu'à L4.1. A6.2 lui donne « lecture des
--      exécutions du seul lot qui lui est rattaché », et ce rattachement
--      n'existe pas en A5 : L4.1 le place à l'incrément 4. Sans lui, la seule
--      lecture sûre est aucune. L'organisation d'un `vendor` sort donc de
--      `user_org_ids()`, dont dépendent toutes les politiques génériques.
--
--   3. `job` et `kiosk_package` : leur cycle de vie appartient au service de
--      compilation. Le chemin de T-0.11 ne change pas — le service clôt un
--      travail et enregistre un paquet sous l'identité du demandeur — mais
--      ces écritures ne sont admises que d'une session ouverte par le service :
--      `session_user` membre de `azimut_compiler`. Une session de l'API
--      (`authenticator`) ne l'est pas, et ne peut le devenir par aucun réglage
--      qu'elle poserait elle-même. Un membre peut encore créer un travail, mais
--      seulement en file, sans résultat ni état forgés.
--
-- Aucune colonne, aucune ligne : une politique, une fonction redéfinie, deux
-- déclencheurs (A2.2-7).

-- ── 1. approval : owner_rep seul ──────────────────────────────────────────

DROP POLICY IF EXISTS approval_org_insert ON azimut.approval;
CREATE POLICY approval_org_insert ON azimut.approval
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
    AND reviewer_id = azimut.current_user_id()
  );

-- ── 2. vendor : hors des organisations visibles ───────────────────────────

CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership
  WHERE user_id = azimut.current_user_id() AND role <> 'vendor';
$$;

-- ── 3. job et kiosk_package : écrits par le service seul ──────────────────

-- La session vient-elle du service ? `session_user` est le rôle de connexion,
-- que `SET ROLE` ne change pas.
CREATE FUNCTION azimut.session_is_compiler()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.pg_has_role(session_user, 'azimut_compiler', 'MEMBER');
$$;

CREATE FUNCTION azimut.guard_job_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF azimut.session_is_compiler() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'queued' OR NEW.attempts <> 0 OR NEW.result IS NOT NULL
       OR NEW.started_at IS NOT NULL OR NEW.finished_at IS NOT NULL OR NEW.error IS NOT NULL THEN
      RAISE EXCEPTION 'job is created queued; its lifecycle belongs to the compiler service';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'job lifecycle belongs to the compiler service';
END;
$$;

CREATE TRIGGER guard_job_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON azimut.job
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_job_lifecycle();

CREATE FUNCTION azimut.guard_kiosk_package_writer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF azimut.session_is_compiler() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'kiosk_package is written by the compiler service only';
END;
$$;

CREATE TRIGGER guard_kiosk_package_writer
  BEFORE INSERT OR UPDATE OR DELETE ON azimut.kiosk_package
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_kiosk_package_writer();
