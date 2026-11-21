-- S6.2 — le journal des commandes validées, et le chemin qui l'écrit.
--
-- S-19 : « Ce qui se propage, ce sont les commandes validées de la section
-- E5.1. » Décisions d'Oss53pa du 21 novembre 2026, consignées dans
-- `docs/decoupage-s6-edition-simultanee.md` : un journal en insertion seule,
-- une suite numérotée par site, des postes qui le relisent par interrogation
-- périodique. La table ne figure ni en A5 ni en S9 ; elle est signalée à
-- l'éditeur.
--
-- Pourquoi une fonction nouvelle, et non un journal écrit à côté de
-- `apply_commands` (0026) : cette fonction n'examine jamais l'état `before`.
-- Elle écrit `after` sur une ligne qui a pu changer depuis, et la dernière
-- écriture gagne. Un journal tenu à côté enregistrerait des commandes
-- appliquées sur un état périmé, dans un ordre qui ne serait pas celui de la
-- base. `apply_journaled_commands` fait les trois en une transaction :
--
--   1. elle sérialise les écritures d'un même site, par un verrou consultatif
--      de transaction ;
--   2. elle applique chaque commande sous condition — une création échoue si
--      la ligne existe, une modification ou une suppression si une colonne de
--      `before` n'a plus la valeur attendue ;
--   3. elle inscrit chaque commande appliquée au journal, avec le numéro
--      suivant du site.
--
-- Une commande périmée fait échouer l'appel entier avec l'état `PT409`, que
-- PostgREST rend en statut 409. Une ligne invisible sous les politiques
-- échoue de la même façon qu'une ligne absente : le refus ne dit rien de
-- l'existence d'une ligne d'une autre organisation (A6.1).
--
-- `apply_commands` reste inchangée : ses appelants ne changent pas de
-- comportement.
--
-- Comme 0026, la fonction n'est pas SECURITY DEFINER. Elle s'exécute sous les
-- droits et les politiques de l'appelant ; le cloisonnement reste tenu par la
-- base.
--
-- Additive : une table neuve, deux fonctions neuves, aucune ligne existante
-- touchée (A2.2, point 7).

CREATE TABLE azimut.command_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  -- Le niveau du geste, quand il en a un. Une commande de site, de bâtiment ou
  -- d'annuaire n'en a pas, et c'est pourquoi la suite est celle du site.
  level_id uuid REFERENCES azimut.level(id) ON DELETE RESTRICT,
  seq bigint NOT NULL CHECK (seq > 0),
  author_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  -- La commande telle que `serializeCommand` l'écrit, relue par `parseCommand`
  -- à la réception. La forme textuelle d'un jsonb ajoute au plus une espace
  -- par séparateur : deux fois la borne de transport
  -- (`MAX_WIRE_COMMAND_LENGTH`, 1 048 576) majore toute commande valide.
  command jsonb NOT NULL
    CHECK (jsonb_typeof(command) = 'object' AND length(command::text) <= 2097152),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT command_journal_site_seq UNIQUE (site_id, seq),
  -- La commande porte son organisation ; elle ne peut pas en annoncer une
  -- autre que celle de la ligne qui la range.
  CONSTRAINT command_journal_same_org CHECK (command ->> 'org_id' = org_id::text)
);

CREATE INDEX idx_command_journal_org ON azimut.command_journal(org_id);

-- ── Cloisonnement (A6.1) et rôles (0076) ──────────────────────────────────

ALTER TABLE azimut.command_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.command_journal FORCE ROW LEVEL SECURITY;

CREATE POLICY command_journal_org_select ON azimut.command_journal
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY command_journal_org_insert ON azimut.command_journal
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND author_id = azimut.current_user_id()
  );

-- Les trois politiques restrictives de 0076, comme toute table portant
-- `org_id` : l'`auditor` n'écrit nulle part.
CREATE POLICY command_journal_auditor_no_insert ON azimut.command_journal
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY command_journal_auditor_no_update ON azimut.command_journal
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')))
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY command_journal_auditor_no_delete ON azimut.command_journal
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));

-- ── Insertion seule, et par la seule fonction ─────────────────────────────
--
-- Les barrages de A12.3 : droits retirés, déclencheurs de ligne, déclencheur
-- d'instruction pour TRUNCATE. Un cinquième s'y ajoute : une insertion qui ne
-- vient pas de `apply_journaled_commands` est refusée. Sans lui, un membre
-- pourrait inscrire au journal une commande que la base n'a jamais appliquée,
-- et les autres postes l'appliqueraient chez eux.

GRANT SELECT, INSERT ON azimut.command_journal TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON azimut.command_journal FROM authenticated;

CREATE FUNCTION azimut.block_command_journal_modification()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'command_journal records are insert-only';
END;
$$;

CREATE TRIGGER guard_command_journal_update
  BEFORE UPDATE ON azimut.command_journal
  FOR EACH ROW EXECUTE FUNCTION azimut.block_command_journal_modification();

CREATE TRIGGER guard_command_journal_delete
  BEFORE DELETE ON azimut.command_journal
  FOR EACH ROW EXECUTE FUNCTION azimut.block_command_journal_modification();

CREATE FUNCTION azimut.block_command_journal_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'command_journal records are insert-only and cannot be truncated';
END;
$$;

CREATE TRIGGER guard_command_journal_truncate
  BEFORE TRUNCATE ON azimut.command_journal
  FOR EACH STATEMENT EXECUTE FUNCTION azimut.block_command_journal_truncate();

CREATE FUNCTION azimut.guard_command_journal_writer()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('azimut.journal_writer', true) IS DISTINCT FROM 'apply_journaled_commands' THEN
    RAISE EXCEPTION 'command_journal is written by apply_journaled_commands only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_command_journal_writer
  BEFORE INSERT ON azimut.command_journal
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_command_journal_writer();

-- ── Le chemin d'écriture journalisé ───────────────────────────────────────

CREATE FUNCTION azimut.apply_journaled_commands(
  p_site_id uuid,
  p_level_id uuid,
  p_commands jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  -- Les neuf champs qu'écrit `serializeCommand`, et eux seuls.
  wire_keys constant text[] := ARRAY[
    'after', 'before', 'groupKey', 'id', 'module', 'operation', 'org_id', 'table', 'timestamp'
  ];
  -- Borne technique d'un appel : un geste en produit quelques commandes.
  max_commands constant integer := 1000;
  site_org uuid;
  next_seq bigint;
  command jsonb;
  op text;
  target text;
  row_id uuid;
  payload jsonb;
  columns text;
  values_list text;
  assignments text;
  conditions text;
  touched integer;
BEGIN
  IF jsonb_typeof(p_commands) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'apply_journaled_commands attend un tableau de commandes';
  END IF;
  IF jsonb_array_length(p_commands) = 0 OR jsonb_array_length(p_commands) > max_commands THEN
    RAISE EXCEPTION 'apply_journaled_commands attend de 1 à % commandes', max_commands;
  END IF;

  -- Le site, lu sous les politiques de l'appelant. Un site invisible et un
  -- site absent reçoivent le même refus.
  SELECT s.org_id INTO site_org FROM azimut.site s WHERE s.id = p_site_id;
  IF site_org IS NULL THEN
    RAISE EXCEPTION 'site inaccessible' USING ERRCODE = '42501';
  END IF;
  IF p_level_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM azimut.level l
    JOIN azimut.building b ON b.id = l.building_id
    WHERE l.id = p_level_id AND b.site_id = p_site_id
  ) THEN
    RAISE EXCEPTION 'niveau inaccessible' USING ERRCODE = '42501';
  END IF;

  -- Une écriture à la fois par site. La suite du journal est alors celle des
  -- applications, et le numéro suivant se lit sans course.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_site_id::text, 6002));
  SELECT coalesce(max(j.seq), 0) INTO next_seq
    FROM azimut.command_journal j WHERE j.site_id = p_site_id;

  FOR command IN SELECT * FROM jsonb_array_elements(p_commands) LOOP
    IF jsonb_typeof(command) IS DISTINCT FROM 'object'
       OR NOT (command ?& wire_keys)
       OR (command - wire_keys) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'commande mal formée';
    END IF;
    IF command ->> 'org_id' IS DISTINCT FROM site_org::text THEN
      RAISE EXCEPTION 'commande d''une autre organisation' USING ERRCODE = '42501';
    END IF;

    op := command ->> 'operation';
    target := command ->> 'table';
    row_id := (command ->> 'id')::uuid;

    IF target IN ('command_journal') OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_tables
      WHERE schemaname = 'azimut' AND tablename = target
    ) THEN
      RAISE EXCEPTION 'table inconnue : %', target;
    END IF;

    IF op = 'create' THEN
      payload := command -> 'after';
      IF jsonb_typeof(payload) IS DISTINCT FROM 'object'
         OR jsonb_typeof(command -> 'before') IS DISTINCT FROM 'null' THEN
        RAISE EXCEPTION 'commande mal formée';
      END IF;
      SELECT string_agg(quote_ident(key), ', ' ORDER BY key),
             string_agg(quote_nullable(value), ', ' ORDER BY key)
        INTO columns, values_list
        FROM jsonb_each_text(payload);
      BEGIN
        EXECUTE format('INSERT INTO azimut.%I (%s) VALUES (%s)', target, columns, values_list);
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'commande périmée' USING ERRCODE = 'PT409';
      END;

    ELSIF op IN ('update', 'delete') THEN
      IF jsonb_typeof(command -> 'before') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'commande mal formée';
      END IF;
      -- Chaque colonne de `before` devient une condition, comparée dans le type
      -- de la colonne et non en texte : un horodatage, une liste ou un jsonb
      -- s'écrivent de plusieurs façons pour une même valeur.
      SELECT string_agg(
               format('%I IS NOT DISTINCT FROM CAST(%L AS %s)',
                      b.key, b.value, pg_catalog.format_type(a.atttypid, a.atttypmod)),
               ' AND ' ORDER BY b.key),
             count(*) FILTER (WHERE a.attname IS NULL)
        INTO conditions, touched
        FROM jsonb_each_text(command -> 'before') b
        LEFT JOIN pg_catalog.pg_attribute a
          ON a.attrelid = format('azimut.%I', target)::regclass
         AND a.attname = b.key AND a.attnum > 0 AND NOT a.attisdropped;
      IF touched > 0 THEN
        RAISE EXCEPTION 'colonne inconnue dans before';
      END IF;
      conditions := coalesce(conditions, 'true');

      IF op = 'update' THEN
        payload := command -> 'after';
        IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN
          RAISE EXCEPTION 'commande mal formée';
        END IF;
        SELECT string_agg(format('%I = %s', key, quote_nullable(value)), ', ' ORDER BY key)
          INTO assignments
          FROM jsonb_each_text(payload);
        EXECUTE format('UPDATE azimut.%I SET %s WHERE id = %L AND %s',
                       target, assignments, row_id, conditions);
      ELSE
        IF jsonb_typeof(command -> 'after') IS DISTINCT FROM 'null' THEN
          RAISE EXCEPTION 'commande mal formée';
        END IF;
        EXECUTE format('DELETE FROM azimut.%I WHERE id = %L AND %s', target, row_id, conditions);
      END IF;

      GET DIAGNOSTICS touched = ROW_COUNT;
      IF touched <> 1 THEN
        RAISE EXCEPTION 'commande périmée' USING ERRCODE = 'PT409';
      END IF;

    ELSE
      RAISE EXCEPTION 'opération inconnue : %', op;
    END IF;

    next_seq := next_seq + 1;
    PERFORM pg_catalog.set_config('azimut.journal_writer', 'apply_journaled_commands', true);
    INSERT INTO azimut.command_journal (org_id, site_id, level_id, seq, command)
      VALUES (site_org, p_site_id, p_level_id, next_seq, command);
    PERFORM pg_catalog.set_config('azimut.journal_writer', '', true);
  END LOOP;

  RETURN next_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION azimut.apply_journaled_commands(uuid, uuid, jsonb) TO authenticated;
