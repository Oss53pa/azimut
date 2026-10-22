-- Retour de 0078 : `apply_commands` retrouve sa forme de 0026, qui accepte
-- toute table du schéma, et la liste blanche disparaît. Base de
-- développement seulement.

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
  columns text;
  values_list text;
  assignments text;
  applied integer := 0;
BEGIN
  IF jsonb_typeof(commands) <> 'array' THEN
    RAISE EXCEPTION 'apply_commands attend un tableau de commandes';
  END IF;

  FOR command IN SELECT * FROM jsonb_array_elements(commands) LOOP
    op := command ->> 'operation';
    target := command ->> 'table';
    row_id := (command ->> 'id')::uuid;

    -- La table est confrontée au catalogue plutôt qu'interpolée telle quelle.
    -- La propriété du module est déjà contrôlée par `buildCommand`, mais cette
    -- fonction est atteignable directement : elle ne fait confiance à personne.
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_tables
      WHERE schemaname = 'azimut' AND tablename = target
    ) THEN
      RAISE EXCEPTION 'table inconnue : %', target;
    END IF;

    IF op = 'create' THEN
      payload := command -> 'after';
      SELECT string_agg(quote_ident(key), ', ' ORDER BY key),
             string_agg(quote_nullable(value), ', ' ORDER BY key)
        INTO columns, values_list
        FROM jsonb_each_text(payload);
      EXECUTE format('INSERT INTO azimut.%I (%s) VALUES (%s)', target, columns, values_list);

    ELSIF op = 'update' THEN
      payload := command -> 'after';
      SELECT string_agg(format('%I = %s', key, quote_nullable(value)), ', ' ORDER BY key)
        INTO assignments
        FROM jsonb_each_text(payload);
      EXECUTE format('UPDATE azimut.%I SET %s WHERE id = %L', target, assignments, row_id);

    ELSIF op = 'delete' THEN
      EXECUTE format('DELETE FROM azimut.%I WHERE id = %L', target, row_id);

    ELSE
      RAISE EXCEPTION 'opération inconnue : %', op;
    END IF;

    applied := applied + 1;
  END LOOP;

  RETURN applied;
END;
$$;

DROP TABLE IF EXISTS azimut.command_table;
