-- H8 — le coût estimé d'un ordre de travaux passe en unité mineure entière
-- (proposition de schéma, 3.4).
--
-- A5.7 déclare `estimated_cost numeric`, H8 impose l'entier d'unité mineure
-- avec sa devise : les deux passages se contredisent. Décision de
-- l'utilisateur du 26/09/2026 : H8 fait foi.
--
-- Transformation de données existantes (A2.2 nº 7), décidée. Chaque montant
-- est multiplié par 10 puissance l'exposant ISO 4217 de sa devise — pas par
-- cent partout : le franc CFA n'a pas de sous-unité. La migration refuse
-- plutôt que d'approcher :
--   - une devise absente de la table ci-dessous (exposant inconnu ici) ;
--   - un montant qui tomberait entre deux unités mineures.
-- La descente restitue l'unité majeure exactement.
--
-- Exposants : ISO 4217, liste close des devises que la migration sait
-- convertir. Une autre devise demande de compléter cette liste, pas de
-- supposer deux décimales.
--
-- Cloisonnement : `work_order` est en FORCE ROW LEVEL SECURITY (0025) ;
-- exécutée par son propriétaire sans identité, la recopie ne verrait aucune
-- ligne. FORCE est levé le temps de la recopie et rétabli avant la fin, dans
-- la transaction du lanceur.

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
  WHERE w.estimated_cost IS NOT NULL AND e.code IS NULL;
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'work_order: no ISO 4217 exponent known here for %; conversion refused', unknown;
  END IF;

  IF EXISTS (
    SELECT 1 FROM azimut.work_order w JOIN currency_exponent e ON e.code = w.currency
    WHERE w.estimated_cost IS NOT NULL
      AND w.estimated_cost * 10::numeric ^ e.exponent <> trunc(w.estimated_cost * 10::numeric ^ e.exponent)
  ) THEN
    RAISE EXCEPTION 'work_order: an estimated_cost falls between two minor units; conversion refused';
  END IF;
END $$;

ALTER TABLE azimut.work_order
  ADD COLUMN estimated_cost_minor bigint CHECK (estimated_cost_minor >= 0);

UPDATE azimut.work_order w
  SET estimated_cost_minor = (w.estimated_cost * 10::numeric ^ e.exponent)::bigint
  FROM currency_exponent e
  WHERE e.code = w.currency AND w.estimated_cost IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.work_order WHERE estimated_cost IS NOT NULL AND estimated_cost_minor IS NULL) THEN
    RAISE EXCEPTION 'work_order: conversion incomplete';
  END IF;
END $$;

ALTER TABLE azimut.work_order FORCE ROW LEVEL SECURITY;

ALTER TABLE azimut.work_order DROP COLUMN estimated_cost;
