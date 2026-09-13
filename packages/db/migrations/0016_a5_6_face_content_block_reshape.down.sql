ALTER TABLE azimut.support_content_block
  DROP COLUMN IF EXISTS free_text,
  DROP COLUMN IF EXISTS binding,
  DROP COLUMN IF EXISTS block_index;

ALTER TABLE azimut.support_face
  DROP COLUMN IF EXISTS langs,
  DROP COLUMN IF EXISTS template_key,
  DROP COLUMN IF EXISTS face_index;
