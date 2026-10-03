-- T-0.11 et D9.2 — la file des travaux en base, prise par le service de
-- compilation sans lever le cloisonnement.
--
-- Le service prend les travaux de toutes les organisations ; sous FORCE ROW
-- LEVEL SECURITY (0025), il ne voit rien sans identité. Option retenue par
-- l'utilisatrice : des fonctions de prise, et rien d'autre. Le service tourne
-- sous `azimut_compiler`, rôle sans aucun droit sur les tables. Il n'apprend
-- de la file que l'identifiant, l'organisation, le type, le demandeur et le
-- nombre de tentatives d'un travail. Tout le reste — lecture du contenu, du
-- site, écriture du résultat, remise en file — se fait sous l'identité du
-- demandeur (0070), par les politiques ordinaires.
--
-- Pourquoi un second rôle. Une fonction SECURITY DEFINER s'exécute sous son
-- propriétaire, et FORCE soumet aussi le propriétaire des tables aux
-- politiques : possédées par lui, ces fonctions ne verraient rien. Ouvrir une
-- politique au propriétaire l'ouvrirait aussi à toute connexion qui se fait
-- sous son nom. Les fonctions appartiennent donc à `azimut_job_dispatch`,
-- rôle sans connexion, auquel seules s'adressent les deux politiques de
-- prise, et qui n'a sur `job` que la lecture et la modification.
--
-- Ce qu'aucune autre identité ne peut faire : `authenticated` n'exécute
-- aucune de ces fonctions, et `azimut_compiler` ne lit aucune table.
--
-- Additive : aucune colonne, aucune ligne existante n'est touchée (A2.2,
-- point 7). La temporisation de D9.2 n'ajoute pas de colonne : un travail
-- remis en file garde l'heure de fin de sa tentative échouée, et la prise
-- compare cette heure à la temporisation, que le service passe en paramètre
-- depuis sa seule définition (`RETRY_BACKOFF_SECONDS`).
--
-- Les rôles sont de grappe, partagés par toutes les bases du serveur. Ils
-- sont créés ici s'ils manquent ; une installation dont le rôle de migration
-- ne peut pas créer de rôle les crée avant, comme `authenticated` (voir
-- ORDRE.md).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_compiler') THEN
    CREATE ROLE azimut_compiler NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_job_dispatch') THEN
    CREATE ROLE azimut_job_dispatch NOLOGIN;
  END IF;
END;
$$;

-- ── Ce que le rôle de prise voit ──────────────────────────────────────────

GRANT USAGE ON SCHEMA azimut TO azimut_job_dispatch;
GRANT SELECT, UPDATE ON azimut.job TO azimut_job_dispatch;

CREATE POLICY job_dispatch_select ON azimut.job
  FOR SELECT TO azimut_job_dispatch USING (true);
CREATE POLICY job_dispatch_update ON azimut.job
  FOR UPDATE TO azimut_job_dispatch USING (true) WITH CHECK (true);

-- ── Prendre le travail suivant ────────────────────────────────────────────
--
-- Le plus ancien travail en file dont la temporisation est écoulée passe en
-- cours, tentative comptée. `SKIP LOCKED` : deux services ne prennent jamais
-- le même travail. L'ordre est total (création, puis identifiant).
CREATE FUNCTION azimut.job_claim(p_now timestamptz, p_backoff_seconds integer[])
RETURNS TABLE (id uuid, org_id uuid, kind text, requested_by uuid,
               attempts integer, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  picked uuid;
BEGIN
  IF p_now IS NULL OR coalesce(cardinality(p_backoff_seconds), 0) = 0 THEN
    RAISE EXCEPTION 'job_claim requires a time and a non-empty backoff';
  END IF;

  SELECT j.id INTO picked
  FROM azimut.job j
  WHERE j.state = 'queued'
    AND (j.attempts = 0 OR j.finished_at IS NULL
         OR j.finished_at + make_interval(secs => p_backoff_seconds[
              least(j.attempts, cardinality(p_backoff_seconds))]) <= p_now)
  ORDER BY j.created_at, j.id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF picked IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE azimut.job j
  SET state = 'running', attempts = j.attempts + 1,
      started_at = p_now, finished_at = NULL
  WHERE j.id = picked
  RETURNING j.id, j.org_id, j.kind, j.requested_by, j.attempts, j.created_at;
END;
$$;

-- ── Les travaux sans progression ──────────────────────────────────────────
--
-- D9.2 : un travail en cours depuis plus que le délai est considéré échoué.
-- La fonction ne fait que les désigner ; le service les remet en file ou les
-- clôt sous l'identité de leur demandeur.
CREATE FUNCTION azimut.job_stalled(p_now timestamptz, p_timeout_seconds double precision)
RETURNS TABLE (id uuid, requested_by uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT j.id, j.requested_by
  FROM azimut.job j
  WHERE j.state = 'running'
    AND j.started_at <= p_now - make_interval(secs => p_timeout_seconds)
  ORDER BY j.started_at, j.id;
$$;

-- ── Abandonner un travail que nul ne peut plus porter ─────────────────────
--
-- Un travail sans demandeur (antérieur à 0070), ou dont le demandeur a quitté
-- l'organisation, ne peut être ni lu ni clos sous son identité. Il serait
-- repris sans fin. Le service le clôt ici, en échec, avec la raison : un
-- nouvel essai ne changerait rien. Seul un travail en cours est concerné.
CREATE FUNCTION azimut.job_abandon(p_job_id uuid, p_now timestamptz, p_error text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE azimut.job
  SET state = 'failed', finished_at = p_now, error = p_error
  WHERE id = p_job_id AND state = 'running';
  RETURN FOUND;
END;
$$;

-- ── Propriété et droits d'exécution ───────────────────────────────────────
--
-- Le changement de propriétaire exige que le nouveau propriétaire puisse
-- créer dans le schéma. Ce droit ne lui sert qu'à cet instant et lui est
-- retiré aussitôt.
GRANT CREATE ON SCHEMA azimut TO azimut_job_dispatch;
ALTER FUNCTION azimut.job_claim(timestamptz, integer[]) OWNER TO azimut_job_dispatch;
ALTER FUNCTION azimut.job_stalled(timestamptz, double precision) OWNER TO azimut_job_dispatch;
ALTER FUNCTION azimut.job_abandon(uuid, timestamptz, text) OWNER TO azimut_job_dispatch;
REVOKE CREATE ON SCHEMA azimut FROM azimut_job_dispatch;

REVOKE ALL ON FUNCTION azimut.job_claim(timestamptz, integer[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.job_stalled(timestamptz, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.job_abandon(uuid, timestamptz, text) FROM PUBLIC;

GRANT USAGE ON SCHEMA azimut TO azimut_compiler;
GRANT EXECUTE ON FUNCTION azimut.job_claim(timestamptz, integer[]) TO azimut_compiler;
GRANT EXECUTE ON FUNCTION azimut.job_stalled(timestamptz, double precision) TO azimut_compiler;
GRANT EXECUTE ON FUNCTION azimut.job_abandon(uuid, timestamptz, text) TO azimut_compiler;
