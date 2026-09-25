-- Retour aux cinq natures de la migration 0006.
--
-- Le retour rétrécit la contrainte : il refuse de s'appliquer si des lignes
-- portent l'une des deux natures qu'il retire, plutôt que d'échouer à
-- mi-course sur une contrainte non satisfaite. C'est le même garde qu'ailleurs
-- — la migration s'arrête et la question se pose à celui qui l'applique.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM azimut.charter_rule
    WHERE kind IN ('forbidden_character', 'max_sentence_words')
  ) THEN
    RAISE EXCEPTION
      'azimut.charter_rule porte des règles de rédaction : le retour de la migration 0045 les rendrait invalides. Les traiter, puis réappliquer.';
  END IF;
END;
$$;

ALTER TABLE azimut.charter_rule DROP CONSTRAINT charter_rule_kind_check;

ALTER TABLE azimut.charter_rule
  ADD CONSTRAINT charter_rule_kind_check CHECK (kind IN (
    'adjacency_forbidden','min_logo_width','background_allowed',
    'proportion','signature_usage'
  ));
