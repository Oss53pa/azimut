-- Lot 8 de l'audit : la limitation de débit et les quotas de la file (D-5).
--
-- 1. `rate_counter` : les compteurs par fenêtre, par utilisateur ou par
--    organisation, et par action. Personne ne les lit ni ne les écrit, hors
--    le rôle sans connexion `azimut_rate`.
-- 2. Les seuils sont des données (`security_setting`), resserrables par
--    organisation : `rate.<action>.per_user`, `rate.<action>.per_org`,
--    `rate.<action>.window_seconds`, `job.max_running_per_org`,
--    `job.payload.max_bytes`.
-- 3. Ce qui est compté, par des déclencheurs :
--     - `write` : chaque instruction d'écriture sur une table du schéma, par
--       utilisateur ; l'organisation n'entre pas en compte, pour qu'un membre
--       n'épuise pas le quota de ses collègues ;
--     - `membership` : chaque changement de membre ou de fabricant, par
--       utilisateur et par organisation ;
--     - `org_create` : chaque création d'organisation, par utilisateur ;
--     - `job_enqueue` : chaque dépôt de travail, par utilisateur et par
--       organisation, avec la taille du `payload` bornée.
-- 4. `job_claim` ne prend pas le travail d'une organisation qui a déjà son
--    nombre maximal de travaux en cours.
-- 5. Un dépassement lève `rate_limited`, que PostgREST rend en 429 avec
--    `Retry-After` (SQLSTATE `PGRST`). Le message ne nomme ni l'organisation
--    ni le compteur. Le dépassement est consigné au journal technique de la
--    base (`RAISE LOG`), qui survit à l'annulation de la transaction, ce que
--    `audit_log` ne pourrait pas.
--
-- Additive : un rôle, une table, des fonctions et des déclencheurs neufs ;
-- `job_claim` gagne une condition.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_rate') THEN
    CREATE ROLE azimut_rate NOLOGIN;
  END IF;
END;
$$;

INSERT INTO azimut.security_setting (key, value, unit, org_overridable, source_ref, description) VALUES
  ('rate.write.window_seconds', 60, 'seconds', false, 'Valeur initiale du lot 8', 'Fenêtre du débit d''écriture'),
  ('rate.write.per_user', 3000, 'count', true, 'Valeur initiale du lot 8',
   'Instructions d''écriture par utilisateur et par fenêtre'),
  ('rate.membership.window_seconds', 60, 'seconds', false, 'Valeur initiale du lot 8',
   'Fenêtre du débit des changements de membres'),
  ('rate.membership.per_user', 30, 'count', true, 'Valeur initiale du lot 8',
   'Changements de membres par utilisateur et par fenêtre'),
  ('rate.membership.per_org', 60, 'count', true, 'Valeur initiale du lot 8',
   'Changements de membres par organisation et par fenêtre'),
  ('rate.org_create.window_seconds', 3600, 'seconds', false, 'Valeur initiale du lot 8',
   'Fenêtre du débit des créations d''organisation'),
  ('rate.org_create.per_user', 5, 'count', false, 'Valeur initiale du lot 8',
   'Créations d''organisation par utilisateur et par fenêtre'),
  ('rate.job_enqueue.window_seconds', 60, 'seconds', false, 'Valeur initiale du lot 8',
   'Fenêtre du débit des dépôts de travaux'),
  ('rate.job_enqueue.per_user', 60, 'count', true, 'Valeur initiale du lot 8',
   'Dépôts de travaux par utilisateur et par fenêtre'),
  ('rate.job_enqueue.per_org', 200, 'count', true, 'Valeur initiale du lot 8',
   'Dépôts de travaux par organisation et par fenêtre'),
  ('job.max_running_per_org', 2, 'count', true, 'Valeur initiale du lot 8',
   'Travaux en cours simultanés par organisation'),
  ('job.payload.max_bytes', 65536, 'bytes', true, 'Valeur initiale du lot 8',
   'Taille maximale du paramètre d''un travail');

CREATE TABLE azimut.rate_counter (
  scope text NOT NULL CHECK (scope IN ('user', 'org')),
  subject uuid NOT NULL,
  action text NOT NULL CHECK (action ~ '^[a-z_]+$'),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits >= 0),
  PRIMARY KEY (scope, subject, action, window_start)
);
ALTER TABLE azimut.rate_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.rate_counter FORCE ROW LEVEL SECURITY;
REVOKE ALL ON azimut.rate_counter FROM PUBLIC, authenticated;
CREATE TRIGGER guard_input BEFORE INSERT OR UPDATE ON azimut.rate_counter
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_input();

GRANT USAGE ON SCHEMA azimut TO azimut_rate;
GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.rate_counter TO azimut_rate;
CREATE POLICY rate_counter_owner ON azimut.rate_counter FOR ALL TO azimut_rate USING (true) WITH CHECK (true);
GRANT SELECT ON azimut.security_setting, azimut.org_security_setting TO azimut_rate, azimut_job_dispatch;
CREATE POLICY org_security_setting_rate ON azimut.org_security_setting
  FOR SELECT TO azimut_rate, azimut_job_dispatch USING (true);

-- Compte un passage et refuse au-delà du seuil. L'organisation n'est comptée
-- que pour un membre de cette organisation : nul ne consomme le quota d'une
-- organisation dont il n'est pas membre.
CREATE FUNCTION azimut.rate_check(p_action text, p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_who uuid := azimut.current_user_id();
  v_window numeric := azimut.security_setting_value(p_org, 'rate.' || p_action || '.window_seconds');
  v_per_user numeric := azimut.security_setting_value(p_org, 'rate.' || p_action || '.per_user');
  v_per_org numeric := azimut.security_setting_value(p_org, 'rate.' || p_action || '.per_org');
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_retry integer;
  v_scope text;
  v_subject uuid;
  v_hits integer;
  v_limit numeric;
BEGIN
  -- Seule une requête identifiée est comptée : une écriture sans identité est
  -- celle de la plateforme (provisionnement, migration), et la file des
  -- travaux a ses propres quotas.
  IF v_who IS NULL THEN
    RETURN;
  END IF;
  IF v_window IS NULL OR v_window <= 0 THEN
    RAISE EXCEPTION 'rate_check : action sans fenêtre (%)', p_action;
  END IF;
  v_start := to_timestamp(floor(extract(epoch FROM v_now) / v_window) * v_window);
  v_retry := greatest(1, ceil(extract(epoch FROM (v_start + make_interval(secs => v_window) - v_now)))::integer);

  FOREACH v_scope IN ARRAY ARRAY['user', 'org'] LOOP
    v_subject := CASE v_scope WHEN 'user' THEN v_who ELSE p_org END;
    v_limit := CASE v_scope WHEN 'user' THEN v_per_user ELSE v_per_org END;
    CONTINUE WHEN v_subject IS NULL OR v_limit IS NULL;
    CONTINUE WHEN v_scope = 'org'
      AND NOT EXISTS (SELECT 1 FROM azimut.membership m WHERE m.org_id = p_org AND m.user_id = v_who);

    DELETE FROM azimut.rate_counter c
    WHERE c.scope = v_scope AND c.subject = v_subject AND c.action = p_action AND c.window_start < v_start;
    INSERT INTO azimut.rate_counter AS c (scope, subject, action, window_start, hits)
    VALUES (v_scope, v_subject, p_action, v_start, 1)
    ON CONFLICT (scope, subject, action, window_start) DO UPDATE SET hits = c.hits + 1
    RETURNING c.hits INTO v_hits;

    IF v_hits > v_limit THEN
      RAISE LOG 'rate_limited action=% scope=% subject=% hits=%', p_action, v_scope, v_subject, v_hits;
      RAISE SQLSTATE 'PGRST' USING
        MESSAGE = json_build_object('code', 'rate_limited', 'message', 'rate_limited')::text,
        DETAIL = json_build_object('status', 429,
          'headers', json_build_object('Retry-After', v_retry::text))::text;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION azimut.rate_check(text, uuid) FROM PUBLIC;

-- Les déclencheurs de comptage. Tous appartiennent à `azimut_rate`, et aucun
-- n'est exécutable directement : un déclencheur n'a pas besoin de ce droit.
CREATE FUNCTION azimut.rate_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.rate_check('write', NULL);
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.rate_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.rate_check('membership', CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END);
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.rate_org_create() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM azimut.rate_check('org_create', NULL);
  RETURN NULL;
END;
$$;

CREATE FUNCTION azimut.rate_job_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF octet_length(NEW.payload::text) > azimut.security_setting_value(NEW.org_id, 'job.payload.max_bytes') THEN
    RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023', DETAIL = 'job.payload too_large';
  END IF;
  PERFORM azimut.rate_check('job_enqueue', NEW.org_id);
  RETURN NEW;
END;
$$;

GRANT CREATE ON SCHEMA azimut TO azimut_rate;
ALTER FUNCTION azimut.rate_check(text, uuid) OWNER TO azimut_rate;
ALTER FUNCTION azimut.rate_write() OWNER TO azimut_rate;
ALTER FUNCTION azimut.rate_membership() OWNER TO azimut_rate;
ALTER FUNCTION azimut.rate_org_create() OWNER TO azimut_rate;
ALTER FUNCTION azimut.rate_job_enqueue() OWNER TO azimut_rate;
REVOKE CREATE ON SCHEMA azimut FROM azimut_rate;
GRANT SELECT (org_id, user_id) ON azimut.membership TO azimut_rate;
CREATE POLICY membership_rate_select ON azimut.membership FOR SELECT TO azimut_rate USING (true);
REVOKE ALL ON FUNCTION azimut.rate_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.rate_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.rate_org_create() FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.rate_job_enqueue() FROM PUBLIC;

CREATE TRIGGER rate_membership AFTER INSERT OR UPDATE OR DELETE ON azimut.membership
  FOR EACH ROW EXECUTE FUNCTION azimut.rate_membership();
CREATE TRIGGER rate_membership AFTER INSERT OR UPDATE OR DELETE ON azimut.vendor
  FOR EACH ROW EXECUTE FUNCTION azimut.rate_membership();
CREATE TRIGGER rate_membership AFTER INSERT OR UPDATE OR DELETE ON azimut.vendor_member
  FOR EACH ROW EXECUTE FUNCTION azimut.rate_membership();
CREATE TRIGGER rate_org_create AFTER INSERT ON azimut.organization
  FOR EACH ROW EXECUTE FUNCTION azimut.rate_org_create();
CREATE TRIGGER rate_job_enqueue BEFORE INSERT ON azimut.job
  FOR EACH ROW EXECUTE FUNCTION azimut.rate_job_enqueue();

-- Le débit d'écriture, sur chaque table que la garde des entrées couvre, hors
-- les compteurs eux-mêmes.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_trigger g
    JOIN pg_class c ON c.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND g.tgname = 'guard_input' AND c.relname <> 'rate_counter'
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE TRIGGER rate_write AFTER INSERT OR UPDATE OR DELETE ON azimut.%I '
      'FOR EACH STATEMENT EXECUTE FUNCTION azimut.rate_write()', t);
  END LOOP;
END $$;

-- La prise d'un travail ne dépasse pas le nombre de travaux en cours de son
-- organisation.
CREATE OR REPLACE FUNCTION azimut.job_claim(p_now timestamp with time zone, p_backoff_seconds integer[])
 RETURNS TABLE(id uuid, org_id uuid, kind text, requested_by uuid, attempts integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    AND (SELECT count(*) FROM azimut.job r WHERE r.org_id = j.org_id AND r.state = 'running')
        < azimut.security_setting_value(j.org_id, 'job.max_running_per_org')
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
$function$;
