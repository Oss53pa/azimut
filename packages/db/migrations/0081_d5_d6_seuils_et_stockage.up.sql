-- Lots 5 et 8 de l'audit : les seuils en configuration (D-5) et les espaces
-- de stockage privés (D-6).
--
-- 1. `security_setting` : les seuils communs, une ligne par clé, avec unité et
--    source. Écrits par les seules migrations. « Les seuils (débit, tailles,
--    durées) sont des données de configuration, jamais des constantes dans le
--    code. »
-- 2. `org_security_setting` : la surcharge d'une organisation, pour les clés
--    qui l'admettent, et seulement pour **resserrer** : une organisation ne
--    relâche jamais une borne commune. Écrite par l'`admin`.
-- 3. `security_setting_value(org, clé)` et `security_settings(org)` : la valeur
--    en vigueur. Une clé inconnue rend `NULL`, que l'appelant traite comme un
--    refus.
-- 4. `install_storage()` : quatre espaces privés et leurs politiques, si la
--    plateforme fournit le stockage (schéma `storage`). Chemin
--    `{org_id}/{site_id}/{id}/{nom}` ; le premier segment décide de
--    l'organisation, le rôle de ce qu'on y lit et écrit. Les noms portent le
--    préfixe `azimut-` : le projet hébergé est partagé entre plusieurs
--    applications.
--
-- Additive : des tables et des fonctions neuves (A2.2, point 7).

CREATE TABLE azimut.security_setting (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  value numeric NOT NULL CHECK (value >= 0),
  unit text NOT NULL CHECK (unit IN ('bytes', 'count', 'seconds')),
  org_overridable boolean NOT NULL,
  source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
  description text NOT NULL CHECK (btrim(description) <> '')
);
REVOKE ALL ON azimut.security_setting FROM PUBLIC, authenticated;
GRANT SELECT ON azimut.security_setting TO authenticated;

INSERT INTO azimut.security_setting (key, value, unit, org_overridable, source_ref, description) VALUES
  ('asset.svg.max_bytes', 5242880, 'bytes', true,
   'E14.2 ; valeur reprise de l''assainissement existant du studio', 'Taille maximale d''un SVG reçu'),
  ('asset.svg.max_elements', 10000, 'count', true,
   'E14.2 ; valeur reprise de l''assainissement existant du studio', 'Nombre maximal d''éléments d''un SVG reçu'),
  ('asset.svg.max_depth', 64, 'count', true,
   'E14.2 ; valeur initiale du lot 5 (D-7)', 'Profondeur maximale d''imbrication d''un SVG reçu'),
  ('plan.max_bytes', 62914560, 'bytes', false,
   'M2 (partie M) : « 60 Mo maximum »', 'Taille maximale d''un fond de plan'),
  ('pdf.max_inflated_bytes', 268435456, 'bytes', true,
   'Valeur initiale du lot 5 (D-7)', 'Taille maximale d''un flux PDF une fois décompressé'),
  ('pdf.max_pages', 500, 'count', true,
   'Valeur initiale du lot 5 (D-7)', 'Nombre maximal de pages d''un PDF lu'),
  ('storage.signed_url_ttl', 300, 'seconds', true,
   'Valeur initiale du lot 5 (D-6)', 'Durée de validité d''une URL signée'),
  ('storage.plans.max_bytes', 62914560, 'bytes', false,
   'M2 (partie M) : « 60 Mo maximum »', 'Taille maximale d''un objet de l''espace des plans'),
  ('storage.proofs.max_bytes', 104857600, 'bytes', false,
   'Valeur initiale du lot 5 (D-6)', 'Taille maximale d''une épreuve'),
  ('storage.creatives.max_bytes', 52428800, 'bytes', false,
   'Valeur initiale du lot 5 (D-6)', 'Taille maximale d''un visuel d''annonceur'),
  ('storage.deliveries.max_bytes', 524288000, 'bytes', false,
   'Valeur initiale du lot 5 (D-6)', 'Taille maximale d''un livrable ou d''un paquet de borne');

CREATE TABLE azimut.org_security_setting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  key text NOT NULL REFERENCES azimut.security_setting(key) ON DELETE RESTRICT,
  value numeric NOT NULL CHECK (value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_security_setting_unique UNIQUE (org_id, key)
);
CREATE INDEX idx_org_security_setting_org ON azimut.org_security_setting(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.org_security_setting
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- Une surcharge ne vaut que pour une clé qui l'admet, et ne relâche rien.
CREATE FUNCTION azimut.guard_org_security_setting() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  common azimut.security_setting;
BEGIN
  SELECT * INTO common FROM azimut.security_setting s WHERE s.key = NEW.key;
  IF NOT common.org_overridable OR NEW.value > common.value THEN
    RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_org_security_setting BEFORE INSERT OR UPDATE ON azimut.org_security_setting
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_org_security_setting();

ALTER TABLE azimut.org_security_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.org_security_setting FORCE ROW LEVEL SECURITY;
CREATE POLICY org_security_setting_org_policy ON azimut.org_security_setting
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY role_read ON azimut.org_security_setting AS RESTRICTIVE FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin','designer','owner_rep','operator','auditor','vendor','marketing'])));
CREATE POLICY role_insert ON azimut.org_security_setting AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
CREATE POLICY role_update ON azimut.org_security_setting AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));
CREATE POLICY role_delete ON azimut.org_security_setting AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['admin'])));

-- La valeur en vigueur : la surcharge visible de l'organisation, sinon la
-- valeur commune. Sous les politiques de l'appelant : une organisation qu'il
-- ne voit pas n'a pour lui que la valeur commune.
CREATE FUNCTION azimut.security_setting_value(p_org uuid, p_key text)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT o.value FROM azimut.org_security_setting o WHERE o.org_id = p_org AND o.key = p_key),
    (SELECT s.value FROM azimut.security_setting s WHERE s.key = p_key))
$$;

CREATE FUNCTION azimut.security_settings(p_org uuid)
RETURNS TABLE (key text, value numeric, unit text)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT s.key, azimut.security_setting_value(p_org, s.key), s.unit
  FROM azimut.security_setting s
  ORDER BY s.key
$$;
GRANT EXECUTE ON FUNCTION azimut.security_settings(uuid) TO authenticated;

-- ── Les espaces de stockage (D-6) ─────────────────────────────────────────
--
-- Installés par une fonction, pour deux raisons : le schéma `storage` n'existe
-- que sur une plateforme qui fournit le stockage, et une installation qui
-- l'ajoute plus tard doit pouvoir les poser sans rejouer les migrations.
CREATE FUNCTION azimut.install_storage() RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  b record;
  readers text := 'ARRAY[''admin'',''designer'',''owner_rep'',''operator'',''auditor'']';
  writers text := 'ARRAY[''admin'',''designer'',''operator'']';
  org_of text := 'split_part(name, ''/'', 1)';
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN false;
  END IF;
  FOR b IN SELECT * FROM (VALUES
    ('azimut-plans', 'storage.plans.max_bytes', ARRAY['application/pdf','image/png','image/jpeg','image/vnd.dxf']),
    ('azimut-proofs', 'storage.proofs.max_bytes', ARRAY['application/pdf','image/png','image/jpeg']),
    ('azimut-creatives', 'storage.creatives.max_bytes', ARRAY['image/svg+xml','image/png','image/jpeg','application/pdf']),
    ('azimut-deliveries', 'storage.deliveries.max_bytes', ARRAY['application/zip','application/pdf','application/json'])
  ) AS v(id, limit_key, mimes) LOOP
    EXECUTE format(
      'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) '
      'VALUES (%L, %L, false, %s, %L) ON CONFLICT (id) DO UPDATE SET public = false, '
      'file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types',
      b.id, b.id, (SELECT s.value FROM azimut.security_setting s WHERE s.key = b.limit_key), b.mimes);
  END LOOP;

  EXECUTE 'DROP POLICY IF EXISTS azimut_storage_read ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS azimut_storage_insert ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS azimut_storage_delete ON storage.objects';
  -- Lecture : les rôles de lecture de l'organisation du chemin ; une épreuve,
  -- aussi par le `vendor` du lot de sa face (0077), à travers les politiques
  -- de `proof` : le troisième segment est l'identifiant de l'épreuve.
  EXECUTE format(
    'CREATE POLICY azimut_storage_read ON storage.objects FOR SELECT TO authenticated USING ('
    '  bucket_id IN (''azimut-plans'', ''azimut-proofs'', ''azimut-creatives'', ''azimut-deliveries'') AND ('
    '    %1$s IN (SELECT azimut.user_org_ids_with_role(%2$s)::text)'
    '    OR (bucket_id = ''azimut-creatives'' AND %1$s IN (SELECT azimut.user_org_ids_with_role(ARRAY[''marketing''])::text))'
    '    OR (bucket_id = ''azimut-proofs'' AND split_part(name, ''/'', 3) IN (SELECT p.id::text FROM azimut.proof p WHERE p.org_id::text = %1$s))))',
    org_of, readers);
  -- Dépôt : plans et visuels par les rôles d'écriture (et `marketing` pour les
  -- visuels) ; épreuves aussi par le `vendor`, sur une épreuve qu'il voit. Les
  -- livrables ne se déposent que par le service, jamais par un poste.
  EXECUTE format(
    'CREATE POLICY azimut_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK ('
    '  (bucket_id IN (''azimut-plans'', ''azimut-proofs'', ''azimut-creatives'')'
    '   AND %1$s IN (SELECT azimut.user_org_ids_with_role(%2$s)::text))'
    '  OR (bucket_id = ''azimut-creatives'' AND %1$s IN (SELECT azimut.user_org_ids_with_role(ARRAY[''marketing''])::text))'
    '  OR (bucket_id = ''azimut-proofs'' AND split_part(name, ''/'', 3) IN (SELECT p.id::text FROM azimut.proof p WHERE p.org_id::text = %1$s)))',
    org_of, writers);
  -- Aucune mise à jour : un fichier ne se réécrit pas, une nouvelle version a
  -- un nouveau chemin. Suppression par l'`admin` seul.
  EXECUTE format(
    'CREATE POLICY azimut_storage_delete ON storage.objects FOR DELETE TO authenticated USING ('
    '  bucket_id IN (''azimut-plans'', ''azimut-proofs'', ''azimut-creatives'', ''azimut-deliveries'')'
    '  AND %1$s IN (SELECT azimut.user_org_ids_with_role(ARRAY[''admin''])::text))',
    org_of);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION azimut.install_storage() FROM PUBLIC;

DO $$
BEGIN
  IF NOT azimut.install_storage() THEN
    RAISE NOTICE 'Pas de schéma storage : espaces de stockage non installés (azimut.install_storage() les posera).';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Espaces de stockage non installés, droits insuffisants : exécuter SELECT azimut.install_storage() sous un rôle d''administration (ORDRE.md, 0081).';
END;
$$;
