-- S6.1b, décisions Q6 et Q7 d'Oss53pa — l'habillage entre en base.
--
-- E9.3 définit `decoration_layer` et `decoration_shape`, et L3 les donne au
-- module 01. Elles n'avaient aucune migration : une commande d'habillage
-- n'avait aucune ligne à viser, et l'habillage ne pouvait ni se propager ni
-- s'annuler comme le reste (S6).
--
--   Q6 — tables créées selon E9.3, plus deux colonnes sur `decoration_shape` :
--        `z_order int` et `style jsonb`, rôles seulement, aucune couleur ;
--   Q7 — l'identifiant de forme est un `uuid` tiré par l'appelant à la
--        création, inscrit dans la commande.
--
-- Les deux colonnes de Q6 sont absentes d'E9.3 ; elles sont signalées à
-- l'éditeur (`docs/decoupage-s6-edition-simultanee.md`, section 5).
--
-- Formes stockées, en mètres du repère du niveau, comme `node.position` :
--   géométrie  {type: 'polygon',   points: [{x_m, y_m}…]}        3 à 1 000
--              {type: 'polyline',  points: [{x_m, y_m}…]}        2 à 1 000
--              {type: 'rectangle', origin: {x_m, y_m}, width_m, height_m}
--              {type: 'ellipse',   center: {x_m, y_m}, rx_m, ry_m}
--              {type: 'symbol_ref', position: {x_m, y_m}, symbol_id, scale}
--   style      {fill_role, stroke_role, stroke_width_m, opacity}
-- Un rôle est un nom de rôle de charte, jamais une couleur (E10, A11).
-- `kind` suit la géométrie comme l'éditeur la dérive (`kindForGeometry`) :
-- surface pour polygone, rectangle et ellipse ; tracé pour polyligne ;
-- symbole pour référence de symbole. Le groupe, qu'E9.3 nomme sans en
-- définir la géométrie, n'est contraint que par la forme de celle-ci.
--
-- Additive : deux tables neuves et leurs fonctions. Aucune ligne existante
-- n'est touchée (A2.2, point 7).

-- ── 1. Les formes en jsonb ─────────────────────────────────────────────────

CREATE FUNCTION azimut.points_m_valid(p_points jsonb, p_min integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_points) IS DISTINCT FROM 'array' THEN false
      WHEN jsonb_array_length(p_points) < p_min OR jsonb_array_length(p_points) > 1000 THEN false
      ELSE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_points) AS e(v) WHERE NOT azimut.point_m_valid(e.v))
    END,
    false);
$$;

-- Une longueur strictement positive, bornée au kilomètre.
CREATE FUNCTION azimut.length_m_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'number' THEN false
      ELSE (p_value #>> '{}')::numeric > 0 AND (p_value #>> '{}')::numeric <= 1000
    END,
    false);
$$;

CREATE FUNCTION azimut.decoration_geometry_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'object' THEN false
      WHEN jsonb_typeof(p_value -> 'type') IS DISTINCT FROM 'string' THEN false
      WHEN p_value ->> 'type' IN ('polygon', 'polyline') THEN
        (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k) = ARRAY['points', 'type']
        AND azimut.points_m_valid(p_value -> 'points', CASE WHEN p_value ->> 'type' = 'polygon' THEN 3 ELSE 2 END)
      WHEN p_value ->> 'type' = 'rectangle' THEN
        (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k)
          = ARRAY['height_m', 'origin', 'type', 'width_m']
        AND azimut.point_m_valid(p_value -> 'origin')
        AND azimut.length_m_valid(p_value -> 'width_m') AND azimut.length_m_valid(p_value -> 'height_m')
      WHEN p_value ->> 'type' = 'ellipse' THEN
        (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k)
          = ARRAY['center', 'rx_m', 'ry_m', 'type']
        AND azimut.point_m_valid(p_value -> 'center')
        AND azimut.length_m_valid(p_value -> 'rx_m') AND azimut.length_m_valid(p_value -> 'ry_m')
      WHEN p_value ->> 'type' = 'symbol_ref' THEN
        (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k)
          = ARRAY['position', 'scale', 'symbol_id', 'type']
        AND azimut.point_m_valid(p_value -> 'position')
        AND jsonb_typeof(p_value -> 'symbol_id') = 'string'
        AND (p_value ->> 'symbol_id') ~ '^[a-z0-9][a-z0-9._-]{0,127}$'
        AND jsonb_typeof(p_value -> 'scale') = 'number'
        AND (p_value ->> 'scale')::numeric > 0 AND (p_value ->> 'scale')::numeric <= 1000
      ELSE false
    END,
    false);
$$;

-- Un nom de rôle de charte, ou rien. Jamais une couleur : ni `#`, ni
-- parenthèse, ni espace ne passent.
CREATE FUNCTION azimut.style_role_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_value) = 'null' THEN true
      WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'string' THEN false
      ELSE (p_value #>> '{}') ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,7}$'
           AND length(p_value #>> '{}') <= 128
    END,
    false);
$$;

CREATE FUNCTION azimut.decoration_style_valid(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'object' THEN false
      WHEN (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k)
           IS DISTINCT FROM ARRAY['fill_role', 'opacity', 'stroke_role', 'stroke_width_m'] THEN false
      WHEN jsonb_typeof(p_value -> 'stroke_width_m') <> 'number'
           OR jsonb_typeof(p_value -> 'opacity') <> 'number' THEN false
      ELSE azimut.style_role_valid(p_value -> 'fill_role')
           AND azimut.style_role_valid(p_value -> 'stroke_role')
           AND (p_value ->> 'stroke_width_m')::numeric >= 0
           AND (p_value ->> 'stroke_width_m')::numeric <= 100
           AND (p_value ->> 'opacity')::numeric >= 0
           AND (p_value ->> 'opacity')::numeric <= 1
    END,
    false);
$$;

-- ── 2. Les tables ──────────────────────────────────────────────────────────

CREATE TABLE azimut.decoration_layer (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id       uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  level_id      uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  z_order       integer NOT NULL DEFAULT 0 CHECK (z_order BETWEEN -100000 AND 100000),
  visible       boolean NOT NULL DEFAULT true,
  print_visible boolean NOT NULL DEFAULT true,
  locked        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decoration_layer_level_idx ON azimut.decoration_layer (level_id);
CREATE INDEX decoration_layer_site_idx ON azimut.decoration_layer (site_id);

CREATE TABLE azimut.decoration_shape (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  layer_id      uuid NOT NULL REFERENCES azimut.decoration_layer(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('area', 'path', 'symbol', 'group')),
  geometry      jsonb NOT NULL CHECK (azimut.decoration_geometry_valid(geometry)),
  style_role    text CHECK (style_role IS NULL OR azimut.style_role_valid(to_jsonb(style_role))),
  label         text NOT NULL DEFAULT '' CHECK (length(label) <= 200),
  rotation_deg  numeric NOT NULL DEFAULT 0 CHECK (rotation_deg >= 0 AND rotation_deg < 360),
  -- Q6.
  z_order       integer NOT NULL DEFAULT 0 CHECK (z_order BETWEEN 0 AND 1000000),
  style         jsonb NOT NULL CHECK (azimut.decoration_style_valid(style)),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decoration_shape_kind_follows_geometry CHECK (
    kind = 'group'
    OR (kind = 'area' AND geometry ->> 'type' IN ('polygon', 'rectangle', 'ellipse'))
    OR (kind = 'path' AND geometry ->> 'type' = 'polyline')
    OR (kind = 'symbol' AND geometry ->> 'type' = 'symbol_ref'))
);
CREATE INDEX decoration_shape_layer_idx ON azimut.decoration_shape (layer_id);

-- ── 3. La cohérence des rattachements ──────────────────────────────────────
--
-- Une clé étrangère ne voit pas les organisations : sans ce contrôle, une
-- couche pourrait viser le niveau d'un autre site, ou d'une autre
-- organisation, et une forme la couche d'une autre organisation. Le contrôle
-- lit les lignes sous les droits de l'appelant : une ligne qu'il ne voit pas
-- ne le rattache à rien.

CREATE FUNCTION azimut.decoration_layer_attached()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM azimut.level l
      JOIN azimut.building b ON b.id = l.building_id
     WHERE l.id = NEW.level_id AND b.site_id = NEW.site_id
       AND l.org_id = NEW.org_id AND b.org_id = NEW.org_id
  ) OR NOT EXISTS (
    SELECT 1 FROM azimut.site s WHERE s.id = NEW.site_id AND s.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'couche d''habillage rattachée hors de son site' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decoration_layer_attached
  BEFORE INSERT OR UPDATE OF org_id, site_id, level_id ON azimut.decoration_layer
  FOR EACH ROW EXECUTE FUNCTION azimut.decoration_layer_attached();

CREATE FUNCTION azimut.decoration_shape_attached()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM azimut.decoration_layer d WHERE d.id = NEW.layer_id AND d.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'forme d''habillage rattachée hors de son organisation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decoration_shape_attached
  BEFORE INSERT OR UPDATE OF org_id, layer_id ON azimut.decoration_shape
  FOR EACH ROW EXECUTE FUNCTION azimut.decoration_shape_attached();

-- ── 4. Horodatage, verrou ferme (0083) ─────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.decoration_layer
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.decoration_shape
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE TRIGGER guard_object_lock BEFORE UPDATE OR DELETE ON azimut.decoration_layer
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_object_lock();
CREATE TRIGGER guard_object_lock BEFORE UPDATE OR DELETE ON azimut.decoration_shape
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_object_lock();

-- ── 5. Cloisonnement (A6.1, A6.2, 0076, 0079, 0080) ────────────────────────

ALTER TABLE azimut.decoration_layer ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.decoration_layer FORCE ROW LEVEL SECURITY;
CREATE POLICY decoration_layer_org_policy ON azimut.decoration_layer FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY decoration_layer_auditor_no_insert ON azimut.decoration_layer AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY decoration_layer_auditor_no_update ON azimut.decoration_layer AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))))
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY decoration_layer_auditor_no_delete ON azimut.decoration_layer AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY decoration_layer_marketing_no_access ON azimut.decoration_layer AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['marketing']))))
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['marketing']))));
CREATE POLICY decoration_layer_mfa_required ON azimut.decoration_layer AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (org_id IN (SELECT azimut.org_ids_lacking_mfa())))
  WITH CHECK (NOT (org_id IN (SELECT azimut.org_ids_lacking_mfa())));
GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.decoration_layer TO authenticated;

ALTER TABLE azimut.decoration_shape ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.decoration_shape FORCE ROW LEVEL SECURITY;
CREATE POLICY decoration_shape_org_policy ON azimut.decoration_shape FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY decoration_shape_auditor_no_insert ON azimut.decoration_shape AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY decoration_shape_auditor_no_update ON azimut.decoration_shape AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))))
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY decoration_shape_auditor_no_delete ON azimut.decoration_shape AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['auditor']))));
CREATE POLICY decoration_shape_marketing_no_access ON azimut.decoration_shape AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['marketing']))))
  WITH CHECK (NOT (org_id IN (SELECT azimut.user_org_ids_with_role(ARRAY['marketing']))));
CREATE POLICY decoration_shape_mfa_required ON azimut.decoration_shape AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (org_id IN (SELECT azimut.org_ids_lacking_mfa())))
  WITH CHECK (NOT (org_id IN (SELECT azimut.org_ids_lacking_mfa())));
GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.decoration_shape TO authenticated;
