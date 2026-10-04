/**
 * J3 (partie J) — la couche d'esquisse d'un site, lue par l'API REST
 * (migration 0072).
 *
 * À part du site : une esquisse ne participe à aucun calcul et n'entre dans
 * aucun livrable (J3.3). Elle ne passe donc jamais par `SiteData`, que le
 * compilateur et les moteurs lisent ; seul l'atelier la relit, pour la montrer.
 *
 * Les lignes gommées ne sont pas relues : la gomme supprime logiquement.
 */
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';
import type { SketchRows } from './site-repository.js';

type Row = Readonly<Record<string, unknown>> & { readonly id: string };

export async function loadSketch(config: PostgrestConfig, siteId: string): Promise<SketchRows> {
  const layers = await query<Row>(
    config, 'sketch_layer',
    `select=id,org_id,site_id,level_id,name,owner_id,visible,locked,created_at&site_id=eq.${siteId}&deleted_at=is.null`,
  );
  const strokes = (await queryIn<Row>(config, 'sketch_stroke', 'layer_id', layers.map(l => l.id)))
    .filter(s => s['deleted_at'] === null || s['deleted_at'] === undefined);
  return { layers, strokes };
}
