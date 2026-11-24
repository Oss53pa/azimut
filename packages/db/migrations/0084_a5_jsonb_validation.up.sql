-- Validation par schéma des colonnes `jsonb` (lot Q16).
--
-- Le poste écrit toutes les tables par `apply_commands` (0026) et
-- `apply_journaled_commands` (0078), qu'il appelle directement par PostgREST :
-- la base est le seul endroit où une entrée peut être validée avant écriture.
-- 24 colonnes `jsonb` n'avaient aucune contrainte.
--
-- Décisions d'Oss53pa du 24 novembre 2026, consignées dans
-- `docs/decoupage-validation-jsonb.md` :
--   Q17 — `message_line.content` : la forme que le code écrit, l'écart avec
--         N2.2 et R5 étant signalé à l'éditeur ;
--   Q18 — `footprint.geometry` : A5.2 s'applique en base (polygone simple,
--         au moins 3 sommets) ;
--   Q19 — une colonne sans forme reçoit le type de son contenant et une borne
--         de taille ; le contenu se fixe au lot qui l'emploiera ;
--   Q20 — `support_content_block.config`, héritée, ne s'écrit plus ;
--   Q21 — 1 000 sommets au plus par empreinte.
-- Par analogie, signalée : une colonne dont seul le code fixe la forme est
-- traitée comme Q19. Seules les formes fixées par le cahier, ou tranchées par
-- Q17 et Q18, reçoivent une contrainte de contenu.
--
-- Borne de taille : celle du transport des commandes,
-- `MAX_WIRE_COMMAND_LENGTH` (1 048 576), et non une valeur nouvelle.
--
-- Toutes les contraintes sont posées NOT VALID : toute écriture nouvelle est
-- contrôlée, les lignes existantes ne sont ni lues ni transformées (A2.2,
-- point 7). La requête de relevé en fin de fichier liste celles qui ne
-- passeraient pas.
--
-- Chaque fonction rend un booléen défini, faux par défaut : une contrainte
-- CHECK qui vaut NULL est acceptée. Une colonne qui admet NULL le dit dans sa
-- contrainte, explicitement.

-- ── 1. Contenant et taille (Q19) ───────────────────────────────────────────

CREATE FUNCTION azimut.jsonb_contained(p_value jsonb, p_kinds text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    jsonb_typeof(p_value) = ANY (p_kinds) AND octet_length(p_value::text) <= 1048576,
    false);
$$;

-- ── 2. Formes fixées par le cahier ─────────────────────────────────────────

-- N4.2 : « Pour `free` uniquement, une valeur par langue. » Les langues sont
-- celles que la base admet pour un site (0020) ; une valeur est un texte non
-- vide.
CREATE FUNCTION azimut.lang_texts_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE WHEN azimut.jsonb_contained(p_value, ARRAY['object']) THEN
      EXISTS (SELECT 1 FROM jsonb_object_keys(p_value))
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_each(p_value) AS e(k, v)
        WHERE e.k <> ALL (ARRAY['fr', 'en'])
           OR jsonb_typeof(e.v) <> 'string'
           OR btrim(e.v #>> '{}') = ''
      )
    ELSE false END,
    false);
$$;

-- N2.2 : « tableau, Empreintes couvertes ». Des identifiants.
CREATE FUNCTION azimut.uuid_array_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE WHEN azimut.jsonb_contained(p_value, ARRAY['array']) THEN
      NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_value) AS e(v)
        WHERE jsonb_typeof(e.v) <> 'string'
           OR (e.v #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    ELSE false END,
    false);
$$;

-- A7 : un constat porte au moins son code et sa gravité.
CREATE FUNCTION azimut.findings_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE WHEN azimut.jsonb_contained(p_value, ARRAY['array']) THEN
      NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_value) AS e(v)
        WHERE jsonb_typeof(e.v) <> 'object'
           OR jsonb_typeof(e.v -> 'code') IS DISTINCT FROM 'string'
           OR (e.v ->> 'severity') IS NULL
           OR (e.v ->> 'severity') <> ALL (ARRAY['blocking', 'warning', 'info'])
      )
    ELSE false END,
    false);
$$;

-- D3.3 : des paramètres nommés, chacun un texte, un nombre ou un booléen.
CREATE FUNCTION azimut.scalar_params_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE WHEN azimut.jsonb_contained(p_value, ARRAY['object']) THEN
      NOT EXISTS (
        SELECT 1 FROM jsonb_each(p_value) AS e(k, v)
        WHERE jsonb_typeof(e.v) <> ALL (ARRAY['string', 'number', 'boolean'])
      )
    ELSE false END,
    false);
$$;

-- ── 3. Q17 — le contenu d'une ligne de message, tel que le code l'écrit ─────
--
-- `{block_kind, entries}` ; `block_kind` parmi les types de bloc de A5.6 ;
-- chaque mention porte `destination_id`, `text` (texte par langue), `direction`
-- et `distance_m`, chacun pouvant être nul sauf `text`.

CREATE FUNCTION azimut.message_content_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN NOT azimut.jsonb_contained(p_value, ARRAY['object']) THEN false
      WHEN (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k)
           IS DISTINCT FROM ARRAY['block_kind', 'entries'] THEN false
      WHEN (p_value ->> 'block_kind') IS NULL
        OR (p_value ->> 'block_kind') <> ALL (ARRAY[
             'header', 'destination_list', 'pictogram', 'arrow', 'map',
             'legend', 'free_text', 'logo', 'emergency_info']) THEN false
      WHEN jsonb_typeof(p_value -> 'entries') <> 'array' THEN false
      ELSE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_value -> 'entries') AS e(v)
        WHERE jsonb_typeof(e.v) <> 'object'
           OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e.v) AS k)
              IS DISTINCT FROM ARRAY['destination_id', 'direction', 'distance_m', 'text']
           OR jsonb_typeof(e.v -> 'destination_id') <> ALL (ARRAY['string', 'null'])
           OR jsonb_typeof(e.v -> 'direction') <> ALL (ARRAY['string', 'null'])
           OR jsonb_typeof(e.v -> 'distance_m') <> ALL (ARRAY['number', 'null'])
           OR jsonb_typeof(e.v -> 'text') <> 'object'
           OR EXISTS (SELECT 1 FROM jsonb_each(e.v -> 'text') AS t(k, w) WHERE jsonb_typeof(t.w) <> 'string')
      )
    END,
    false);
$$;

-- ── 4. Q18 et Q21 — une empreinte est un polygone simple ───────────────────
--
-- A5.2 : « un polygone simple, fermé, non auto-intersectant, au minimum 3
-- sommets. » `{vertices: [{x_m, y_m}…]}`, la fermeture implicite : le dernier
-- sommet rejoint le premier sans le répéter, comme le code l'écrit. Un côté de
-- longueur nulle est refusé ; deux côtés non adjacents qui se coupent aussi.
-- Le test coûte de l'ordre de n² : 1 000 sommets au plus (Q21).

CREATE FUNCTION azimut.polygon_m_valid(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  n integer;
  xs double precision[];
  ys double precision[];
  ax double precision; ay double precision; bx double precision; by_ double precision;
  cx double precision; cy double precision; dx double precision; dy double precision;
  d1 double precision; d2 double precision; d3 double precision; d4 double precision;
BEGIN
  IF NOT azimut.jsonb_contained(p_value, ARRAY['object'])
     OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k) IS DISTINCT FROM ARRAY['vertices']
     OR jsonb_typeof(p_value -> 'vertices') <> 'array' THEN
    RETURN false;
  END IF;
  n := jsonb_array_length(p_value -> 'vertices');
  IF n < 3 OR n > 1000 THEN
    RETURN false;
  END IF;
  SELECT array_agg((e.v ->> 'x_m')::double precision ORDER BY e.o),
         array_agg((e.v ->> 'y_m')::double precision ORDER BY e.o)
    INTO xs, ys
    FROM jsonb_array_elements(p_value -> 'vertices') WITH ORDINALITY AS e(v, o)
    WHERE azimut.point_m_valid(e.v);
  IF coalesce(array_length(xs, 1), 0) <> n THEN
    RETURN false;
  END IF;
  FOR i IN 1..n LOOP
    ax := xs[i]; ay := ys[i]; bx := xs[i % n + 1]; by_ := ys[i % n + 1];
    IF ax = bx AND ay = by_ THEN
      RETURN false;
    END IF;
    FOR j IN i + 2..n LOOP
      CONTINUE WHEN i = 1 AND j = n;
      cx := xs[j]; cy := ys[j]; dx := xs[j % n + 1]; dy := ys[j % n + 1];
      d1 := (bx - ax) * (cy - ay) - (by_ - ay) * (cx - ax);
      d2 := (bx - ax) * (dy - ay) - (by_ - ay) * (dx - ax);
      d3 := (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
      d4 := (dx - cx) * (by_ - cy) - (dy - cy) * (bx - cx);
      IF ((d1 > 0 AND d2 < 0) OR (d1 < 0 AND d2 > 0))
         AND ((d3 > 0 AND d4 < 0) OR (d3 < 0 AND d4 > 0)) THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;

-- ── 5. Les contraintes ─────────────────────────────────────────────────────

-- Contenu fixé par le cahier, ou tranché (Q17, Q18).
ALTER TABLE azimut.footprint ADD CONSTRAINT footprint_geometry_polygon
  CHECK (azimut.polygon_m_valid(geometry)) NOT VALID;
ALTER TABLE azimut.message_line ADD CONSTRAINT message_line_content_shape
  CHECK (azimut.message_content_valid(content)) NOT VALID;
ALTER TABLE azimut.support_content_block ADD CONSTRAINT support_content_block_free_text_langs
  CHECK (free_text IS NULL OR azimut.lang_texts_valid(free_text)) NOT VALID;
ALTER TABLE azimut.orientation_zone ADD CONSTRAINT orientation_zone_footprint_ids_uuids
  CHECK (azimut.uuid_array_valid(footprint_ids)) NOT VALID;
ALTER TABLE azimut.graph_validation ADD CONSTRAINT graph_validation_findings_shape
  CHECK (azimut.findings_valid(findings)) NOT VALID;
ALTER TABLE azimut.rules_pack_rule ADD CONSTRAINT rules_pack_rule_params_scalars
  CHECK (azimut.scalar_params_valid(params)) NOT VALID;

-- Q20 — la colonne héritée ne prend plus que sa valeur par défaut.
ALTER TABLE azimut.support_content_block ADD CONSTRAINT support_content_block_config_retired
  CHECK (config = '{}'::jsonb) NOT VALID;

-- Contenant et taille (Q19, et par analogie les formes fixées par le code seul).
ALTER TABLE azimut.audit_log ADD CONSTRAINT audit_log_before_contained
  CHECK (before IS NULL OR azimut.jsonb_contained(before, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.audit_log ADD CONSTRAINT audit_log_after_contained
  CHECK (after IS NULL OR azimut.jsonb_contained(after, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.building ADD CONSTRAINT building_opening_hours_contained
  CHECK (opening_hours IS NULL OR azimut.jsonb_contained(opening_hours, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.charter_rule ADD CONSTRAINT charter_rule_params_contained
  CHECK (azimut.jsonb_contained(params, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.divergence ADD CONSTRAINT divergence_detail_contained
  CHECK (detail IS NULL OR azimut.jsonb_contained(detail, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.edge ADD CONSTRAINT edge_availability_contained
  CHECK (availability IS NULL OR azimut.jsonb_contained(availability, ARRAY['object', 'array'])) NOT VALID;
ALTER TABLE azimut.job ADD CONSTRAINT job_payload_contained
  CHECK (azimut.jsonb_contained(payload, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.job ADD CONSTRAINT job_result_contained
  CHECK (result IS NULL OR azimut.jsonb_contained(result, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.kiosk ADD CONSTRAINT kiosk_hardware_profile_contained
  CHECK (hardware_profile IS NULL OR azimut.jsonb_contained(hardware_profile, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.kiosk_telemetry ADD CONSTRAINT kiosk_telemetry_payload_contained
  CHECK (azimut.jsonb_contained(payload, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.legal_entity ADD CONSTRAINT legal_entity_address_contained
  CHECK (address IS NULL OR azimut.jsonb_contained(address, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.route_cache ADD CONSTRAINT route_cache_path_contained
  CHECK (azimut.jsonb_contained(path, ARRAY['array'])) NOT VALID;
ALTER TABLE azimut.support_content_block ADD CONSTRAINT support_content_block_binding_contained
  CHECK (binding IS NULL OR azimut.jsonb_contained(binding, ARRAY['object'])) NOT VALID;
ALTER TABLE azimut.support_face ADD CONSTRAINT support_face_langs_contained
  CHECK (langs IS NULL OR azimut.jsonb_contained(langs, ARRAY['array'])) NOT VALID;
ALTER TABLE azimut.travel_profile ADD CONSTRAINT travel_profile_excluded_edge_kinds_contained
  CHECK (azimut.jsonb_contained(excluded_edge_kinds, ARRAY['array'])) NOT VALID;
ALTER TABLE azimut.travel_profile ADD CONSTRAINT travel_profile_weights_contained
  CHECK (weights IS NULL OR azimut.jsonb_contained(weights, ARRAY['object', 'array'])) NOT VALID;
ALTER TABLE azimut.work_order ADD CONSTRAINT work_order_scope_contained
  CHECK (scope IS NULL OR azimut.jsonb_contained(scope, ARRAY['object', 'array'])) NOT VALID;

-- Relevé des lignes existantes qui ne passeraient pas, à lancer par la
-- connexion propriétaire avant toute validation. Chaque contrainte est
-- validée dans un sous-bloc annulé ; celles qui échouent sont nommées.
--
--   DO $$
--   DECLARE c record;
--   BEGIN
--     FOR c IN SELECT conrelid::regclass AS t, conname FROM pg_constraint
--              WHERE connamespace = 'azimut'::regnamespace AND NOT convalidated
--     LOOP
--       BEGIN
--         EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.t, c.conname);
--         RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'annulé';
--       EXCEPTION
--         WHEN check_violation THEN RAISE NOTICE 'à reprendre : % (%)', c.conname, c.t;
--         WHEN raise_exception THEN NULL;
--       END;
--     END LOOP;
--   END $$;
