-- Lot 4 de l'audit (A6.3) : la validation des entrées, tenue en base.
--
-- Le studio valide pour l'ergonomie ; la base valide pour la sécurité, quel
-- que soit le chemin d'écriture : `apply_commands`, l'API directe sous RLS, le
-- compilateur.
--
-- 1. Les plafonds génériques sont des seuils de configuration (D-5) :
--    `input.text.max_chars` pour une valeur de texte, `input.json.max_bytes`
--    pour une structure `jsonb`, `import.csv.max_rows` et
--    `import.csv.max_bytes` pour un import de tableur.
-- 2. `text_fault(v)` : le motif de refus d'un texte stocké, ou NULL. Refusés :
--    un caractère de contrôle (C0 hors tabulation et fin de ligne, DEL, C1),
--    un forçage ou un isolement de direction, une forme non NFC.
-- 3. `guard_input()` : un déclencheur BEFORE INSERT OR UPDATE posé sur chaque
--    table du schéma, `audit_log` exceptée (lot 9). Il contrôle chaque valeur
--    écrite ou changée : un texte par `text_fault` et le plafond de
--    caractères, une structure par le plafond d'octets et `text_fault` sur
--    chacune de ses chaînes, clés comprises. Une valeur inchangée par une
--    mise à jour n'est pas rejugée.
-- 4. Les quatre longueurs que le cahier fixe (M1, M1bis et M3 de la partie M, N2.2) deviennent
--    des contraintes, avec les espaces de bord et les fins de ligne refusés.
--
-- Le refus porte le code stable `EDIT.COMMAND_SHAPE_INVALID` (E5.1) et, en
-- détail, `<table>.<colonne> <motif>`.

INSERT INTO azimut.security_setting (key, value, unit, org_overridable, source_ref, description) VALUES
  ('input.text.max_chars', 65536, 'count', false,
   'Valeur initiale du lot 4 (A6.3)', 'Nombre maximal de caractères d''une valeur de texte'),
  ('input.json.max_bytes', 8388608, 'bytes', false,
   'Valeur initiale du lot 4 (A6.3) ; au-dessus d''un SVG embarqué de asset.svg.max_bytes',
   'Taille maximale d''une structure jsonb'),
  ('import.csv.max_rows', 50000, 'count', true,
   'Valeur initiale du lot 4 (A6.3)', 'Nombre maximal de lignes d''un import de tableur'),
  ('import.csv.max_bytes', 10485760, 'bytes', true,
   'Valeur initiale du lot 4 (A6.3)', 'Taille maximale d''un import de tableur');

-- Un plafond commun, lisible par tout rôle qui écrit : le déclencheur s'exécute
-- sous le rôle de l'écrivain, quel qu'il soit. La valeur n'est pas secrète.
CREATE FUNCTION azimut.input_limit(p_key text) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.value FROM azimut.security_setting s WHERE s.key = p_key
$$;
REVOKE ALL ON FUNCTION azimut.input_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.input_limit(text) TO PUBLIC;

CREATE FUNCTION azimut.text_fault(v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN v ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]' THEN 'control'
    WHEN v ~ '[‪-‮⁦-⁩]' THEN 'bidi'
    WHEN NOT (v IS NFC NORMALIZED) THEN 'not_nfc'
  END
$$;

CREATE FUNCTION azimut.guard_input() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  fresh jsonb := to_jsonb(NEW);
  stale jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END;
  col text;
  val jsonb;
  fault text;
  max_chars numeric;
  max_bytes numeric;
BEGIN
  FOR col, val IN SELECT e.key, e.value FROM jsonb_each(fresh) e LOOP
    CONTINUE WHEN stale IS NOT NULL AND (stale -> col) IS NOT DISTINCT FROM val;
    CONTINUE WHEN jsonb_typeof(val) NOT IN ('string', 'object', 'array');
    IF max_chars IS NULL THEN
      max_chars := azimut.input_limit('input.text.max_chars');
      max_bytes := azimut.input_limit('input.json.max_bytes');
    END IF;
    fault := NULL;
    IF jsonb_typeof(val) = 'string' THEN
      fault := azimut.text_fault(val #>> '{}');
      IF fault IS NULL AND char_length(val #>> '{}') > max_chars THEN
        fault := 'too_long';
      END IF;
    ELSIF octet_length(val::text) > max_bytes THEN
      fault := 'too_large';
    ELSE
      SELECT x.f INTO fault FROM (
        SELECT azimut.text_fault(s #>> '{}') AS f
        FROM jsonb_path_query(val, 'strict $.** ? (@.type() == "string")') s
        UNION ALL
        SELECT azimut.text_fault(k #>> '{}')
        FROM jsonb_path_query(val, 'strict $.** ? (@.type() == "object").keyvalue().key') k
      ) x WHERE x.f IS NOT NULL LIMIT 1;
    END IF;
    IF fault IS NOT NULL THEN
      RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023',
        DETAIL = format('%s.%s %s', TG_TABLE_NAME, col, fault);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Posé sur chaque table existante. Une table créée plus tard le reçoit dans sa
-- propre migration : `input-catalogue.db.test.ts` signale celle qui ne l'a pas.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND c.relkind = 'r'
      AND c.relname NOT LIKE '\_%' AND c.relname <> 'audit_log'
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE TRIGGER guard_input BEFORE INSERT OR UPDATE ON azimut.%I '
      'FOR EACH ROW EXECUTE FUNCTION azimut.guard_input()', t);
  END LOOP;
END $$;

-- Les longueurs que le cahier fixe, avec le refus des espaces de bord et des
-- fins de ligne qui accompagne tout champ d'une ligne.
ALTER TABLE azimut.site ADD CONSTRAINT site_name_input CHECK (
  char_length(name) BETWEEN 2 AND 120 AND btrim(name) = name AND name !~ '[\t\n\r]');
ALTER TABLE azimut.building ADD CONSTRAINT building_name_input CHECK (
  char_length(name) BETWEEN 1 AND 80 AND btrim(name) = name AND name !~ '[\t\n\r]');
ALTER TABLE azimut.footprint ADD CONSTRAINT footprint_unit_code_input CHECK (
  unit_code IS NULL
  OR (char_length(unit_code) BETWEEN 1 AND 20 AND btrim(unit_code) = unit_code
      AND unit_code !~ '[\t\n\r]'));
ALTER TABLE azimut.orientation_zone ADD CONSTRAINT orientation_zone_code_input CHECK (
  btrim(code) = code AND code !~ '[\t\n\r]');
