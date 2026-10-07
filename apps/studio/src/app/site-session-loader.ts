import type { SiteRepository } from '../data/index.js';
import type { SketchRows } from '../data/site-repository.js';
import { isRepositoryError } from '../data/index.js';
import { sessionFromSite } from '../state/session-from-site.js';
import type { SessionState } from '../state/session-store.js';

/**
 * E5.4 — le second terme du choix de reprise : ce que le dépôt porte d'un site.
 *
 * Le site et le circuit de son tableau des messages (R12) se relisent
 * ensemble. L'atelier y ajoute son esquisse (J3), qu'il est seul à lire
 * (J3.3) : il passe sa lecture, l'écran du tableau n'en passe pas. L'atelier
 * et l'écran du tableau partagent ce chargeur :
 * deux lectures distinctes finiraient par ne pas relire la même chose, et
 * l'émission pour revue ne verrait plus le passage de validation que l'atelier
 * vient d'enregistrer.
 *
 * Un site que le dépôt ne connaît pas rend `null` plutôt qu'une défaillance :
 * c'est le cas d'un site créé hors ligne, et l'écran s'ouvre alors vide. Toute
 * autre défaillance remonte, et la session la signale.
 */
export async function loadSiteSession(
  repository: SiteRepository,
  siteId: string,
  sketchOf?: (siteId: string) => Promise<SketchRows>,
): Promise<SessionState | null> {
  try {
    const [site, sketch, records] = await Promise.all([
      repository.loadSite(siteId),
      sketchOf === undefined ? Promise.resolve(undefined) : sketchOf(siteId),
      repository.loadScheduleRecords(siteId),
    ]);
    return sessionFromSite(site, sketch, records);
  } catch (cause: unknown) {
    if (isRepositoryError(cause) && cause.failure === 'not_found') return null;
    throw cause;
  }
}
