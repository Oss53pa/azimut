-- A5.4 : désignation de fonction d'un pictogramme.
--
-- « function_key : à quoi sert ce pictogramme, et non d'où il vient. C'est par
-- elle qu'un moteur demande le pictogramme d'accessibilité sans connaître son
-- code. Vocabulaire à espace de noms, enrichi dans le même commit que son
-- premier usage. Pour le registre de sécurité, la désignation vient du paquet
-- de règles et n'est jamais saisie ; pour le registre d'orientation, elle est
-- libre. Une fonction est désignée au plus une fois par registre et par site. »
--
-- Colonne facultative : un pictogramme peut ne servir aucune fonction nommée.
-- Ce qu'INV-5 rendait impossible devient possible — un moteur nomme la fonction,
-- la donnée nomme le pictogramme, et aucune valeur d'origine normative n'entre
-- dans le code.
--
-- **Migration additive.** Une colonne nullable et un index. Aucune ligne n'est
-- lue, transformée ni supprimée, et l'état antérieur se retrouve en retirant
-- les deux.

ALTER TABLE azimut.pictogram
  ADD COLUMN function_key text;

-- La forme d'A5.4 : un espace de noms, un point, un nom. Ni l'un ni l'autre
-- vide, aucun des deux ne contient de point, sans quoi la coupure serait
-- ambiguë. Même convention que les clés de fait d'A5.11, et pour le même motif.
ALTER TABLE azimut.pictogram
  ADD CONSTRAINT pictogram_function_key_shape
  CHECK (function_key IS NULL OR function_key ~ '^[^.[:space:]]+\.[^.[:space:]]+$');

-- « Une fonction est désignée au plus une fois par registre et par site. »
--
-- La table est portée par l'organisation et non par le site : un site voit
-- exactement les pictogrammes de son organisation, tous et rien d'autre. Sur ce
-- modèle, « au plus une fois par site » et « au plus une fois par
-- organisation » désignent le même ensemble de cas, et c'est le second qui
-- s'écrit ici — le premier n'a pas de colonne où s'accrocher.
--
-- Index partiel : une fonction non désignée ne se compare à rien.
CREATE UNIQUE INDEX uq_pictogram_function
  ON azimut.pictogram(org_id, registry, function_key)
  WHERE function_key IS NOT NULL;
