-- Retrait de la liste d'empreintes des zones, d'avant la version 17.
--
-- Ce sens-là détruit : une zone qui déclare ses empreintes perd cette
-- déclaration, et rien ne permet de la reconstruire — c'est précisément parce
-- que l'appartenance est déclarée et non calculée qu'elle ne se retrouve pas.
-- A2.2, point 7, et l'arrêt se produit avant toute modification.

DO $$
DECLARE
  declarantes bigint;
BEGIN
  SELECT count(*) INTO declarantes
  FROM azimut.zone
  WHERE footprint_ids <> '[]'::jsonb;

  IF declarantes > 0 THEN
    RAISE EXCEPTION
      'azimut.zone porte % zone(s) déclarant leurs empreintes. Cette migration inverse perdrait ces déclarations, qui ne se recalculent pas (A2.2, point 7).',
      declarantes;
  END IF;
END;
$$;

ALTER TABLE azimut.zone DROP CONSTRAINT zone_footprint_ids_is_array;
ALTER TABLE azimut.zone DROP COLUMN footprint_ids;
