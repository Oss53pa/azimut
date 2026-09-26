/**
 * T-2.9 / A5.6 — un emplacement de plan mural est un support dont une face
 * porte un bloc de contenu `map` (proposition de schéma, 4.2). Il n'a pas de
 * table : il se lit sur les faces et leurs blocs. Son orientation est
 * l'azimut du support.
 */
import { wallPlanBlocks, type SiteData } from '@azimut/core-model';

/** Les supports qui portent un plan mural, par identifiant. */
export function wallPlanSupportIds(site: SiteData): ReadonlySet<string> {
  const facesWithMap = new Set(
    wallPlanBlocks(site).map(b => b.face_id),
  );
  return new Set(
    site.support_faces.filter(f => facesWithMap.has(f.id)).map(f => f.support_id),
  );
}
