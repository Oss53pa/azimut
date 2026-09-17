-- N1.2 / N1.4 — code d'unité locative d'une empreinte.
--
-- Requis quand la nature est « cell », unique par niveau (règle S3). La
-- colonne est nullable : une empreinte relevée avant que son code soit connu
-- doit pouvoir être enregistrée, et c'est le contrôle qui la signale. Une
-- contrainte NOT NULL rendrait le relevé impossible et pousserait à inventer
-- un code, ce qui est précisément ce que la règle veut éviter.
--
-- Additive : aucune donnée existante n'est transformée ni supprimée.

ALTER TABLE azimut.footprint
  ADD COLUMN unit_code text;

-- L'unicité est portée par la base et non par la seule application : deux
-- cellules de même code sur un niveau ne doivent pas pouvoir coexister, quel
-- que soit le chemin d'écriture.
--
-- Index partiel : il ne contraint que les cellules effectivement codées. La
-- comparaison est insensible à la casse et aux espaces de bord, comme celle
-- des noms d'orientation — un lecteur de panneau ne distingue pas « C-104 »
-- de « c-104 ».
CREATE UNIQUE INDEX uq_footprint_unit_code_per_level
  ON azimut.footprint (level_id, lower(btrim(unit_code)))
  WHERE kind = 'cell' AND btrim(coalesce(unit_code, '')) <> '';
