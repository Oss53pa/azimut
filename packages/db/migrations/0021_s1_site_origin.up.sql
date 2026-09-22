-- M01.S1 / D1.1 / N1.2 — origine du repère site.
--
-- Les deux nombres sont ceux du premier calage du site, recopiés sur la ligne
-- `site`, en mètres du repère site. Ils n'y sont plus jamais modifiés : les
-- modifier déplacerait le repère sous toute la géométrie déjà saisie, qui
-- garderait ses coordonnées en désignant un autre endroit. Aucune migration ne
-- rattraperait cela, puisque rien n'enregistre de quel repère chaque valeur
-- provenait. Le refus vit dans `guardSiteOrigin` (CALIB.ORIGIN_LOCKED) ; la
-- base garde ici ce qu'une contrainte peut garder.
--
-- Nullables et sans valeur par défaut : tant qu'aucun calage n'a eu lieu, le
-- repère n'est pas posé. Ce n'est pas l'origine (0, 0), qui se lirait comme un
-- repère déjà fixé. Aucune ligne existante n'est lue ni modifiée.

ALTER TABLE azimut.site
  ADD COLUMN origin_x numeric,
  ADD COLUMN origin_y numeric;

-- Les deux ensemble, ou aucune des deux. Une origine à moitié saisie n'est pas
-- une origine, et laisserait croire qu'une coordonnée vaut zéro.
ALTER TABLE azimut.site
  ADD CONSTRAINT site_origin_pair_check CHECK (
    (origin_x IS NULL) = (origin_y IS NULL)
  );
