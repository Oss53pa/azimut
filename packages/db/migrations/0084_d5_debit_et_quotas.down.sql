-- Retour de 0084 : la prise des travaux d'avant, les déclencheurs, les
-- fonctions, les politiques, la table et les seuils.

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

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_trigger g
    JOIN pg_class c ON c.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND g.tgname = 'rate_write'
  LOOP
    EXECUTE format('DROP TRIGGER rate_write ON azimut.%I', t);
  END LOOP;
END $$;

DROP TRIGGER rate_job_enqueue ON azimut.job;
DROP TRIGGER rate_org_create ON azimut.organization;
DROP TRIGGER rate_membership ON azimut.vendor_member;
DROP TRIGGER rate_membership ON azimut.vendor;
DROP TRIGGER rate_membership ON azimut.membership;

DROP FUNCTION azimut.rate_job_enqueue();
DROP FUNCTION azimut.rate_org_create();
DROP FUNCTION azimut.rate_membership();
DROP FUNCTION azimut.rate_write();
DROP FUNCTION azimut.rate_check(text, uuid);

DROP POLICY membership_rate_select ON azimut.membership;
REVOKE ALL ON azimut.membership FROM azimut_rate;
DROP POLICY org_security_setting_rate ON azimut.org_security_setting;
REVOKE SELECT ON azimut.security_setting, azimut.org_security_setting FROM azimut_rate, azimut_job_dispatch;
DROP TABLE azimut.rate_counter;
REVOKE USAGE ON SCHEMA azimut FROM azimut_rate;

DELETE FROM azimut.org_security_setting WHERE key LIKE 'rate.%' OR key IN ('job.max_running_per_org', 'job.payload.max_bytes');
DELETE FROM azimut.security_setting WHERE key LIKE 'rate.%' OR key IN ('job.max_running_per_org', 'job.payload.max_bytes');
