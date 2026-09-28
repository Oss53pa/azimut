DO $$
BEGIN
  IF to_regclass('azimut._migrations') IS NOT NULL
     AND to_regclass('public._migrations') IS NULL THEN
    ALTER TABLE azimut._migrations SET SCHEMA public;
  END IF;
END $$;
