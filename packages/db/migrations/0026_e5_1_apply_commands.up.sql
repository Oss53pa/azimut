-- E5.1 et A2 (module 12) — le chemin d'écriture, atteignable depuis le poste.
--
-- `applyCommands` (packages/db/src/write-path.ts) est le chemin d'écriture
-- côté serveur. Le poste, lui, parle à PostgREST et non à PostgreSQL : il ne
-- peut pas ouvrir de transaction. Or M1 (partie M) veut qu'un site naisse avec
-- un bâtiment et un niveau — « un site sans niveau est un état inutile » — et
-- trois requêtes séparées laisseraient ce cas se produire au moindre incident.
--
-- A3.1 range les « fonctions serveur » parmi les tâches courtes : cette
-- fonction en est une. Elle ne porte aucune logique métier — les contrôles de
-- M1 sont tenus par l'atelier, avant l'appel — et n'applique que les trois
-- opérations élémentaires du modèle de commande.
--
-- Elle n'est pas SECURITY DEFINER : elle s'exécute avec les droits et les
-- politiques de l'appelant. Le cloisonnement reste tenu par la base (A6.1), et
-- non par cette fonction.

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

-- Le rôle applicatif l'appelle ; les politiques de chaque table décident.
GRANT EXECUTE ON FUNCTION azimut.apply_commands(jsonb) TO authenticated;
