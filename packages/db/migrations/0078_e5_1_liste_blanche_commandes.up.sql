-- E5.1, M12.A2 et A6.1 : `apply_commands` n'écrit que ce que les modules
-- possèdent.
--
-- Décision D-4 de l'utilisateur, le 22/10/2026 : une liste blanche en base.
-- Jusqu'ici la fonction acceptait toute table du schéma, `organization`
-- comprise, et ne s'en remettait qu'aux droits et aux politiques. Elle était
-- atteignable directement, sans passer par `buildCommand`, qui seul
-- contrôlait la propriété.
--
-- Ce qui change :
--
-- 1. `azimut.command_table` dit, table par table, le module propriétaire et
--    les opérations permises. C'est une donnée de configuration, tirée du
--    registre de propriété (`OWNED_TABLES`, L1, plus `support`, scindée par
--    L0), et un essai vérifie qu'elle n'en diverge pas. Les tables en
--    insertion seule (A12.3) n'y admettent que la création. Une table
--    absente, `organization`, `membership`, `audit_log`, les chartes ou le
--    registre des migrations, est refusée : `EDIT.TABLE_NOT_OWNED`.
-- 2. Une commande mal formée est refusée, `EDIT.COMMAND_SHAPE_INVALID` : pas
--    d'objet, pas d'identifiant, un `after` qui n'est pas un objet, un `id`
--    qui contredit celui de la commande. Une modification ne réécrit ni `id`
--    ni `org_id` : un `org_id` fourni restreint la ligne visée au lieu de la
--    déplacer.
-- 3. Une modification ou une suppression qui n'atteint aucune ligne est
--    refusée, `EDIT.WRITE_REFUSED`. Elle passait en silence : un rôle sans
--    droit d'écriture croyait avoir écrit. Le refus est le même pour une
--    ligne absente, d'une autre organisation ou hors des droits du rôle
--    (A6.1).
--
-- Les droits par rôle restent tenus par les politiques (0075, 0077) : la
-- liste dit ce qu'une commande peut viser, les politiques qui peut l'écrire.
--
-- Additive : une table de configuration neuve et le remplacement d'une
-- fonction, aucune ligne existante touchée (A2.2, point 7).

CREATE TABLE azimut.command_table (
  table_name text PRIMARY KEY,
  modules text[] NOT NULL CHECK (cardinality(modules) >= 1),
  can_create boolean NOT NULL,
  can_update boolean NOT NULL,
  can_delete boolean NOT NULL
);

-- Lue par tous les rôles applicatifs, écrite par les seules migrations.
-- Les droits par défaut de 0025 l'accorderaient en écriture : ils sont
-- retirés.
REVOKE ALL ON azimut.command_table FROM PUBLIC, authenticated;
GRANT SELECT ON azimut.command_table TO authenticated;

INSERT INTO azimut.command_table (table_name, modules, can_create, can_update, can_delete) VALUES
  ('legal_entity', ARRAY['00-plateforme'], true, true, true),
  ('site', ARRAY['01-socle'], true, true, true),
  ('building', ARRAY['01-socle'], true, true, true),
  ('level', ARRAY['01-socle'], true, true, true),
  ('zone', ARRAY['01-socle'], true, true, true),
  ('plan_source', ARRAY['01-socle'], true, true, true),
  ('plan_calibration', ARRAY['01-socle'], true, true, true),
  ('plan_calibration_point', ARRAY['01-socle'], true, true, true),
  ('footprint', ARRAY['01-socle'], true, true, true),
  ('volume', ARRAY['01-socle'], true, true, true),
  ('opening', ARRAY['01-socle'], true, true, true),
  ('node', ARRAY['01-socle'], true, true, true),
  ('edge', ARRAY['01-socle'], true, true, true),
  ('vertical_link', ARRAY['01-socle'], true, true, true),
  ('building_link', ARRAY['01-socle'], true, true, true),
  ('destination', ARRAY['01-socle'], true, true, true),
  ('destination_name', ARRAY['01-socle'], true, true, true),
  ('category', ARRAY['01-socle'], true, true, true),
  ('graph_validation', ARRAY['01-socle'], true, false, false),
  ('temporary_closure', ARRAY['01-socle'], true, true, true),
  ('site_fact', ARRAY['01-socle'], true, true, true),
  ('parking_space', ARRAY['01-socle'], true, true, true),
  ('site_rules_binding', ARRAY['01-socle'], true, true, true),
  ('orientation_zone', ARRAY['02-wayfinding'], true, true, true),
  ('naming_rule', ARRAY['02-wayfinding'], true, true, true),
  ('information_level', ARRAY['02-wayfinding'], true, true, true),
  ('wayfinding_sequence', ARRAY['02-wayfinding'], true, true, true),
  ('message_schedule', ARRAY['02-wayfinding'], true, true, true),
  ('message_line', ARRAY['02-wayfinding'], true, true, true),
  ('review_annotation', ARRAY['02-wayfinding'], true, true, true),
  ('review_annotation_reply', ARRAY['02-wayfinding'], true, true, true),
  ('message_schedule_approval', ARRAY['02-wayfinding'], true, false, false),
  ('travel_profile', ARRAY['03-parcours'], true, true, true),
  ('route_cache', ARRAY['03-parcours'], true, true, true),
  ('decision_point', ARRAY['03-parcours'], true, true, true),
  ('support_typology', ARRAY['04-signaletique'], true, true, true),
  ('support_face', ARRAY['04-signaletique'], true, true, true),
  ('support_content_block', ARRAY['04-signaletique'], true, true, true),
  ('support_version', ARRAY['04-signaletique'], true, true, true),
  ('proof', ARRAY['04-signaletique'], true, true, true),
  ('approval', ARRAY['04-signaletique'], true, false, false),
  ('pictogram', ARRAY['04-signaletique'], true, true, true),
  ('ad_placement', ARRAY['05-regie'], true, true, true),
  ('ad_booking', ARRAY['05-regie'], true, true, true),
  ('ad_option', ARRAY['05-regie'], true, true, true),
  ('ad_creative', ARRAY['05-regie'], true, true, true),
  ('tenant_sign_regulation', ARRAY['06-enseignes'], true, true, true),
  ('tenant_sign_dossier', ARRAY['06-enseignes'], true, true, true),
  ('tenant_sign_part', ARRAY['06-enseignes'], true, true, true),
  ('fabrication_lot', ARRAY['07-chantier'], true, true, true),
  ('lot_support', ARRAY['07-chantier'], true, true, true),
  ('install_slot', ARRAY['07-chantier'], true, true, true),
  ('slot_support', ARRAY['07-chantier'], true, true, true),
  ('install_reserve', ARRAY['07-chantier'], true, true, true),
  ('installed_support', ARRAY['08-exploitation'], true, true, true),
  ('divergence', ARRAY['08-exploitation'], true, true, true),
  ('work_order', ARRAY['08-exploitation'], true, true, true),
  ('inspection_round', ARRAY['08-exploitation'], true, true, true),
  ('inspection_finding', ARRAY['08-exploitation'], true, true, true),
  ('cost_reference', ARRAY['09-budget'], true, true, true),
  ('budget_line', ARRAY['09-budget'], true, true, true),
  ('sketch_layer', ARRAY['12-atelier'], true, true, true),
  ('sketch_stroke', ARRAY['12-atelier'], true, true, true),
  ('support', ARRAY['02-wayfinding','04-signaletique'], true, true, true);

CREATE OR REPLACE FUNCTION azimut.apply_commands(commands jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  command jsonb;
  op text;
  target text;
  row_id uuid;
  payload jsonb;
  rule azimut.command_table;
  scope_org text;
  columns text;
  values_list text;
  assignments text;
  touched integer;
  applied integer := 0;
BEGIN
  IF jsonb_typeof(commands) <> 'array' THEN
    RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023';
  END IF;

  FOR command IN SELECT * FROM jsonb_array_elements(commands) LOOP
    IF jsonb_typeof(command) <> 'object' OR command ->> 'id' IS NULL THEN
      RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023';
    END IF;
    op := command ->> 'operation';
    target := command ->> 'table';
    row_id := (command ->> 'id')::uuid;

    SELECT * INTO rule FROM azimut.command_table c WHERE c.table_name = target;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EDIT.TABLE_NOT_OWNED' USING ERRCODE = '42501';
    END IF;

    IF op = 'create' THEN
      IF NOT rule.can_create THEN
        RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
      END IF;
      payload := command -> 'after';
      IF jsonb_typeof(payload) IS DISTINCT FROM 'object'
         OR (payload ? 'id' AND (payload ->> 'id')::uuid IS DISTINCT FROM row_id) THEN
        RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023';
      END IF;
      payload := payload || jsonb_build_object('id', row_id);
      SELECT string_agg(quote_ident(key), ', ' ORDER BY key),
             string_agg(quote_nullable(value), ', ' ORDER BY key)
        INTO columns, values_list
        FROM jsonb_each_text(payload);
      EXECUTE format('INSERT INTO azimut.%I (%s) VALUES (%s)', target, columns, values_list);

    ELSIF op = 'update' THEN
      IF NOT rule.can_update THEN
        RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
      END IF;
      payload := command -> 'after';
      IF jsonb_typeof(payload) IS DISTINCT FROM 'object'
         OR (payload ? 'id' AND (payload ->> 'id')::uuid IS DISTINCT FROM row_id) THEN
        RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023';
      END IF;
      scope_org := payload ->> 'org_id';
      payload := payload - 'id' - 'org_id';
      SELECT string_agg(format('%I = %s', key, quote_nullable(value)), ', ' ORDER BY key)
        INTO assignments
        FROM jsonb_each_text(payload);
      -- Rien à écrire : la ligne doit tout de même être atteignable.
      IF assignments IS NULL THEN
        assignments := 'id = id';
      END IF;
      EXECUTE format('UPDATE azimut.%I SET %s WHERE id = %L', target, assignments, row_id)
        || CASE WHEN scope_org IS NULL THEN '' ELSE format(' AND org_id = %L', scope_org) END;
      GET DIAGNOSTICS touched = ROW_COUNT;
      IF touched = 0 THEN
        RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
      END IF;

    ELSIF op = 'delete' THEN
      IF NOT rule.can_delete THEN
        RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
      END IF;
      EXECUTE format('DELETE FROM azimut.%I WHERE id = %L', target, row_id);
      GET DIAGNOSTICS touched = ROW_COUNT;
      IF touched = 0 THEN
        RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
      END IF;

    ELSE
      RAISE EXCEPTION 'EDIT.COMMAND_SHAPE_INVALID' USING ERRCODE = '22023';
    END IF;

    applied := applied + 1;
  END LOOP;

  RETURN applied;
END;
$$;
