-- Retour de 0059 : la nature du contenu d'une source de plan disparaît avec sa
-- colonne. C'est une perte d'information pour les sources enregistrées depuis :
-- leur contenu devra être relu pour la retrouver.
ALTER TABLE azimut.plan_source DROP CONSTRAINT IF EXISTS plan_source_content_kind_check;
ALTER TABLE azimut.plan_source DROP COLUMN IF EXISTS content_kind;
