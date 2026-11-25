/**
 * S6.1c — les lignes d'habillage d'un site (0086), telles que PostgREST les
 * rend, sous l'identité de la session : le cloisonnement est en base.
 *
 * Le site est un uuid, vérifié avant d'entrer dans l'adresse : rien d'autre
 * n'y est composé. Les couches se lisent par site, les formes par couche.
 */
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type Row = Readonly<Record<string, unknown>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type DecorationRecords = {
  readonly layers: readonly Row[];
  readonly shapes: readonly Row[];
};

export async function loadDecorationRecords(config: PostgrestConfig, siteId: string): Promise<DecorationRecords> {
  if (!UUID.test(siteId)) throw new Error('site invalide');
  const layers = await query<Row>(config, 'decoration_layer', `select=*&site_id=eq.${siteId}`);
  const layerIds = layers.map(l => l['id']).filter((id): id is string => typeof id === 'string' && UUID.test(id));
  const shapes = await queryIn<Row>(config, 'decoration_shape', 'layer_id', layerIds);
  return { layers, shapes };
}
