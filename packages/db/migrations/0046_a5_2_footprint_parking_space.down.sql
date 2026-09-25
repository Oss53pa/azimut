-- Retour aux cinq natures d'empreinte d'avant la version 16 du consolidé.
--
-- Ce sens-là resserre la contrainte, et une contrainte qui se resserre peut
-- rejeter des lignes existantes. Redescendre sur une base portant des places de
-- stationnement ferait échouer l'ajout de la contrainte au milieu de la
-- migration, avec le message de Postgres pour seule explication. L'arrêt est
-- donc explicite et se produit avant toute modification : A2.2, point 7.
--
-- Ce qu'il faut faire alors ne se devine pas en migration. Une place n'a pas
-- d'équivalent parmi les cinq natures restantes : la ranger en `outdoor`
-- inventerait une nature qu'elle n'a pas, la supprimer détruirait du relevé.
-- C'est une décision métier, elle se prend avant la descente.

DO $$
DECLARE
  restantes bigint;
BEGIN
  SELECT count(*) INTO restantes
  FROM azimut.footprint
  WHERE kind = 'parking_space';

  IF restantes > 0 THEN
    RAISE EXCEPTION
      'azimut.footprint porte % empreinte(s) de nature parking_space. Cette migration inverse les rejetterait. Trancher leur sort avant de redescendre (A2.2, point 7).',
      restantes;
  END IF;
END;
$$;

ALTER TABLE azimut.footprint
  DROP CONSTRAINT IF EXISTS footprint_kind_check;

ALTER TABLE azimut.footprint
  ADD CONSTRAINT footprint_kind_check
  CHECK (kind IN ('cell', 'circulation', 'technical', 'vertical_core', 'outdoor'));
