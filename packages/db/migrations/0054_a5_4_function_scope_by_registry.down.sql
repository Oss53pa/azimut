-- Retour à l'état de 0053 : un seul index, par organisation et registre, et
-- plus de colonne `rules_pack_id`.
--
-- **Le retour peut être refusé, et c'est voulu.** Deux pictogrammes de sécurité
-- de même fonction portés par deux paquets d'une même organisation sont
-- légitimes après 0054 et interdits avant : l'index de 0053 échouera à se
-- reposer sur une base qui en contient. Et une colonne `rules_pack_id`
-- renseignée porterait une donnée que le retour détruirait : A2.2, point 7,
-- l'arrêt se produit avant toute modification.

DO $$
DECLARE
  lignes bigint;
BEGIN
  SELECT count(*) INTO lignes FROM azimut.pictogram WHERE rules_pack_id IS NOT NULL;
  IF lignes > 0 THEN
    RAISE EXCEPTION
      'azimut.pictogram porte % ligne(s) rattachée(s) à un paquet de règles : le retour avant 0054 les perdrait (A2.2, point 7).',
      lignes;
  END IF;
END;
$$;

DROP INDEX IF EXISTS azimut.uq_pictogram_function_safety;
DROP INDEX IF EXISTS azimut.uq_pictogram_function_wayfinding;

CREATE UNIQUE INDEX uq_pictogram_function
  ON azimut.pictogram(org_id, registry, function_key)
  WHERE function_key IS NOT NULL;

ALTER TABLE azimut.pictogram
  DROP COLUMN IF EXISTS rules_pack_id;
