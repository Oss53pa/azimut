-- Retour de 0048 : le coût repasse en `numeric` d'unité majeure, restitué
-- exactement depuis l'unité mineure et l'exposant ISO 4217 de la devise. Le
-- retour refuse une devise dont il ne connaît pas l'exposant. FORCE ROW LEVEL
-- SECURITY est levé le temps de la recopie, comme à la montée.

CREATE TEMPORARY TABLE currency_exponent (code char(3) PRIMARY KEY, exponent integer NOT NULL) ON COMMIT DROP;
INSERT INTO currency_exponent (code, exponent) VALUES
  ('EUR', 2), ('USD', 2), ('GBP', 2), ('CHF', 2), ('CAD', 2),
  ('XOF', 0), ('XAF', 0), ('JPY', 0);

ALTER TABLE azimut.work_order NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  unknown text;
BEGIN
  SELECT string_agg(DISTINCT w.currency, ', ') INTO unknown
  FROM azimut.work_order w
  LEFT JOIN currency_exponent e ON e.code = w.currency
  WHERE w.estimated_cost_minor IS NOT NULL AND e.code IS NULL;
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'work_order: no ISO 4217 exponent known here for %; restoration refused', unknown;
  END IF;
END $$;

ALTER TABLE azimut.work_order ADD COLUMN estimated_cost numeric;

UPDATE azimut.work_order w
  SET estimated_cost = w.estimated_cost_minor::numeric / (10::numeric ^ e.exponent)
  FROM currency_exponent e
  WHERE e.code = w.currency AND w.estimated_cost_minor IS NOT NULL;

ALTER TABLE azimut.work_order FORCE ROW LEVEL SECURITY;

ALTER TABLE azimut.work_order DROP COLUMN estimated_cost_minor;
