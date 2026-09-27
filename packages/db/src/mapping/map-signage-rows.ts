/**
 * A5.6 — passage ligne → modèle pour la famille signalétique : typologie,
 * support, face, bloc de contenu, version.
 *
 * Sorti de `assemble-site-data.ts`, qui franchissait les quatre cents lignes
 * (A2.4). La coupure suit la matière : d'un côté le site et sa géométrie, de
 * l'autre ce qu'on y pose.
 */
import type {
  Support, SupportType, SupportFace, ContentBlockInstance, SupportVersion,
  DimensionsSource,
  } from '@azimut/core-model';
import type {
  SupportRow, SupportTypologyRow, SupportFaceRow,
  SupportContentBlockRow, SupportVersionRow,
} from './row-types.js';
import { num, isoString, asRecord, asStringArray, versionState } from './row-scalars.js';

/**
 * A5.6 — la base ne stocke aucune dimension par défaut au niveau de la
 * typologie : elles vivent sur l'instance. `faces` reste donc vide, et
 * l'appelant retombe sur les dimensions de l'instance puis sur une taille
 * de face par défaut.
 */
export function mapSupportTypologyRow(row: SupportTypologyRow): SupportType {
  return {
    id: row.id,
    org_id: row.org_id,
    key: row.key,
    name: row.name,
    face_count: row.face_count,
    ...(row.template_key !== null ? { template_key: row.template_key } : {}),
    faces: [],
  };
}

/** A5.6 — `face_index` vaut 0 quand la colonne additive est nulle. */
export function mapSupportFaceRow(row: SupportFaceRow): SupportFace {
  const langs = asStringArray(row.langs);
  return {
    id: row.id,
    org_id: row.org_id,
    support_id: row.support_id,
    face_index: row.face_index ?? 0,
    ...(row.template_key !== null ? { template_key: row.template_key } : {}),
    ...(langs !== undefined ? { langs } : {}),
  };
}

/**
 * A5.6 — `block_index` retombe sur l'`ordinal` antérieur. La contrainte
 * `support_content_block_position_present` (0049) garantit l'un des deux ; une
 * ligne qui n'en porte aucun ne peut venir que d'un schéma qui a dérivé, et la
 * lecture échoue plutôt que de placer le bloc au hasard.
 */
export function mapContentBlockRow(row: SupportContentBlockRow): ContentBlockInstance {
  const blockIndex = row.block_index ?? row.ordinal;
  if (blockIndex === null) {
    throw new Error(`support_content_block ${row.id}: neither block_index nor ordinal`);
  }
  const binding = asRecord(row.binding);
  const freeText = asRecord(row.free_text);
  return {
    id: row.id,
    org_id: row.org_id,
    face_id: row.face_id,
    block_index: blockIndex,
    kind: row.kind,
    ...(binding !== undefined ? { binding } : {}),
    ...(freeText !== undefined ? { free_text: freeText } : {}),
  };
}

/** A5.6 — l'état est garanti par la contrainte CHECK de la base. */
export function mapSupportVersionRow(row: SupportVersionRow): SupportVersion {
  return {
    id: row.id,
    org_id: row.org_id,
    support_id: row.support_id,
    version: row.version,
    state: versionState(row.state),
    ...(row.artwork_path !== null ? { artwork_path: row.artwork_path } : {}),
    ...(row.content_hash !== null ? { content_hash: row.content_hash } : {}),
    created_at: isoString(row.created_at),
    ...(row.created_by !== null ? { created_by: row.created_by } : {}),
  };
}

/**
 * A5.6 — registre, contexte et distance de lecture sont des colonnes additives
 * et nullables : une ligne antérieure retombe sur les valeurs les plus
 * permissives — registre de wayfinding, contexte intérieur, distance nulle —
 * pour qu'un support non relevé n'emprunte jamais en silence une règle plus
 * stricte que sa donnée ne le permet. Les vraies valeurs viennent du relevé.
 */
export function mapSupportRow(row: SupportRow): Support {
  const dimensionsSource: DimensionsSource | undefined =
    row.dimensions_source === 'overridden' ? 'overridden'
      : row.dimensions_source === 'computed' ? 'computed'
        : undefined;
  return {
    id: row.id,
    org_id: row.org_id,
    site_id: row.site_id,
    ...(row.code !== null ? { code: row.code } : {}),
    node_id: row.node_id,
    registry: row.registry === 'safety' ? 'safety' : 'wayfinding',
    context: row.context === 'exterior' ? 'exterior' : 'interior',
    reading_distance_m: row.reading_distance_m !== null ? num(row.reading_distance_m) : 0,
    azimuth_deg: num(row.azimuth_deg),
    ...(row.width_mm !== null ? { width_mm: row.width_mm } : {}),
    ...(row.height_mm !== null ? { height_mm: row.height_mm } : {}),
    ...(dimensionsSource !== undefined ? { dimensions_source: dimensionsSource } : {}),
    ...(row.typology_id !== null ? { typology_id: row.typology_id } : {}),
  };
}
