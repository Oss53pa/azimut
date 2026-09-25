-- Retour à l'état de 0056 : la colonne revient, remplie depuis le socle.
--
-- La colonne revient telle que 0003 l'a posée, nullable, avec la clé
-- étrangère que 0006 lui a ajoutée. Le socle de chaque site y est recopié, et
-- la table garde ses lignes : avant 0057 elle faisait déjà foi, la colonne
-- n'en était que le reflet.

ALTER TABLE azimut.site
  ADD COLUMN rules_pack_id uuid;

ALTER TABLE azimut.site
  ADD CONSTRAINT fk_site_rules_pack
  FOREIGN KEY (rules_pack_id) REFERENCES azimut.rules_pack(id);

UPDATE azimut.site s
   SET rules_pack_id = b.rules_pack_id
  FROM azimut.site_rules_binding b
 WHERE b.site_id = s.id
   AND b.role = 'base';
