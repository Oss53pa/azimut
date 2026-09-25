-- A5.4 : portée d'unicité d'une fonction de pictogramme, selon le registre.
--
-- « Portée d'unicité d'une fonction : le paquet de règles pour le registre de
-- sécurité, l'organisation pour le registre d'orientation. Une organisation
-- qui exploite deux sites rattachés à deux paquets différents porte
-- légitimement deux pictogrammes de même fonction, un par paquet : l'unicité
-- par organisation les déclarerait ambigus à tort. »
--
-- L'index de 0053 tenait une seule portée, l'organisation, pour les deux
-- registres. Il refusait donc le cas que la règle nomme comme légitime. Il est
-- remplacé par deux index, un par registre.
--
-- **La colonne `rules_pack_id`.** A5.4 la porte depuis l'origine — « standard_ref
-- et rules_pack_id sont requis si registry = 'safety' » — et la table ne l'avait
-- pas. Sans elle, la portée « paquet de règles » n'a rien où s'accrocher. Elle
-- entre nullable : la rendre requise pour le registre de sécurité est l'autre
-- moitié de la phrase d'A5.4, et ferait refuser toute ligne existante qui ne
-- la porte pas. Ce n'est pas l'objet de cette migration.
--
-- **Migration additive.** Une colonne nullable, un index retiré, deux posés.
-- Aucune ligne n'est lue, transformée ni supprimée.

ALTER TABLE azimut.pictogram
  ADD COLUMN rules_pack_id uuid REFERENCES azimut.rules_pack(id);

DROP INDEX azimut.uq_pictogram_function;

-- Registre d'orientation : une fonction au plus une fois par organisation.
CREATE UNIQUE INDEX uq_pictogram_function_wayfinding
  ON azimut.pictogram(org_id, function_key)
  WHERE registry = 'wayfinding' AND function_key IS NOT NULL;

-- Registre de sécurité : une fonction au plus une fois par paquet de règles.
--
-- `org_id` reste dans la clé, pour deux raisons qui n'en font qu'une. Les
-- pictogrammes d'un paquet sont portés par chaque organisation qui l'emploie :
-- deux organisations sur le même paquet ont chacune leur ligne, et une clé
-- sans `org_id` refuserait la seconde. Et un index qui franchirait la frontière
-- d'organisation laisserait l'organisation A apprendre, par le seul message de
-- conflit, qu'une ligne existe chez B — ce qu'A6.1 interdit, « y compris par
-- message d'erreur ».
--
-- `NULLS NOT DISTINCT` : deux pictogrammes de sécurité sans paquet et de même
-- fonction se contredisent autant que deux du même paquet. Sans cette clause,
-- le paquet absent serait la voie de contournement de l'unicité.
CREATE UNIQUE INDEX uq_pictogram_function_safety
  ON azimut.pictogram(org_id, rules_pack_id, function_key) NULLS NOT DISTINCT
  WHERE registry = 'safety' AND function_key IS NOT NULL;
