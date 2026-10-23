-- Retour de 0082 : les contraintes, les déclencheurs, les fonctions, puis les seuils.

ALTER TABLE azimut.orientation_zone DROP CONSTRAINT orientation_zone_code_input;
ALTER TABLE azimut.footprint DROP CONSTRAINT footprint_unit_code_input;
ALTER TABLE azimut.building DROP CONSTRAINT building_name_input;
ALTER TABLE azimut.site DROP CONSTRAINT site_name_input;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_trigger g
    JOIN pg_class c ON c.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND g.tgname = 'guard_input'
  LOOP
    EXECUTE format('DROP TRIGGER guard_input ON azimut.%I', t);
  END LOOP;
END $$;

DROP FUNCTION azimut.guard_input();
DROP FUNCTION azimut.text_fault(text);
DROP FUNCTION azimut.input_limit(text);

DELETE FROM azimut.org_security_setting
WHERE key IN ('input.text.max_chars', 'input.json.max_bytes', 'import.csv.max_rows', 'import.csv.max_bytes');
DELETE FROM azimut.security_setting
WHERE key IN ('input.text.max_chars', 'input.json.max_bytes', 'import.csv.max_rows', 'import.csv.max_bytes');
