-- A5.6 : colonnes de forme des faces et blocs d'instance, en additif.
-- support_face reçoit face_index/template_key/langs ; support_content_block
-- reçoit block_index/binding/free_text. Les colonnes préexistantes
-- (support_face.side, support_content_block.ordinal/config) sont laissées en
-- place ; aucune donnée n'est transformée.

ALTER TABLE azimut.support_face
  ADD COLUMN face_index integer,
  ADD COLUMN template_key text,
  ADD COLUMN langs jsonb;

ALTER TABLE azimut.support_content_block
  ADD COLUMN block_index integer,
  ADD COLUMN binding jsonb,
  ADD COLUMN free_text jsonb;
