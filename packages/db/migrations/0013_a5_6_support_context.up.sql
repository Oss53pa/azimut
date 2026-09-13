-- A5.6 / D3.5 : contexte de lecture du support (interieur/exterieur).
-- Scope la règle de lisibilité (les seuils intérieurs diffèrent des extérieurs).
-- Fait de relevé, non dérivé de la géométrie. Additif, nullable : aucune
-- donnée existante n'est transformée.

ALTER TABLE azimut.support
  ADD COLUMN context text CHECK (context IN ('interior','exterior'));
