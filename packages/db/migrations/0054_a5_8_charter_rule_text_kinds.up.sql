-- A5.8 — les sept natures de `charter_rule`, et non cinq.
--
-- « charter_rule (id, org_id, charter_id, kind, params jsonb) — kind in
-- ('adjacency_forbidden','min_logo_width','background_allowed','proportion',
-- 'signature_usage','forbidden_character','max_sentence_words') ».
--
-- La contrainte vient de la migration 0006, écrite avant qu'A5.8 range les
-- deux règles de rédaction parmi les règles de charte. Elle en admet cinq, et
-- les deux que le dépôt sait opposer n'en font pas partie : `charter_rule` ne
-- peut donc pas porter la liste de caractères interdits ni la limite de
-- phrase, alors que les contrôles les y cherchent depuis la version 14. Le
-- chemin existait sans que rien puisse l'emprunter.
--
-- Additif : la contrainte s'élargit, aucune ligne existante ne cesse d'être
-- valide, et aucune donnée n'est transformée. A2.2, point 7, n'est pas en
-- cause.

ALTER TABLE azimut.charter_rule DROP CONSTRAINT charter_rule_kind_check;

ALTER TABLE azimut.charter_rule
  ADD CONSTRAINT charter_rule_kind_check CHECK (kind IN (
    'adjacency_forbidden','min_logo_width','background_allowed',
    'proportion','signature_usage','forbidden_character',
    'max_sentence_words'
  ));
