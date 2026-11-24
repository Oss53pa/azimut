-- Retire ce que 0083 a posé. Les verrous sont éphémères : rien ne se perd.

DROP FUNCTION IF EXISTS azimut.live_object_locks(uuid);
DROP FUNCTION IF EXISTS azimut.release_object_lock(text, uuid);
DROP FUNCTION IF EXISTS azimut.acquire_object_lock(text, uuid);

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_trigger tr
    JOIN pg_class c ON c.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND tr.tgname = 'guard_object_lock'
  LOOP
    EXECUTE format('DROP TRIGGER guard_object_lock ON azimut.%I', t);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS azimut.guard_object_lock();
DROP FUNCTION IF EXISTS azimut.locked_by_other(text, uuid);
DROP TABLE IF EXISTS azimut.object_lock;
