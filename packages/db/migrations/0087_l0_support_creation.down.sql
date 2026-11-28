-- Rétablit NOT NULL sur `support.kind`. Échoue si un support a été créé sans
-- nature depuis 0087 : c'est voulu, la base ne doit rien inventer pour lui.
ALTER TABLE azimut.support ALTER COLUMN kind SET NOT NULL;
