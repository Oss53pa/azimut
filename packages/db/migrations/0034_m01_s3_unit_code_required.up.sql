-- M01.S3 — une empreinte de nature « cell » porte obligatoirement un code.
--
-- La migration 0018 a posé la colonne nullable et l'unicité par niveau ; le
-- caractère requis restait tenu par le seul moteur, `DATA.UNIT_CODE_REQUIRED`.
-- A5.2 le porte au schéma — « unit_code : requis si kind = 'cell', unique par
-- niveau » — et la contrainte le rend vrai en base, pas seulement dans le
-- contrôle.
--
-- Un code fait d'espaces ne vaut pas un code : la contrainte le refuse comme
-- l'index unique de 0018 l'ignore déjà, sans quoi une empreinte pourrait
-- satisfaire l'une et échapper à l'autre.
--
-- `footprint` ne porte aucune ligne. Sur une base qui en porterait, une
-- cellule sans code ferait échouer la pose, et c'est le comportement voulu :
-- lui attribuer un code d'office relèverait de A2.2 nº 7.

ALTER TABLE azimut.footprint
  ADD CONSTRAINT footprint_unit_code_required_for_cell
  CHECK (kind <> 'cell' OR btrim(coalesce(unit_code, '')) <> '');
