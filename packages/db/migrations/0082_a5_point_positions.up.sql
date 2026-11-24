-- Validation par schéma des positions de nœud et d'ouverture.
--
-- A5 déclare `node.position` et `opening.position` en `jsonb` sans en fixer
-- la forme. Le code la porte : `Point { x_m, y_m }` (core-model,
-- `geometry.ts`), et l'atelier l'écrit ainsi. Rien en base ne refusait une
-- autre forme : une position `{x, y}` s'écrivait sans erreur, puis entrait
-- dans le modèle sans coordonnées.
--
-- Décision d'Oss53pa du 24 novembre 2026 (Q15,
-- `docs/decoupage-validation-jsonb.md`) : la base exige un objet à deux
-- nombres, `x_m` et `y_m`, et refuse toute autre clé. Bornes : un million de
-- mètres, comme la zone de travail de 0081 ; constante de forme, sans origine
-- normative.
--
-- Contraintes posées NOT VALID : toute écriture nouvelle est contrôlée, les
-- lignes existantes ne sont ni lues ni transformées (A2.2, point 7). La
-- requête de relevé en fin de fichier liste celles qui ne passeraient pas ;
-- les valider ensuite (`VALIDATE CONSTRAINT`) se décide une fois la liste
-- vide.

CREATE FUNCTION azimut.point_m_valid(p_point jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  -- Une contrainte CHECK qui vaut NULL est acceptée : le résultat est toujours
  -- défini, faux par défaut, et les conversions n'ont lieu qu'une fois le type
  -- vérifié, dans un CASE dont l'ordre est garanti.
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_point) IS DISTINCT FROM 'object' THEN false
      WHEN (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_point) AS k)
           IS DISTINCT FROM ARRAY['x_m', 'y_m'] THEN false
      WHEN jsonb_typeof(p_point -> 'x_m') <> 'number' OR jsonb_typeof(p_point -> 'y_m') <> 'number' THEN false
      ELSE abs((p_point ->> 'x_m')::numeric) <= 1000000 AND abs((p_point ->> 'y_m')::numeric) <= 1000000
    END,
    false);
$$;

ALTER TABLE azimut.node
  ADD CONSTRAINT node_position_point CHECK (azimut.point_m_valid(position)) NOT VALID;

ALTER TABLE azimut.opening
  ADD CONSTRAINT opening_position_point CHECK (azimut.point_m_valid(position)) NOT VALID;

-- Relevé des lignes existantes qui ne passeraient pas, à lancer par la
-- connexion propriétaire avant toute validation :
--
--   SELECT 'node' AS t, id FROM azimut.node WHERE NOT azimut.point_m_valid(position)
--   UNION ALL
--   SELECT 'opening', id FROM azimut.opening WHERE NOT azimut.point_m_valid(position);
